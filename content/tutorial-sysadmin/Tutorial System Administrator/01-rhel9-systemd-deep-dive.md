# 01 — RHEL 9 & systemd

Fondasi operasional RHEL 9: package management, boot process, dan anatomi systemd. Material bab ini jadi prasyarat semua bab lain — networking, storage, dan monitoring di sini berjalan di atas systemd.

> [!info]
> Skala: RHEL 9.x (9.4+). Semua perintah diasumsikan dijalankan sebagai `root` atau via `sudo` kecuali disebut lain.

## 1. Package Management: dnf

RHEL 9 memakai dnf4 sampai 9.4; mulai 9.5 default-nya **dnf5** (CLI-compatible, lebih cepat). Cek versi: `dnf --version`.

### Repo & stream

```bash
dnf repolist -v                      # repo aktif + metadata
dnf module list nginx                # lihat stream tersedia (default/preview)
dnf module enable nginx:1.28         # pin stream sebelum install
dnf install nginx                    # install mengikuti stream enabled
dnf module reset nginx               # kembali ke default stream
```

> [!warning]
> Jangan campur stream (misal `nginx:2.0` + dependensi dari `nginx:1.28`). Konflik module stream adalah penyebab `dnf` ngambek paling klasik.

### Pola kerja harian

```bash
dnf check-update                     # apa yang akan ter-update
dnf update --allowerasing            # izinkan dnf resolve circular dependency
dnf downgrade package-2.x            # roll back paket spesifik
dnf repoquery --requires --requires /usr/bin/git  # siapa butuh paket tertentu
dnf repoquery -f /etc/httpd          # paket pemilik file tertentu
dnf history list; dnf history undo <transid>   # audit trail transaksi
```

### Install manual (RPM)

```bash
dnf localinstall /path/pkg.rpm       # prefer dnf, bukan rpm -ivh (dependency di-resolve)
rpm -V /usr/sbin/somebinary          # verifikasi integrity file terinstall
```

## 2. Boot Process & Emergency Access

Alur boot RHEL 9: firmware → GRUB2 → kernel (`/boot/vmlinuz-...`) → initramfs (**dracut**) → `systemd` (PID 1) → unit target `multi-user.target`.

### GRUB & kernel cmdline

```bash
grubby --default-kernel              # kernel default
grubby --info=ALL                    # detail semua entry
grubby --update-kernel=ALL --args="console=ttyS0,115200"   # console serial (server headless)
```

> [!danger]
> Edit `/boot/grub2/grub.cfg` manual = bohong. Pakai `grubby` atau edit `/etc/default/grub` + `grub2-mkconfig -o /boot/grub2/grub.cfg` (atau `grub2-mkconfig -o /boot/efi/EFI/redhat/grub.cfg` untuk UEFI).

### dracut & single-user

```bash
dracut --list /boot/initramfs-$(uname -r).img | head -30  # modul di initramfs
dracut -f                                            # rebuild initramfs kernel aktif
```

Mode rescue: di GRUB menu, tekan `e` → tambahkan `rd.break` di baris kernel → `Ctrl+X`. Di `rd.break`:

```bash
mount -o remount,rw /
systemctl rescue       # atau: chroot /sysroot && systemctl ...
```

### Kdump

Pastikan kdump aktif supaya kernel panic ketangkap jadi `vmcore`:

```bash
systemctl status kdump
kdumpctl status
cat /proc/cmdline | grep crashkernel   # harus ada crashkernel=auto
kdumpctl rearm                         # re-arm setelah panic
ls /var/crash/                         # lokasi vmcore
```

## 3. Anatomi systemd

### Unit: jenis & lifecycle

Unit yang penting untuk operasional: `service`, `socket`, `timer`, `target`, `path`, `mount`, `swap`, `slice`, `scope`. Definisi: `/usr/lib/systemd/system/` (vendor, **jangan edit**) dan `/etc/systemd/system/` (override & custom).

### Dependency & ordering — pahami persis

| Directive | Arti |
|---|---|
| `Requires=` | Kalau unit ini start, dependensi harus start juga; kalau dependensi mati, unit ini ikut mati |
| `Wants=` | Sama tapi soft — kegagalan dependensi tidak mematikan unit ini |
| `After=` / `Before=` | **Hanya urutan start/stop**, bukan dependency |
| `BindsTo=` | Seperti `Requires` + `After`: dependensi mati → unit ini mati, tapi tanpa propagation ke bawah |
| `PartOf=` | Restart/stop dependensi memicu aksi yang sama di unit ini |

> [!warning]
> `After=` tanpa `Requires=` itu jebakan paling umum: urutannya benar, tapi kalau dependensi gagal start, unit kalian tetap jalan (dan biasanya crash sendiri). Selalu pasangan `Requires=` + `After=` kalau memang hard dependency.

### Inspeksi & debugging

```bash
systemctl status <svc>               # state, main PID, log tail
systemctl show <svc> -p MainPID,ActiveState,SubState,MemoryCurrent
systemctl list-dependencies <svc>    # graf dependensi
systemd-analyze critical-chain <svc> # kenapa unit ini start di detik ke-N boot
systemd-analyze blame                # unit terlambat saat boot
systemd-analyze verify /etc/systemd/system/foo.service  # validasi syntax + dependensi
journalctl -u <svc> -b --since "2026-10-08 02:00" -o json | jq .
journalctl -u <svc> -o cat --no-pager | tail
```

### Job & mask

```bash
systemctl list-jobs                  # job yang sedang berjalan (start/stop)
systemctl list-unit-files | grep masked   # unit yang di-mask
systemctl mask <svc>                 # hindari start manual/otomatis
systemctl unmask <svc>
```

Kalau service "stuck" di `activating`/`deactivating`, cek `systemctl list-jobs` — biasanya ada timeout start (`TimeoutStartSec=`) atau cgroup yang menolak.

### Drop-in: override tanpa re-write

```bash
systemctl edit <svc>                 # buat drop-in di /etc/systemd/system/<svc>.d/override.conf
```

Contoh menaikkan limit file descriptor:

```ini
[Service]
LimitNOFILE=65536
```

`systemctl daemon-reload && systemctl restart <svc>`.

## 4. cgroup v2 — mesin sumber daya

RHEL 9 default **cgroup v2** (`/sys/fs/cgroup`, filesystem `cgroup2fs`). Setiap service = cgroup sendiri.

```bash
# Inspeksi resource service
systemd-cgtop -n 1                   # konsumsi CPU/mem per cgroup, live
cat /sys/fs/cgroup/system.slice/nginx.service/memory.peak
cat /sys/fs/cgroup/system.slice/nginx.service/cpu.stat

# Tekan resource tanpa edit unit (scope throwaway)
systemd-run --scope -p MemoryMax=512M -p CPUQuota=200% -- sleep 600

# PSI: Pressure Stall Information — metrik "sakit" sistem
cat /proc/pressure/cpu /proc/pressure/memory /proc/pressure/io
```

> [!info]
> `some`/`full` di PSI = fraksi waktu proses stall. `memory some > 10%` sustained artinya sistem mulai thrash/reclaim agresif. Ini alarm paling awal untuk memory pressure — lebih berguna dari sekadar `free`.

### OOM di era cgroup v2

OOM kill sekarang granular per-cgroup. Cari di journal:

```bash
journalctl -k | grep -i oom          # kernel oom message
journalctl -u <svc> | grep -i "oom\|killed"
cat /sys/fs/cgroup/system.slice/<svc>.service/memory.events   # oom_kill counter
```

Kena OOM = tambah `MemoryMax`/`MemoryHigh` (jangan `MemoryMax=infinity` untuk service kritis yang bisa leak), atau fix aplikasi-nya.

## 5. Timer & task terjadwal

Pengganti cron di world systemd:

```bash
systemctl list-timers --all
systemctl cat <svc>.timer            # OnCalendar=, OnBootSec=, AccuracySec=
journalctl -u <svc> --since today    # output task
```

Pola standar backup/rotate: `service` (Type=oneshot) + `timer` (`OnCalendar=daily`, `Persistent=true` supaya catch-up kalau mesin off).

## 6. Sandboxing service (portable hardening)

Unit kritis layak di-sandbox — murah, dan mencegah blast radius:

```ini
[Service]
ProtectSystem=strict          # rootfs read-only
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectControlGroups=true
ReadWritePaths=/var/lib/myapp
NoNewPrivileges=true
```

Verifikasi: `systemd-analyze security <svc>` — skor dan daftar hardening yang hilang.

## 7. Drill: service mati misterius

Checklist berurutan (dari yang paling sering):

1. `journalctl -u <svc> -b --no-pager | tail -50` — log terakhir sebelum mati.
2. `dmesg -T | tail -30` — OOM? I/O error? hardware?
3. `systemctl show <svc> -p ExecMainStatus,Result,ActiveState` — kode exit: 137 = SIGKILL (biasanya OOM), 1 = error aplikasi, 126 = executable nggak bisa dijalankan (permission/selinux), 203/204 = exec/timeout gagal.
4. `getenforce` + `journalctl | grep avc` — denial SELinux (lihat bab 5).
5. `systemd-analyze security <svc>` — cek sandbox yang terlalu ketat (misal `ProtectSystem=strict` tanpa `ReadWritePaths`).
6. Cek resource: `MemoryMax`, `CPUQuota`, `TasksMax`.

> [!danger]
> Exit 126/127 di service yang "tiba-tiba" mati setelah update hampir selalu SELinux atau sandbox — bukan bug kode. Jangan buru-buru rebuild aplikasi.
