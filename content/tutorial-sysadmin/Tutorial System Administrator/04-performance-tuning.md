# 04 — Performance & Tuning

Cara berpikir senior: **diagnosis sebelum tuning**. Setiap tuning tanpa baseline = tebak. Bab ini adalah toolbox diagnosis + pola tuning yang terbukti.

## 1. Tiga sumber data

1. **`/proc` & `/sys`** — state real-time, gratis, granular.
2. **Perf counters** (`perf`, `pidstat`) — per-proses, per-CPU.
3. **PSI** (`/proc/pressure/*`) — "seberapa sakit" sistem secara agregat.

```bash
vmstat 1 10        # overview per-detik
iostat -xm 1 10    # disk
pidstat -u 1 5     # CPU per proses
pidstat -r 1 5     # memory per proses (RSS, maj/min faults)
cat /proc/pressure/{cpu,memory,io}
```

## 2. Membaca vmstat

```
 r  b  swpd   free    si  so  us  sy  id  wa  cs  in
```

| Kolom | Arti senior |
|---|---|
| `r` | runnable queue. `r > nCPU` = CPU saturated |
| `b` | blocked (uninterruptible, biasanya I/O). `b > 0` sustained = I/O problem |
| `si/so` | swap in/out. Non-zero sustained = memory tidak cukup |
| `us/sy` | user vs system. `sy` > 30% = syscall overhead (context switch, lock, I/O) |
| `wa` | iowait. Tinggi + `b` tinggi = disk bottleneck. Tinggi tapi `b`=0 = sering disk cepat, hanya "waiting" |
| `cs` | context switch. > 100k/s sustained = over-scheduling (thread terlalu banyak) |
| `in` | interrupt. Naik tajam = jaringan/broadcast |

> [!info]
> Pola paling sering: `wa` tinggi, `b` tinggi, `id` rendah → I/O. `r` tinggi, `us+sy` ~100 → CPU. `si/so` > 0 → memory. Tiga-tiganya rendah tapi app lambat → masalah di app (lock, GC, algorithm) — keluar dari OS, masuk ke profiling.

## 3. CPU deep

### Context switch & IRQ

```bash
vmstat 1 | awk '{print $12}'   # cs
mpstat -P ALL 1 3              # per-CPU: %sys, %soft, %irq
cat /proc/interrupts | grep -E "NIC|enp"   # IRQ distribusi per CPU
systemctl status irqbalance
```

Pola IRQ semua di satu CPU (NIC single-queue) → naik `ethtool -L enp1s0 combined 8` (jika NIC support) dan pastikan irqbalance jalan.

### CPU isolation (workload kritis)

```bash
grubby --update-kernel=ALL --args="isolcpus=domain,2-7 nohz_full=2-7"
# + cgroup:
systemd-run --scope -p AllowedCPUs=2-7 <cmd>
# atau persistent: [Service] AllowedCPUs=2-7
```

## 4. Memory deep

```bash
free -h                          # quick — jangan percaya hanya ini
grep -E "MemAvailable|Slab|SReclaimable|Committed_AS" /proc/meminfo
cat /proc/meminfo | grep -A2 "HugePages"   # THP state
slabtop -o | head                # slab terbesar (dentry, inode = cache)
```

- `MemAvailable` adalah angka yang benar untuk "memory free", bukan `free`.
- `Slab` besar = cache kernel (dentry/inode) — normal, dan bisa di-reclaim.
- **Transparent Huge Pages**: untuk database (PostgreSQL/MySQL), disable:

```bash
echo never > /sys/kernel/mm/transparent_hugepage/enabled
# persist: /etc/sysctl.d/99-thp.conf tidak bisa — pakai tuned profile:
tuned-adm profile virtual-guest   # atau custom profile: hugepages=never
```

> [!warning]
> THP `madvise`/`always` + PostgreSQL = tail latency spike (khugepaged compaction stall). Ini salah satu "server lambat tanpa alasan" paling klasik. Cek: `dmesg | grep khugepaged`.

### OOM forensik

```bash
journalctl -k --since today | grep -B5 -A20 "Out of memory"
grep -r oom_kill /sys/fs/cgroup/*/memory.events 2>/dev/null
cat /sys/fs/cgroup/system.slice/<svc>.service/memory.peak
```

## 5. I/O — dari app ke device

```bash
iostat -xm 1 10                  # device level (lihat bab 3)
blktrace -d /dev/vgdata/lvdata -o - | blkparse -i - 2>/dev/null | head -30   # trace detail (berat, singkat saja)
cat /proc/<pid>/io               # per-proses: read_bytes, write_bytes
```

Pola masalah I/O:

| Simptom | Kemungkinan |
|---|---|
| `await` naik, `r/s` konstan | Device slow (disk, HBA, path storage) |
| `w/s` naik, `await` naik | Write amplification (fsync storm, journal) |
| I/O app kecil tapi `await` besar | Block di network (NFS/iSCSI) — cek `ss` + path |
| `dirty` pages besar di `/proc/meminfo` | Write backlog: `vm.dirty_ratio` |

```bash
sysctl vm.dirty_ratio vm.dirty_background_ratio
# Pola DB: dirty_ratio=10, dirty_background_ratio=5 (flush lebih sering, tail latency turun)
```

## 6. Flame graph — lihat ke dalam proses

```bash
perf record -F 99 -g -p <pid> -- sleep 30
perf script > out.perf
# flamegraph.pl (github.com/brendangregg/FlameGraph) — install di workstation
flamegraph.pl < out.perf > flame.svg
```

Cara baca: lebar = waktu. Frame terlebar di atas = hotspot. Pola:
- Lebar di `malloc`/`free` → allocator pressure.
- Lebar di futex/lock → contention.
- Lebar di syscall `write`/`read` → I/O bound (validasi dengan iostat).
- CPU 100% tapi flame graph "tipis dan lebar merata" → banyak function kecil = algorithm, bukan satu hotspot.

## 7. Network performance

```bash
ss -tin state established '( dport = :5432 )' | head
# keluaran: rtt, cwnd, retrans
cat /proc/net/softnet_stat    # column 2: drop (ksoftirqd backlog)
ethtool -S enp1s0 | grep -E "drop|miss|err"
```

Tuning TCP untuk workload banyak-koneksi:

```bash
# /etc/sysctl.d/99-net.conf
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.ipv4.tcp_slow_start_after_idle = 0
```

> [!info]
> `tcp_slow_start_after_idle = 0` penting untuk koneksi persistent (DB pool) — cwnd tidak reset setelah idle.

## 8. cgroup v2 untuk isolasi workload

```bash
# Limit persistent: drop-in unit
systemctl edit <svc>
# [Service]
# MemoryMax=2G
# MemoryHigh=1536M
# CPUQuota=200%
# IOWeight=100

# Cek tekanan (PSI per-cgroup, RHEL 9):
cat /sys/fs/cgroup/system.slice/<svc>.service/memory.pressure
cat /sys/fs/cgroup/system.slice/<svc>.service/cpu.pressure
```

`MemoryHigh` (soft) vs `MemoryMax` (hard, OOM): set `MemoryHigh` lebih dulu untuk backpressure halus, `MemoryMax` sebagai pagar terakhir.

## 9. Decision tree: "server terasa lambat"

```
1. vmstat 1 10
   ├─ r > nCPU ──────────────► CPU: perf record + flame graph
   ├─ b/wa tinggi ───────────► I/O: iostat -xm → await? %util?
   │    ├─ await normal, b tinggi → block di NFS/iSCSI (cek network + storage)
   │    └─ await tinggi → device (bab 3: multipath, smartctl)
   ├─ si/so > 0 ─────────────► memory: MemAvailable, slab, THP, OOM
   ├─ cs > 100k ─────────────► over-scheduling: kurangi thread/pool, isolcpus
   └─ semua rendah ──────────► bukan OS: masuk ke app (profiling, DB query, lock)
2. Setiap langkah: catat angka (Zabbix item / screenshot) — untuk compare setelah fix.
```

> [!danger]
> Jangan tuning 5 sysctl sekaligus lalu bilang "sekarang cepat". Ubah satu, ukur, bandingkan. Baseline sebelum & sesudah adalah satu-satunya bukti.
