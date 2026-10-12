# 03 — Storage

Arsitektur storage server kita: server fisik → multipath → LUN (iSCSI/local) → LVM → XFS. NAS Channel untuk file share (NFS/SMB). Bab ini cover seluruh rantai itu.

## 1. Peta perangkat: mulai dari bawah

```bash
lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT,PATH,MODEL   # satu gambar dunia
lsblk -P | grep TYPE=disk                               # scriptable
smartctl -a /dev/sda                                    # health: Reallocated_Sector, Power_On_Hours
smartctl -l selftest /dev/sda
```

> [!danger]
> `Reallocated_Sector_Ct` naik = disk mau mati. Jangan tunggu — snapshot/LUN copy, migrasi data, ganti disk. Di Zabbix, SMART warning = alert page-on, bukan email.

## 2. LVM

### Operasi harian

```bash
pvs; vgs; lvs                          # inventaris
vgcreate vgdata /dev/sdb
lvcreate -L 500G -n lvdata vgdata
mkfs.xfs /dev/vgdata/lvdata
lvextend -L +50G /dev/vgdata/lvdata
xfs_growfs /mnt/data                    # XFS: growfs, bukan resizefs (lihat bawah)
lvreduce -L -50G /dev/vgdata/lvdata     # XFS TIDAK BOLEH di-shrink! hanya ext4
```

> [!warning]
> **XFS hanya bisa grow, tidak shrink.** Kalau salah ukur LV, tidak ada jalan mundur — migrasi ke LV baru (atau snapshot + restore). Shrink = fitur ext4, bukan XFS. Keputusan ukuran LV adalah keputusan permanen.

### Snapshot LVM (sihat & cepat)

```bash
lvcreate -L 50G -s -n snap_data vgdata/lvdata
lvconvert --merge vgdata/snap_data      # merge kembali (unmount dulu target)
```

Snapshot LVM berbasis copy-on-write: ukuran snapshot = ukuran data yang berubah, **bukan** ukuran LV. Jangan buat snapshot 10G untuk LV 10T yang aktif tulis.

## 3. XFS

```bash
xfs_info /mnt/data                      # block size, feature (reflink? ftype?)
xfs_quota -x -c "report -h" /mnt/data   # project/user quota
xfs_db -r -c "frags" /dev/vgdata/lvdata # fragmentation report (read-only mode)
xfs_fsr /mnt/data                       # defragment online (efektif untuk file < 100MB)
```

Repair (offline, LV unmounted):

```bash
xfs_repair -n /dev/vgdata/lvdata        # dry run — WAJIB dulu
xfs_repair /dev/vgdata/lvdata           # repair
xfs_repair -L /dev/vgdata/lvdata        # log force-zero — HANYA kalau tidak ada log (fresh/readonly)
```

> [!danger]
> `xfs_repair -L` menghapus transaction log. Pada filesystem yang dirty (crash), data terakhir hilang. Simpan `ddrescue`/image LV sebelum `xfs_repair -L`.

FTRIM di SSD (hindari write amplification):

```bash
lsblk -d -o NAME,DISC-GRAN,DISC-MAX     # cek support discard
systemctl status trim.timer            # RHEL: trim.service harian (LVM thin)
```

## 4. Multipath

```bash
multipath -ll                           # path per LUN, active/failed
multipathd show map                     # state detail
cat /etc/multipath.conf                 # path_grouping_policy, prio, failback
systemctl restart multipathd && multipath -r   # reload tanpa lose LUN
```

> [!info]
> `path_grouping_policy group_by_prio` + `failback immediate` = failover cepat. `prio alua` penting untuk storage yang support ALUA (Asymmetric LUN Access) — tanpa prio yang benar, path preferred/standby tertukar dan IOPS anjlok.

Ganti disk HBA/path: `multipath -v3` verbose saat path baru muncul, cocokkan WWID di `/etc/multipath/bindings` supaya nama `dm-N` stabil.

## 5. iSCSI (client)

```bash
systemctl enable --now iscsid
iscsiadm -m discovery -t st -p 172.31.252.20    # send targets
iscsiadm -m node -T iqn... -p 172.31.252.20 -l  # login
iscsiadm -m node -T iqn... -l -L nodeall        # login semua node
```

CHAP (`/etc/iscsi/iscsid.conf` + node record):

```bash
iscsiadm -m node -T iqn... -o new -n node.session.auth.authmethod -v CHAP
iscsiadm -m node -T iqn... -o new -n node.session.auth.username -v initiator
iscsiadm -m node -T iqn... -o new -n node.session.auth.password -v 'secret'
```

## 6. NFS (NAS Channel)

### Export (server)

`/etc/exports`:

```
/data/share  172.31.0.0/16(rw,sync,no_subtree_check,fsid=0)
```

```bash
exportfs -ra; exportfs -v
systemctl enable rpcbind nfs-server nfs4-server
```

Flag penting: `sync` (durability), `no_root_squash` (hanya kalau client butuh root write — lebih aman: user mapping), `no_all_squash`, `insecure` (client dari port > 1024, misal container).

### Mount (client)

```bash
mount -o vers=4.2,hard,timeo=600,retrans=2 172.31.252.30:/data/share /mnt/nas
# /etc/fstab:
# 172.31.252.30:/data/share  /mnt/nas  nfs4  vers=4.2,hard,timeo=600,retrans=2,_netdev  0 0
```

- `hard` (default): I/O nyangkut = client nunggu (data intact). `soft`: I/O nyangkut = error (data bisa hilang) — jarang benar.
- `timeo` dalam desidetik. `timeo=600` = timeout 60 detik.

> [!warning]
> NFS di belakang bond/LACP: pastikan `rsize`/`wsize` ≤ MTU. Jumbo frame di satu sisi, 1500 di sisi lain = transfer macet di ukuran tertentu.

Troubleshooting NFS:

```bash
nfsstat -c; nfsstat -s                 # client & server stats
showmount -e 172.31.252.30
cat /proc/net/rpc/nfs                  # per-op latency
dmesg | grep -i "nfs\|stalled"         # "task blocked for more than 120s" = server/sisi path
```

## 7. Disk performance — cara baca iostat

```bash
iostat -xm 1 10
```

Kolom yang penting:

| Kolom | Sehat | Bermasalah |
|---|---|---|
| `%util` (rotational) | < 70 | ~100 = queue penuh, bottleneck |
| `await` | < 5 ms (HDD), < 1 ms (SSD) | Naik tajam = device slow |
| `r_await`/`w_await` | Sama dengan await | Asimetris → pola baca/tulis bermasalah |
| `avgqu-sz` | < 1 | > 8 = queue menumpuk |
| `r/s`+`w/s` | Sesuai workload | Anjlok padahal app aktif = block di tempat lain |

> [!info]
> `%util` untuk NVMe/multi-queue tidak akurat (multi-queue tidak ter-capture). Untuk NVMe, percaya `await` + `avgqu-sz`, dan tambahkan `nvme smart-log /dev/nvme0` untuk health.

Baseline dengan fio (simpan hasil per host di Zabbix):

```bash
fio --name=randread --rw=randread --bs=4k --size=4G --numjobs=4 \
    --iodepth=32 --direct=1 --runtime=60 --filename=/mnt/data/fio.test
fio --name=seqwrite --rw=write --bs=1M --size=2G --numjobs=1 \
    --iodepth=8 --direct=1 --runtime=60 --filename=/mnt/data/fio.test
```

## 8. Playbook: disk/LUN bermasalah

1. `dmesg -T | grep -E "I/O error|sector|reset"` — ada I/O error?
2. `smartctl -a` — reallocated sector?
3. `multipath -ll` — path gagal?
4. Kalau LUN storage: cek sisi storage (Zabbix storage pool), snapshot LUN sebelum ganti.
5. Data kritis: `xfs_repair -n` dulu, baru tindakan.
6. Setelah ganti: `multipath -r`, `xfs_repair` (jika perlu), `mount`, `xfs_info`, baseline `fio`.

> [!danger]
> Urutan yang salah di storage failure: unmount → `xfs_repair` → mount. **Bukan** mount → `xfs_repair` → crash. XFS repair tidak bisa jalan di mounted filesystem (kecuali `xfs_repair` dengan LV snapshot).
