# CUKITA — Catatan Untuk Kita

Knowledge base internal tim: semua dokumentasi (panduan, runbook, catatan meeting) numpuk di satu tempat, bisa dicari, dan bisa diedit siapa saja yang login.

## Fitur

- **Editor WYSIWYG ala Notion** — halaman = editor langsung: auto-save, title = baris pertama, slash command (`/`), paste/drag gambar + resize
- **Pohon halaman** dengan section, pencarian, dan TOC ("On this page") yang klik-nya ng-scroll
- **Light / dark mode** — toggle di top bar, preferensi tersimpan di browser (default: ikut sistem)
- **Auth** email/password (NextAuth), role admin untuk manajemen user
- Konten tersimpan sebagai **Markdown** di PostgreSQL; gambar di disk

## Tech

Next.js 15 (App Router) · React 19 · TypeScript · PostgreSQL · Tiptap 3 (WYSIWYG) · NextAuth 5

## Menjalankan (dev)

```bash
pnpm install
cp .env.local.example .env.local   # isi DATABASE_URL
pnpm migrate
pnpm seed:admin
pnpm dev                            # http://localhost:3002
```

## Test

```bash
pnpm test
```
