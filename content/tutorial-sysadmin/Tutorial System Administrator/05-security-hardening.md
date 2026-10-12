# 05 — Security & Hardening

Posture security RHEL 9 untuk server produksi: SELinux enforcing sebagai default, audit trail, SSH hardening, dan crash handling.

## 1. SELinux — aturan main

RHEL 9 default **enforcing**, targeted policy. 90% "masalah" SELinux di dunia nyata adalah: file pindah/ubah konteks → deny. Alur kerja yang benar:

```bash
getenforce                          # Enforcing?
sestatus                            # mode + policy version
journalctl | grep -i avc | tail     # denial terbaru (di journal + /var/log/audit/audit.log)
ausearch -m avc -ts recent          # denial dengan context lengkap
```

### Perbaiki, bukan matikan

Untuk denial "proses A tidak boleh baca file B":

```bash
# 1. Pahami denial-nya
ausearch -m avc -ts recent -i     # -i = translate ID ke nama

# 2. Kalau file punya konteks yang salah (file baru/copied):
restorecon -Rv /path/terdampak
semanage fcontext -l | grep /path # aturan context default

# 3. Kalau memang service butuh akses baru (langka):
semanage port -a -t http_port_t -p tcp 3002        # contoh: port non-standard
semanage boolean -l | grep <domain>                 # cek boolean ready-made
setsebool -P httpd_can_network_connect 1           # -P = persist setelah reboot

# 4. Last resort: audit2allow (BUKAN jalan pintas default)
grep denied /var/log/audit/audit.log | audit2allow -M mymod
semodule -i mymod.pp
```

> [!danger]
> `audit2allow` tanpa review = memberi izin "apa pun yang diminta kernel minggu ini". Review setiap allow yang di-generate. Kalau denial-nya aneh (process yang tidak seharusnya jalan), itu bug, bukan policy.

### Permissive per-domain (transisi aman)

```bash
semanage permissive -a httpd       # domain jadi permissive (log tetap, tidak deny)
ausearch -m avc -c httpd -ts recent # kumpulkan denial 1-2 hari
# fix konteks/policy → kembali enforcing
semanage permissive -r httpd
```

### Neverallow & module

Policy RHEL punya **neverallow** (invariant, misal domain non-init tidak boleh mount). Kalau custom module kalian melanggar neverallow, build gagal — itu fitur.

```bash
seinfo -t | head                   # type (domain) yang tersedia
semodule -l                        # module terinstall
semodule -n --list                 # detail per module
```

## 2. auditd — siapa yang melakukan apa

```bash
systemctl enable --now auditd
auditctl -s                          # status
auditctl -a always,exit -F arch=b64 -S execve -F dir=/usr/bin -F perm=x   # log exec di /usr/bin
auditctl -a always,exit -F arch=b64 -S openat -F dir=/etc -F perm=wa      # write ke /etc
ausearch -x su                       # semua exec /usr/bin/su
ausearch -m login -ts today
```

Persisten: `/etc/audit/rules.d/` (dimuat saat boot via `augenrules --load`).

> [!info]
> Aturan audit yang benar-benar berguna: (1) exec `su`/`sudo`/`sshd`, (2) write ke `/etc`, `/var/lib/systemd`, (3) `chmod/chown` ke SUID, (4) `user_*` (create/delete user). Sisanya = noise.

## 3. SSH hardening

`/etc/ssh/sshd_config.d/99-hardening.conf`:

```
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
X11Forwarding no
MaxAuthTries 3
LoginGraceTime 20
ClientAliveInterval 300
ClientAliveCountMax 2
AllowUsers admin ops deploy
```

```bash
sshd -T | grep -E "passwordauth|permitrootlogin|pubkey"   # verify runtime config (bukan file!)
sshd -t                                                    # syntax check
systemctl reload sshd
```

> [!danger]
> **Selalu** test SSH baru di sesi kedua sebelum menutup sesi pertama: `ssh new-user@host` jalan, baru `logout`. `sshd -T` (bukan `sshd -h`) menunjukkan config yang benar-benar aktif setelah include.

Fail2ban: `dnf install fail2ban`, enable + `recidive` jail. Watch: `/var/log/fail2ban.log`, Zabbix: count banned.

## 4. Update & patch management

```bash
dnf check-update
dnf update --security                # security-only (untuk window sempit)
dnf update                           # full (window besar, + kdump check)
dnf updateinfo list Security         # advisory per paket
```

Pola operasional:
1. **Security-only mingguan** (tanpa reboot) — window 30 menit.
2. **Full update bulanan** dengan reboot — koordinasikan, kdump harus aktif sebelum reboot.
3. `dnf install dnf-plugins-core; dnf list-upgrades` untuk audit.
4. Paket dari repo pihak ketiga (Zabbix, libvirt tambahan): pin version, jangan ikut `dnf update` buta.

## 5. File integrity & config drift

```bash
dnf install aide
aide --init && cp /var/lib/aide/aide.db.new /var/lib/aide/aide.db
aide --check
```

Scope `/etc` + binary kritis. Alert diff → Zabbix (UserParameter `aide --check | grep -c "changed"`).

## 6. Kernel hardening (sysctl)

`/etc/sysctl.d/99-hardening.conf` — hanya yang relevan untuk server (bukan workstation):

```
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1
kernel.yama.ptrace_scope = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_redirects = 0
fs.protected_symlinks = 1
fs.protected_hardlinks = 1
```

> [!info]
> Jangan copy-paste sysctl hardening 200-an baris dari internet. Setiap baris punya trade-off (misal `rp_filter=1` bisa drop paket di topologi multi-home/asymmetric). Pahami baris yang kalian set.

## 7. Kdump & vmcore

```bash
kdumpctl status
kdumpctl writecore /var/crash/<ts>/vmcore   # force test
crash /var/crash/<ts>/vmcore /usr/lib/debug/lib/modules/$(uname -r)/vmlinux
# di crash: bt (backtrace), log, ps, runq
```

> [!danger]
> `crash` butuh `vmlinux` debug dari kernel yang sama. `dnf install kernel-debuginfo-$(uname -r)` — kalau kernel sudah di-update, debuginfo lama hilang. Install **sebelum** update.

## 8. Checklist hardening server baru

1. `getenforce` = `Enforcing`, `sestatus` clean.
2. `sshd -T` sesuai hardening; login hanya key-based.
3. `firewall-cmd --list-all` — minimal port.
4. `auditctl -s` enabled; rules dasar terpasang.
5. `kdumpctl status` = `loaded`.
6. `aide --check` baseline dibuat.
7. Sysctl hardening di-apply + didokumentasikan (siapa set, kenapa).
8. NTP: `chronyc tracking` OK — audit log tidak berguna kalau waktu melenceng.
9. User: tidak ada UID=0 selain root (`awk -F: '$3==0' /etc/passwd`), tidak ada akun password kosong.
10. `last -20` + `lastb` — audit login.
