# 08 — Virtualization & ZStack

Lapisan compute kita: ZStack di atas KVM di server fisik. Bab ini cover dua level: libvirt langsung (untuk kontrol manual & troubleshooting) dan ZStack (untuk operasional harian).

## 1. KVM & libvirt — fondasi

```bash
egrep -c '(vmx|svm)' /proc/cpuinfo     # flag virtualisasi CPU (harus > 0)
lsmod | grep -E "kvm|virtio"
virt-host-list; virt-host-validate
```

### Lifecycle VM

```bash
virsh list --all
virsh define vm.xml                     # import domain
virsh start <vm>
virsh autostart <vm>
virsh shutdown <vm>                     # ACPI (akrab, guest harus cooperate)
virsh destroy <vm>                      # force (power off)
virsh suspend <vm>; virsh resume <vm>
virsh console <vm>                      # serial console (tanpa VNC/GUI)
```

### Resource & snapshot

```bash
virsh setmem <vm> 8G; virsh setvcpus <vm> 4    # hot-plug (guest harus support)
virsh dominfo <vm>
virsh snapshot-create-as <vm> snap1 --disk-only   # snapshot disk (tanpa memory)
virsh snapshot-list <vm>
virsh snapshot-revert <vm> snap1
```

> [!warning]
> `virsh snapshot-revert` = VM kembali ke state snapshot **disk** (dan memory jika external snapshot). Data yang ditulis setelah snapshot **hilang**. Selalu konfirmasi sebelum revert.

### Storage pool

```bash
virsh pool-list --all
virsh pool-define <pool.xml>          # type: dir, lvm, iscsi, rbd
virsh pool-build <pool>               # buat LV/disk sesuai definisi
virsh vol-create --name data.qcow2 --capacity 50G <pool>
virsh vol-list <pool>
```

QEMU guest agent (untuk clean shutdown dari hypervisor):

```bash
# install di guest (RHEL): dnf install qemu-guest-agent && systemctl enable --now qemu-ga
virsh qemu-agent-command <vm> '{"execute":"guest-info"}'
```

## 2. Live migration

```bash
virsh migrate --live <vm> qemu+ssh://<target-host>/system
# Prasyarat: shared storage (LUN/NFS) ATAU --p2p --tunnelled
virsh migrate-setmaxdowntime 200      # target downtime ms
```

Checklist sebelum migrate:
1. Target host: resource cukup (CPU/mem), storage reachable, network reachable.
2. VM tidak pakai disk lokal (non-shared) tanpa `--block`.
3. `virsh domiftlist <vm>` — pastikan NIC attach ke bridge/OVS yang ada di kedua host.

## 3. Open vSwitch (OVS) — L2 virtual

```bash
systemctl enable --now openvswitch
ovs-vsctl show
ovs-vsctl add-br br-storage
ovs-vsctl add-port br-storage enp5s0
ovs-vsctl add-port br-storage vnet0   # dari VM (PATCH/vnet)
ovs-vsctl set interface vnet0 type=internal
# VLAN trunking:
ovs-vsctl add-port br-storage enp6s0
ovs-vsctl set port enp6s0 tag=100     # access; trunk = tidak set tag
```

Pola: `br-compute` (VM traffic, VLAN tagged), `br-storage` (iSCSI, tagged). Pisahkan L2 domain storage dari compute — broadcast/storage storm tidak boleh ganggu VM.

## 4. ZStack — operasional harian

Arsitektur: management server + compute node (KVM) + storage pool (local/iSCSI/Ceph) + L3 network (cloud router).

### Operasi utama (via UI/API)

1. **Cek health cluster**: node status, storage pool capacity, secondary storage.
2. **Buat VM dari template**: pilih compute zone, L3 network, disk (primary storage), keypair.
3. **Network**: L3 network = VPC. vIP = floating IP untuk akses eksternal. Cloud router = gateway (NAT/SNAT) untuk internet.
4. **Snapshot VM**: primary storage snapshot (untuk restore) + backup ke secondary storage (untuk DR).
5. **Live migration**: drag VM antar compute node (UI) — prasyarat sama dengan libvirt.

### Pola troubleshooting ZStack

```
VM lambat:
  1. Cek compute node: load, I/O (iostat -xm), memory (Zabbix host node).
  2. Cek storage pool: latency LUN (iSCSI), Ceph (rados df, ceph -s).
  3. Cek NIC host: ethtool -S (drop), OVS (ovs-appctl dpif/show).
  4. Cek di dalam VM: vmstat, iostat, ss — apakah masalah di guest?

VM tidak bisa migrate:
  1. `zstack-management` log: /opt/zstack/management/log/management.log
  2. Cek shared storage: LUN visible di target node (multipath -ll).
  3. Cek OVS bridge di kedua node (ovs-vsctl show).
  4. Cek secondary storage (untuk migration dengan non-shared disk).

Management server down:
  1. ZStack HA: management server standby takeover (jika dikonfigurasi).
  2. Tanpa HA: boot management server dari backup DB + config.
  3. VM tidak terdampak (KVM jalan di compute node) — hanya kontrol yang hilang.
```

## 5. IPMI / BMC — server fisik mati pun tetap bisa dikelola

```bash
ipmitool -I lanplus -H 172.31.252.200 -U admin -P <pass> sdr type temperature
ipmitool ... sel list | tail -20          # event log
ipmitool ... power status
ipmitool ... power cycle
ipmitool ... sol activate                 # Serial Over LAN = "console fisik" via network
ipmitool ... mac get 1 | head             # MAC BMC (untuk jaringannya)
```

Pola operasional:
- **BMC di jaringan terpisah** (management VLAN) — jangan campur dengan VM traffic.
- `sol activate` saat `ipmitool power status` = `on` tapi OS tidak respons: lihat console, sering kali kernel panic / boot loop.
- `sel list` untuk korelasi: "PSU1 failed 3 hari lalu" + "host down sekarang".

## 6. Playbook: maintenance compute node

```
1. Zabbix: maintenance window (host node + semua VM di atasnya).
2. Drain: live-migrate semua VM keluar (ZStack UI atau virsh migrate).
3. Konfirmasi: `virsh list --all` (atau ZStack: node kosong).
4. Shutdown node: `virsh kvm:shutdown` (ACPI) / `ipmitool power off`.
5. Kerjakan (update kernel, ganti RAM, firmware).
6. Boot, `systemctl status zstack-kvm` (atau KVM service), verifikasi:
   - kernel: `uname -r` sesuai target
   - multipath: semua LUN visible
   - OVS: bridge up, port OK
   - `virsh list` kosong
7. ZStack: node join cluster, health check, hapus maintenance window.
8. Smoke test: VM test boot + I/O baseline.
```

> [!danger]
> Jangan maintenance node yang punya VM dengan **disk lokal** (non-shared storage). Migrate tidak bisa — butuh snapshot + copy, RTO berubah dari menit ke jam. Inventarisasi VM disk-lokal di ZStack sebelum maintenance window.

## 7. Baseline & monitoring hypervisor

Item Zabbix per compute node:
- Host: load, mem, CPU steal (untuk host VM), disk I/O (iostat), NFS/iSCSI latency.
- VM count: `virsh list --all | grep -c running`.
- Storage pool: capacity + growth rate (alert > 85%).
- NIC: drop/error counter.
- OVS: `ovs-vsctl show` — port state.

Drill kuartalan: live-migrate semua VM di satu node (uji shared storage + OVS + ZStack), catat RTO aktual.
