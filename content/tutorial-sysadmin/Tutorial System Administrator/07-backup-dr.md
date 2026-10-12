# 07 — Backup & DR

Prinsip: **backup yang tidak pernah di-restore = hope, bukan backup.** Setiap strategi di bawah wajib punya drill restore terdokumentasi + terjadwal.

## 1. Framework: 3-2-1 + RPO/RTO

- **3** salinan data (1 production + 2 backup)
- **2** media berbeda (misal disk NAS + object storage/S3)
- **1** offsite (NAS Channel di rack berbeda, atau S3)
- **RPO** (data loss maksimum yang bisa diterima) → menentukan frekuensi backup
- **RTO** (waktu pulih maksimum) → menentukan metode restore (snapshot vs file-by-file)

## 2. restic — backup file ke NAS/S3

```bash
dnf install restic
export RESTIC_REPO=nas:172.31.252.30:/backup/restic/cukita
export RESTIC_PASSWORD=<32-char-random>
restic init
```

Pola backup harian:

```bash
restic backup /data /var/lib/postgresql /etc \
  --exclude '/data/cache' --exclude '/data/tmp' \
  --tag daily --verbose
restic snapshots --latest 7
```

Retensi & verifikasi:

```bash
restic forget --tag daily --keep-daily 7 --keep-weekly 4 --keep-monthly 12 --prune
restic check --read-data-subset=5%   # verifikasi berkala (minggu, off-peak)
restic restore latest --target /restore-test   # drill restore
```

> [!info]
> `restic check --read-data-subset` adalah satu-satunya cara tahu bahwa backup-nya benar-benar terbaca (bit rot, S3 object hilang). Jadwal mingguan, alert jika gagal.

## 3. borg — dedup lebih agresif, repo di NAS

```bash
dnf install borgbackup
borg init --encryption=repokey /mnt/nas/backup/cukita
borg create /mnt/nas/backup/cukita::"{hostname}-{now:%Y%m%d}" /data /etc \
  --compression lz4 --stats
borg list /mnt/nas/backup/cukita
borg prune --keep-daily=7 --keep-weekly=4 --keep-monthly=12
borg extract /mnt/nas/backup/cukita::20261008 /data --strip-components 0
```

Borg unggul untuk incremental banyak (repo besar, banyak file berubah sedikit). restic unggul untuk repo di object storage (chunker-friendly) dan enkripsi keyless.

## 4. Snapshot & copy cepat (LUN/LVM)

Untuk RTO pendek (menit), file-by-file tidak cukup — pakai snapshot storage:

| Level | Alat | RTO | Catatan |
|---|---|---|---|
| File | restic/borg | jam | Granular, portable, verifiable |
| LV | `lvcreate -s` | menit | Copy-on-write; ukuran = data berubah |
| LUN (iSCSI/ZStack) | Snapshot LUN | menit | Cek feature storage; snapshot penuh LUN |
| VM | `virsh snapshot-create` | menit | Snapshot memory+disk (live) |

> [!warning]
> Snapshot LVM/LUN **bukan backup** — itu mekanisme restore cepat. Tetap wajib di-backup (restic) karena snapshot hilang saat LV/LUN-nya hilang. Snapshot = stopgap, restic = insurance.

## 5. Database backup (PostgreSQL contoh)

```bash
# Logical (portable, cross-version)
pg_dump -Fc -U app -d cukita > /backup/cukita_$(date +%F).dump
pg_restore -d cukita_restore -j 4 /backup/cukita.dump

# PITR (production DB besar): WAL archive + basebackup
# 1. basebackup: pg_basebackup -D /data/pgbase -X stream -S pitr
# 2. WAL: archive_command = 'test ! -f /wal/%f && cp %p /wal/%f'
# 3. restore: pg_waldump, restore_command dari /wal
```

- Logical: RPO = interval dump (jam). Cocok untuk DB < 100GB.
- PITR: RPO = detik (setiap commit di-WAL). Wajib untuk DB produksi besar.
- **Test restore ke instance terpisah tiap bulan.** Catat durasi + hasil di CUKITA.

## 6. rsync — sync, bukan backup

```bash
rsync -aHAX --delete /data/ rsync://nas172.31.252.30/mirror/
```

`--delete` = mirror (bukan backup). Kegunaan: failover cepat, staging. Untuk backup: tanpa `--delete` + rotasi.

## 7. DR runbook: NAS mati

```
1. Konfirmasi: ping 172.31.252.30, cek Zabbix (PSU, fan, disk), ipmitool sol (jika physical).
2. Dampak: NFS client mount (nfsstat -c: "stalled"), service yang write ke NAS.
3. Keputusan (< 30 menit recover):
   a. Reboot NAS (ipmitool power cycle) → NFS auto-remount (timeo=600, hard).
   b. Ganti disk (RAID1/10): pull disk, replace, rebuild → service normal (degraded).
4. NAS down > 2 jam:
   a. Failover service ke NAS-2 (jika ada) — update DNS/VIP.
   b. Client: remount ke NAS-2 (per-host, atau update /etc/hosts + VIP).
5. Data integrity: setelah NAS hidup, `xfs_repair -n` per filesystem, `fsck` RAID.
6. Post-incident: root cause, update runbook.
```

## 8. DR runbook: server produksi mati

```
1. Zabbix: alert host down → scope (1 host? rack? power? switch?).
2. `ipmitool power status` dari management network (BMC tetap hidup saat OS mati).
3. `ipmitool sol activate` — lihat console: boot? kernel panic? I/O error?
4. vmcore tersedia? `kdumpctl` → `/var/crash/`.
5. Recovery decision:
   - OS corrupt: boot dari rescue, `xfs_repair`, restore config dari backup.
   - Disk hilang: LVM from backup (restic) + rebuild LV, RTO = durasi restore.
   - Hardware mati: VM → live migrate dulu (jika ZStack); physical → RMA + rebuild dari backup.
6. Re-register: Zabbix auto-register (HostMetadata), firewall rules, DNS.
7. Post-incident: RTO aktual vs target, data loss vs RPO.
```

## 9. Checklist program backup

1. [ ] Setiap data kritikal punya: owner, RPO, RTO, metode backup, jadwal.
2. [ ] Retensi didefinisikan (7/4/12 atau sesuai compliance).
3. [ ] Enkripsi di repo (restic/borg) — kunci disimpan terpisah dari data.
4. [ ] `check`/`verify` terjadwal + alert.
5. [ ] **Drill restore bulanan** — catat: durasi, hasil, anomali.
6. [ ] Backup dipantau di Zabbix (exit code job, ukuran snapshot, age latest).
7. [ ] Alert "backup terakhir > 26 jam" = page oncall.

> [!danger]
> "Backup jalan" ≠ "data aman". Satu kombinasi fatal paling sering: backup tidak di-verify + kunci enkripsi hilang + tidak pernah drill restore. Tiga-tiganya murah, semuanya wajib.
