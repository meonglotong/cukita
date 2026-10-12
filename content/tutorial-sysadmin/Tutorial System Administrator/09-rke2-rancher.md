# 09 — RKE2 & Rancher

Instal RKE2 di RHEL 9, pasang Rancher (latest stable), import cluster RKE2 ke Rancher, dan rename cluster `local` jadi nama yang kita mau.

> [!info]
> Versi yang dipakai di bab ini (stable per Okt 2026): **RKE2 v1.37.1+rke2r1** (K8s 1.37.1, containerd 2.3.4) dan **Rancher v2.15.2**. Cek [release notes RKE2](https://docs.rke2.io/release-notes) dan [release Rancher](https://github.com/rancher/rancher/releases) sebelum eksekusi — angka bisa bergeser.

## 1. Persiapan RHEL 9 (per node)

```bash
# Hostname & IP statis (pola dari bab 02)
hostnamectl set-hostname k8s-cp-01
nmcli con modify bond0 ipv4.addresses 172.31.252.61/24 ipv4.method manual
nmcli con up bond0

# NTP
systemctl enable --now chronyd
chronyc tracking

# Swap OFF — kubelet menolak start kalau swap aktif
swapoff -a
sed -i.bak '/^#/!s/^swap/#&/' /etc/fstab   # atau comment manual

# Sysctl: install script RKE2 akan menulis /etc/sysctl.d/99-rke2-cni.conf
# (net.bridge.bridge-nf-call-iptables, ip_forward, dst src routes).
# Modul bridge wajib ada:
modprobe br_netfilter
echo br_netfilter > /etc/modules-load.d/bridge.conf
```

SELinux: **biarkan enforcing** (jangan setenforce 0 di production). Di RHEL, RKE2 butuh flag `selinux: true` di config agar containerd pakai label SELinux (lihat langkah 3).

Firewall (jalankan setelah CIDR pod/service ditentukan — default RKE2: pod `10.42.0.0/16`, service `10.43.0.0/16`):

```bash
firewall-cmd --permanent --add-port={6443,2379-2380,10250,10257}/tcp
firewall-cmd --permanent --add-port=30000-32767/tcp          # NodePort
firewall-cmd --permanent --add-port=8472/udp                 # VXLAN (canal/calico)
firewall-cmd --permanent --add-rich-rule='rule family=ipv4 source address=10.42.0.0/16 accept'
firewall-cmd --permanent --add-rich-rule='rule family=ipv4 source address=172.31.252.0/24 accept'
firewall-cmd --reload
```

## 2. Install RKE2 (control plane)

```bash
# Pin versi (opsional; tanpa RKE2_VERSION = latest stable)
curl -sfL https://get.rke2.io | RKE2_VERSION=v1.37.1+rke2r1 sh -
```

Config server:

```yaml
# /etc/rancher/rke2/config.yaml
data-dir: /var/lib/rancher/rke2
cluster-cidr: 10.42.0.0/16
service-cidr: 10.43.0.0/16
selinux: true                # RHEL: containerd pakai label SELinux
tls-san:
  - 172.31.252.61            # IP + hostname yang dipakai akses apiserver
  - k8s-cp-01
token: <token-64-hex>        # atau biarkan: token random di-generate (WAJIB disimpan)
```

```bash
systemctl enable rke2-server
systemctl start rke2-server
journalctl -u rke2-server -f        # pantau sampai "node up"
```

Kubeconfig:

```bash
sudo cp /etc/rancher/rke2/rke2.yaml ~/.kube/config
sudo chown $USER ~/.kube/config
kubectl get nodes                          # NotReady → Running (30-90 detik)
cat /var/lib/rancher/rke2/server/token    # simpan: join agent + restore etcd
```

> [!warning]
> Kalau tidak di-set `token` di config, RKE2 meng-generate token random. Token itu dipakai agent join **dan** encrypt bootstrap data di datastore. Hilang = agent baru tidak bisa join + restore etcd ribet. Simpan di password manager.

## 3. Join agent (worker)

```bash
curl -sfL https://get.rke2.io | RKE2_VERSION=v1.37.1+rke2r1 sh -

# /etc/rancher/rke2/config.yaml (agent)
# selinux: true

# Token di-copy dari control plane:
scp k8s-cp-01:/var/lib/rancher/rke2/server/token /var/lib/rancher/rke2/agent/token

systemctl enable rke2-agent
systemctl start rke2-agent
# (di control plane) kubectl get nodes --watch
```

> [!danger]
> Nilai `cluster-cidr`, `service-cidr`, `token`, dan `disable-*` **harus identik di semua node**. Beda salah satu = node tidak join (atau join tapi networking rusak).

## 4. Verifikasi cluster sehat

```bash
kubectl get nodes -o wide
kubectl get pods -A | grep -v Running        # harus kosong (setelah ~2 menit)
kubectl get svc -n kube-system kube-dns      # ClusterIP 10.43.0.10
# Smoke test pod:
kubectl run ct --rm -it --image=rancher/mirrored-pause:3.6 --restart=Never -- sh -c 'nslookup kubernetes.default.svc.cluster.local'
```

## 5. Install Rancher v2.15.2 (Helm di RKE2)

Pola production: Rancher jalan di atas cluster RKE2 (bisa cluster khusus 3-node kecil, atau cluster yang sama).

```bash
# Repo & namespace
helm repo add rancher-latest https://charts.rancher.com
helm repo update
kubectl create namespace cattle-system

# Sertifikat (self-signed untuk internal, atau dari CA internal):
openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout tls.key -out tls.crt -subj "/CN=rancher.internal.local"
kubectl -n cattle-system create secret tls tls-rancher-ingress \
  --cert=tls.crt --key=tls.key

# Install (pin image v2.15.2)
helm install rancher rancher-latest/rancher \
  --namespace cattle-system \
  --set hostname=rancher.internal.local \
  --set replicas=1 \
  --set rancherImage=rancher/rancher:v2.15.2
```

Ambil password bootstrap:

```bash
kubectl -n cattle-system get secret bootstrap-password \
  -o jsonpath="{.data.bootstrapPassword}" | base64 -d
```

Login `https://rancher.internal.local` dengan `admin` + password bootstrap → wajib setup admin account (email + password baru).

> [!info]
> **Pola alternatif (dev/quick): Docker install** — `docker run -d --restart=always --privileged -v /var/lib/rancher:/var/lib/rancher -p 443:443 docker.io/rancher/rancher:v2.15.2`. Simpel, tapi state di volume Docker; untuk production pakai Helm di RKE2 (etcd di belakang, upgrade rapi, HA 3-node).

## 6. Import cluster RKE2 ke Rancher

Di Rancher 2.15, fitur import sekarang bernama **Import Existing** (bagian dari cluster registration).

1. `☰ → Cluster Management → Clusters → Import Existing`
2. Pilih tipe cluster (Rancher otomatis mengenali RKE2).
3. *(Opsional)* Member Roles: tambah user + role untuk cluster ini.
4. *(Opsional)* Advanced Options: Project Network Isolation (jika pakai NetworkPolicy).
5. **Create** → Rancher menampilkan perintah `kubectl apply`.
6. Jalankan di node RKE2 (di mana kubeconfig cluster itu bisa diakses):

```bash
KUBECONFIG=/etc/rancher/rke2/rke2.yaml \
  kubectl -n cattle-cluster-local apply -f https://rancher.internal.local/v3/import/<uuid>.yaml
```

Perintah itu deploy `cattle-cluster-agent` ke cluster — agent ini yang menjaga koneksi Rancher ↔ cluster. Kalau self-signed cert Rancher, pakai varian `curl -k ... | kubectl apply -f -` yang juga ditampilkan di UI.

7. Back ke UI → **Done**. Cluster masuk state **Pending** → **Active** (1-2 menit).

Setelah Active, cluster punya 2 project otomatis: `Default` dan `System`.

> [!warning]
> Cluster yang sudah Active tidak bisa di-register ulang di instance Rancher yang sama. Mau ganti nama/setting? Edit — bukan import ulang. Mau pindah instance Rancher? Deregister dulu (hapus cluster dari Rancher — cluster fisik TIDAK mati, hanya lepas dari manajemen).

### Version management (fitur untuk imported RKE2/K3s)

Di setting global `imported-cluster-version-management`:
- **Global default / True** → Rancher boleh upgrade K8s cluster ini (system-upgrade-controller di-deploy downstream, ada upgrade strategy: concurrency controlplane/worker).
- **False** → upgrade K8s dilakukan manual via RKE2 (`rke2-up` / install script), Rancher tidak ikut campur.

Pilih sadar: kalau tim lu upgrade K8s via Rancher, matikan upgrade manual; sebaliknya.

## 7. Rename cluster `local` → nama yang diinginkan

Konteks: RKE2 tidak punya flag `cluster-name` (berbeda dengan k3s) — nama cluster default-nya `local`, dan Rancher mengadopsi nama itu saat import. Rename dilakukan **di sisi Rancher**, bukan di RKE2.

### Opsi 1: UI (Rancher ≥ 2.8)

1. `☰ → Cluster Management → Clusters`
2. Klik cluster → `⋮ → Edit Cluster`
3. Ganti **Name** (misal `prod-k8s-01`) → **Save**.

> [!warning]
> Di Rancher 2.7.x ada bug: rename imported cluster via UI tidak selalu mengambil efek ([issue #41858](https://github.com/rancher/rancher/issues/41858)). Kalau nama tidak berubah setelah save, pakai Opsi 2.

### Opsi 2: kubectl di server Rancher (fallback pasti)

```bash
# Lihat management cluster
kubectl get cluster -A | grep local
# cattle-cluster-local   local   Active   ...

# Rename: edit metadata.name
kubectl -n cattle-cluster-local edit cluster local
```

```yaml
metadata:
  name: prod-k8s-01      # ganti dari "local"
```

UI langsung menampilkan nama baru. Yang **tidak** ikut berubah:

- Namespace `cattle-cluster-local` (tetap — normal, tidak perlu rename).
- Internal identity downstream: kubeconfig, context, nama node — tidak tersentuh.
- Project (`Default`/`System`) dan resource di dalamnya — aman.

> [!info]
> Rename hanya soal display/identity di Rancher API (`/v1/clusters/<name>`). Tidak ada downtime, tidak ada impact ke workload. Tapi: lakukan di maintenance window kecil dan jangan di tengah upgrade — resource sementara bisa reference nama lama.

## 8. Operasional setelah import

```bash
# Cek agent
kubectl -n cattle-cluster-local get pods    # cattle-cluster-agent Running

# Monitoring: enable di UI (Cluster → ⋮ → Enable Monitoring) → Zabbix/Grafana pipeline (bab 06)
# Backup state Rancher: state di etcd cluster RKE2-nya
rke2-etcd-snapshot take        # di node RKE2 yang menjalankan Rancher
rke2-etcd-snapshot list
```

Checklist pasca-setup:

1. `kubectl get nodes` di cluster target: semua `Ready`.
2. Rancher UI: cluster `Active`, monitoring enabled.
3. Nama cluster sesuai konvensi tim (bukan `local`).
4. Token RKE2 + bootstrap password Rancher + sertifikat TLS: tersimpan di secret manager.
5. etcd snapshot terjadwal (`etcd-snapshot-schedule-cron` default: 12 jam) + alert Zabbix (bab 06).
6. DR: dokumentasikan `rke2-etcd-snapshot save` / `cluster-reset-restore-path` (bab 07).
