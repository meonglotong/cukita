# 06 — Monitoring & Observability

Stack observability kita: **Zabbix** (metric + alert), **Grafana** (dashboard visual), journald/logrotate untuk log. Prinsip: setiap alert harus punya runbook; setiap runbook harus bisa dieksekusi orang shift malam.

## 1. Zabbix agent 2 — install & konfigurasi

```bash
dnf install zabbix-agent2
# /etc/zabbix/zabbix_agent2.conf:
# Server=172.31.252.50            # IP server Zabbix (passive)
# ServerActive=172.31.252.50       # active (lebih hemat di banyak host)
# HostMetadata=server-rhel9        # auto-registration tag
systemctl enable --now zabbix-agent2
zabbix_get -s 127.0.0.1 -k agent.version
```

### UserParameter (custom metric)

```bash
# /etc/zabbix/zabbix_agent2.d/conf.d/local.conf
UserParameter=vm.zstack.count,vmsh list --all | grep -c running
UserParameter=disk.nas.free,df --output=avail /mnt/nas | tail -1
UserParameter=service.cukita.status,/usr/bin/curl -sf -m 5 -o /dev/null -w '%{http_code}' http://127.0.0.1:3102/login
```

Cek dari server: `zabbix_get -s <host> -k disk.nas.free`.

> [!info]
> Aturan main: **metric murah** (read /proc, df) = interval 30-60s. **Metric mahal** (curl endpoint, query DB) = interval 5 menit. Jangan semua 1 menit — flood server Zabbix.

### LLD (auto-discovery) — disk, NIC, mount

Zabbix agent 2 bawaan mendukung LLD untuk `vfs.filesystem.*`, `net.if.*`, `system.run`. Di frontend: create template dengan LLD rule, dan disk/NIC baru terdeteksi otomatis tanpa edit template.

## 2. Zabbix server-side: item → trigger → alert

### Pola item yang benar

- Item key: `vfs.fs.size[/data,used,pcent]` (bawaan) atau UserParameter.
- **Update interval sesuai mahal/tidaknya** (lihat atas).
- History vs Trends: history 7 hari (resolusi 1 menit), trends 1 tahun (resolusi 1 jam) — default sudah oke.

### Trigger expression (Zabbix 6.0+)

```
# Disk > 85% dalam 10 menit
last(/srv/vfs.fs.size[/,used,pcent])>85 and avg(/srv/vfs.fs.size[/,used,pcent],10m)>80

# Service down 2 kali cek berturut
count(/srv/web.service.cukita.status,not=200,2m)=2

# Memory pressure (PSI)
avg(/srv/proc.mem.pressure[full,10m])>20
```

Prinsip trigger: **hindari flapping** — pakai `and avg(...,10m)` atau `min(...,10m)=...`, bukan `last()>X` saja.

### Alerting & escalation

1. Zabbix action → media (email) untuk warning.
2. Page (SMS/voice/Telegram bot) untuk high/disaster.
3. Escalation: tidak di-ack 15 menit → naik ke oncall berikutnya.
4. **Maintenance window** saat deploy: `zabbix` maintenance per-host group, 30 menit.

> [!danger]
> Alert tanpa runbook = noise. Setiap trigger baru WAJIB punya link ke halaman runbook di CUKITA. Kalau runbook-nya "cek dulu", itu bukan runbook.

## 3. Grafana — dashboard & provisioning

Data source: Zabbix (plugin) atau Prometheus (jika tambah node_exporter). Pola dashboard yang berguna:

1. **Overview per host group**: CPU, mem, disk, net (panel summary + sparkline).
2. **Service dashboard**: latency (p50/p95/p99), error rate, throughput — golden signals.
3. **Hardware**: SMART temp, fan, PSU (via IPMI sensor → Zabbix).
4. **Storage**: LUN IOPS/latency, NFS throughput.

Provisioning (bukan klik-klik manual):

```yaml
# /etc/grafana/provisioning/datasources/zabbix.yaml — register via file
# Dashboard: version-control di repo (grafana-dashboards/), sync via API
curl -H "Authorization: Bearer $GF_TOKEN" -H "Content-Type: application/json" \
  -d @dashboard.json -X POST http://localhost:3000/api/dashboards/import
```

> [!info]
> Dashboard yang di-build manual di UI = hilang saat reinstall. Semua dashboard produksi harus as-code di repo + import script.

## 4. Log: journald + rotasi

```bash
# /etc/systemd/journald.conf
[Journal]
Storage=persistent
SystemMaxUse=2G
ForwardToSyslog=no
RateLimitIntervalSec=30s
RateLimitBurst=1000

journalctl --disk-usage
journalctl --vacuum-time=7d
journalctl -u <svc> -o json --since "1 hour ago" | jq 'select(.SYSLOG_IDENTIFIER=="app")'
```

Pola:
- Log aplikasi → journal (stdout/stderr service) atau file + journald forwarder.
- File log besar (nginx access): logrotate (`/etc/logrotate.d/nginx`), `copytruncate` untuk app yang tidak support reopen.
- Untuk agregasi cross-host: ship ke Loki (Grafana) — `promtail`/`alloy` per host, query LogQL di Grafana.

> [!warning]
> `RateLimit` di journald bukan optional: satu process yang log-flood (100k line/s) bisa makan semua disk I/O server. `RateLimitBurst` + alert "journal rate-limited" = proteksi.

## 5. Hardware monitoring (server fisik)

```bash
ipmitool sdr type temperature
ipmitool sdr type fan
ipmitool sensor list | grep -E "temp|fan|psu"
ipmitool sel list | tail -20        # event log (pasti, throttle, PSU)
```

Zabbix: `ipmi.sdr[temperature]` via UserParameter, trigger temp > 35C (CPU) / fan RPM drop > 30%. SEL event → trigger "hardware event baru".

## 6. Golden signals per service

Untuk setiap service publik (CUKITA, API, NAS), 4 panel wajib:

| Sinyal | Metric | Alert |
|---|---|---|
| Latency | p95 response time | > 2x baseline 5 menit |
| Traffic | request rate | drop > 50% dari baseline (atau spike > 3x) |
| Errors | 5xx rate | > 1% dari request 5 menit |
| Saturation | conntrack, file desc, mem | > 80% |

## 7. Runbook: alert masuk, 5 menit pertama

```bash
# 1. Scope-kan: host apa, service apa?
zabbix_get -s <host> -k system.hostname
# 2. Cek vital (satu perintah, semua yang penting):
ssh <host> 'uptime; free -h; df -h / /data; iostat -xm 1 3 | tail -8; ss -tlnp | grep <port>'
# 3. Cek log terbaru:
ssh <host> 'journalctl -u <svc> --since "5 minutes ago" --no-pager | tail -30'
# 4. Cek hardware (kalau suspect fisik):
ssh <host> 'dmesg -T | tail -20; ipmitool sel list | tail -5'
# 5. Keputusan: restore dari backup / restart service / escalate storage team
```

> [!danger]
> 5 menit pertama untuk **diagnosis**, bukan **fix**. Fix tanpa diagnosis = fix kedua kali dua jam kemudian. Catat angka awal (uptime, load, df) sebelum melakukan apa pun — itu baseline kalian.
