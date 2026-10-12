# 02 — Networking

Semua di sini RHEL 9: `NetworkManager` + `nmcli`, `iproute2`, `nftables` (firewalld di atasnya), `ss`. Tidak ada `ifconfig`/`route`/`iptables-legacy` di bab ini.

## 1. Dasar iproute2

```bash
ip -br link; ip -br -4 addr        # status ringkas semua NIC
ip route show table all            # semua route termasuk policy
ip neigh show                      # ARP table
ss -tulnp                          # socket listening + owner process
ss -tin state established          # detail TCP: rtt, cwnd, retrans
```

## 2. NetworkManager & nmcli

### NIC statis (pola server)

```bash
nmcli con add type eth ifname enp1s0 con-name enp1s0-static \
  ipv4.addresses 172.31.252.10/24 ipv4.gateway 172.31.252.1 \
  ipv4.dns "10.0.0.2 10.0.0.3" ipv4.method manual
nmcli con modify enp1s0-static connection.autoconnect yes
nmcli con up enp1s0-static
nmcli -f ip4.address,ip4.gateway,ip4.dns con show enp1s0-static
```

### Bonding 802.3ad (LACP) — pola standar server dual-NIC

```bash
nmcli con add type bond con-name bond0 ifname bond0 \
  bond.options "mode=802.3ad,miimon=100" \
  ipv4.addresses 172.31.252.10/24 ipv4.gateway 172.31.252.1 ipv4.method manual
nmcli con add type eth con-name bond0-slave1 ifname enp1s0 master bond0
nmcli con add type eth con-name bond0-slave2 ifname enp2s0 master bond0
nmcli con up bond0
```

Mode bonding yang perlu diketahui: `active-backup` (1, tanpa switch config), `balance-rr` (2), `802.3ad` (4, LACP — butuh switch side). Verifikasi:

```bash
cat /proc/net/bonding/bond0         # state slave, MII monitor, LACP du
ethtool enp1s0 | grep Speed         # pastikan link up 10G/25G di kedua port
```

> [!danger]
> Bond `802.3ad` tanpa konfigurasi LACP di switch = trafik hilang-hilang. Kalau switch-nya tidak mendukung LACP, pakai `active-backup`. Cek `cat /proc/net/bonding/bond0`: bagian "802.3ad info" harus menunjukkan partner switch.

### VLAN

```bash
nmcli con add type vlan con-name vlan100 ifname bond0.100 vlan.id 100 \
  ipv4.addresses 10.100.0.5/16 ipv4.method manual
```

### MTU & jumbo frame

```bash
nmcli con modify bond0 802-3-ethernet.mtu 9000
ip link set bond0 mtu 9000
# Tes end-to-end (packet harus lebih besar dari MTU path default 1500):
ping -M do -s 8972 <host-remote>     # -M do = DF bit on
```

> [!warning]
> Jumbo frame harus konsisten di **seluruh path** (host → switch → LUN target). Satu hop 1500 di tengah = fragmentasi/loss yang cuma muncul di workload besar.

## 3. nftables & firewalld

RHEL 9: kernel-nya nftables; `firewalld` adalah frontend-nya yang persisten. Dua level: firewalld (default) dan `nft` langsung (kalau butuh kontrol penuh).

### firewalld (hari-hari)

```bash
firewall-cmd --state; firewall-cmd --list-all
firewall-cmd --permanent --add-port=3002/tcp
firewall-cmd --permanent --add-rich-rule='rule family=ipv4 source address=172.31.0.0/16 port port=5432 protocol=tcp accept'
firewall-cmd --reload
firewall-cmd --permanent --query-rich-rule='...'   # audit sebelum reload
```

Rich rules: `source`, `port`, `protocol`, `accept/reject/drop`, bisa digabung. `--add-forward-port=port=80:prot=tcp:toport=3002:toaddr=127.0.0.1` untuk NAT sederhana.

### nftables langsung (advanced)

```bash
nft list ruleset                         # state saat ini (live)
nft list ruleset > ruleset.bak           # backup sebelum ubah
nft add table inet filter
nft add chain inet filter input { type filter hook input priority 0 ; policy accept ; }
nft add rule inet filter input ip saddr 172.31.0.0/16 tcp dport 22 accept
nft list chain inet filter input
```

File persisten: `/etc/nftables/nftables.conf` (dieksekusi saat boot via `nftables.service`).

> [!danger]
> Jangan jalankan `nft flush ruleset` di server produksi yang firewalld-nya aktif — firewalld akan rewrite ulang, tapi aturan custom kalian hilang dalam sekejap. Selalu `nft list ruleset > backup` dulu.

### Cek siapa yang drop paket

```bash
nft -a list ruleset | head              # -a = handle angka (untuk delete rule spesifik)
iptables -L -n -v                        # hanya untuk kompatibilitas; jangan configure dual-stack legacy
nft monitor                              # log event real-time
```

## 4. DNS & resolved

RHEL 9: `systemd-resolved` aktif, `/etc/resolv.conf` → symlink ke `run/systemd/resolve/stub-resolv.conf` (127.0.0.53).

```bash
resolvectl status                 # server, DNSSEC, domain
resolvectl query host.internal    # test resolve via resolved
dig @10.0.0.2 host.internal +short
```

> [!warning]
> Jangan hardcode `127.0.0.53` di config aplikasi/container — itu stub resolved, hanya valid di host itu. Pakai IP DNS server riil.

## 5. VRRP (IP floating) — keepalived

Pola: dua node, IP virtual 172.31.252.100 floating antara keduanya.

```bash
dnf install keepalived
```

`/etc/keepalived/keepalived.conf` (node 1):

```
vrrp_instance VI_1 {
    state MASTER
    interface bond0
    virtual_router_id 51
    priority 101
    advert_int 1
    virtual_ipaddress {
        172.31.252.100/24
    }
}
```

Node 2: `state BACKUP`, `priority 99`. Cek: `vrrp_ipaddr` via Zabbix (agent2 plugin), atau `ip -br addr | grep 100`.

## 6. Troubleshooting — playbook

### "Tidak bisa akses layanan X di host Y"

Berurutan, dari dekat ke jauh:

```bash
ping -c3 <ip>                      # layer 3 (biar tidak terlalu percaya: ICMP bisa di-drop)
ss -tlnp | grep :<port>            # service listen di Y? 0.0.0.0 atau 127.0.0.1 saja?
firewall-cmd --list-all            # port dibuka?
nft list ruleset | grep -A2 drop   # rule drop eksplisit?
tcpdump -i bond0 -nn port <port> -c 20   # SYN masuk? RTO? reset?
traceroute -T -p <port> <ip>       # path UDP/TCP-aware
mtr -T -P <port> -c 30 <ip>        # loss di hop mana
```

Interpretasi tcpdump: SYN masuk tapi tidak ada SYN-ACK → service penuh accept queue (`net.core.somaxconn`), atau drop di middlebox. RST cepat → service menolak (bind address salah, auth di layer 4).

### "Latency naik, throughput turun"

```bash
ss -ti | grep <peer>               # rtt, cwnd, retrans: retrans/bytes_sent > 1% = masalah
ethtool -S enp1s0 | grep -E "drop|error|discard"   # counter NIC
cat /proc/net/softnet_stat         # column 2 != 0 → ksoftirqd drop (CPU)
cat /proc/sys/net/netfilter/nf_conntrack_count vs /proc/sys/net/netfilter/nf_conntrack_max
```

> [!info]
> `nf_conntrack: table full, dropping packet` di dmesg = firewall stateful kehabisan slot. Naikkan `net.netfilter.nf_conntrack_max` atau kurangi lifetime (`nf_conntrack_tcp_timeout_time_wait`).

### "MTU black hole"

Simptom: ping biasa (56B) OK, ping `-s 1472` loss 100%, tapi `traceroute` OK. Path-nya punya hop dengan MTU < path host dan DF bit on. Tes binary search size, lalu perbaiki di hop yang bermasalah (biasanya tunnel/gateway).

## 7. Performance baseline jaringan

```bash
# Bandwidth + latency antar host (jaga: 2 arah, beberapa menit)
iperf3 -s &                          # server
iperf3 -c <ip> -t 30 -P 4 -f g       # client: 4 parallel
iperf3 -c <ip> -t 30 -f g -1         # + loss test (UDP)
```

Baseline sehat 10GbE: ~11.8 Gbps per arah, p99 latency < 0.1 ms di LAN. Simpan hasil di Zabbix (item custom) supaya degradasi fisik (cable, SFP) terdeteksi sebelum komplain.

## 8. Checklist konfigurasi server baru

1. `nmcli con show` — semua NIC static IP, `autoconnect yes`.
2. Bond: `cat /proc/net/bonding/bond0` — kedua slave `up`.
3. `ip route` — default route tepat satu; `ip route show table all` tidak ada route duplicate.
4. `resolvectl status` — DNS server riil, bukan stub.
5. `firewall-cmd --list-all` — hanya port yang dibutuhkan (default: 22 + service publik).
6. `nft list ruleset` — tidak ada rule orphan dari eksperimen lama.
7. `ethtool <nic>` — speed/duplex sesuai (10G/25G full duplex), counter error = 0.
8. NTP: `chronyc tracking` — stratum < 4, offset < 10 ms.
