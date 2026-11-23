# ERP Distributor: Frontend

Antarmuka web untuk ERP distributor sederhana (satu gudang). Backend: `../backend` (Laravel REST API).

## Tech stack

React (Vite), Tailwind CSS v3, React Router, TanStack Query, Axios, lucide-react.

## Menjalankan

Prasyarat: Node 20.19+ atau 22.12+, dan backend sudah jalan di `http://127.0.0.1:8000`.

```bash
cd frontend
npm install
cp .env.example .env
npm run dev          # http://localhost:5173 (request /api diteruskan ke backend lewat proxy Vite)
```

| Perintah          | Fungsi                              |
| ----------------- | ----------------------------------- |
| `npm run dev`     | Dev server                          |
| `npm run build`   | Build produksi ke `dist/`           |
| `npm run preview` | Menyajikan hasil build secara lokal |
| `npm run lint`    | Cek kode dengan ESLint              |

## Variabel lingkungan

Semua diawali `VITE_` dan **ditanam saat build** (bukan dibaca saat jalan).

| Variabel                                           | Fungsi                                                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `VITE_API_URL`                                     | Kosong = pakai proxy dev (`/api`). Produksi: URL backend, misal `https://api.contoh.com/api` |
| `VITE_SHOW_DEMO_ACCOUNTS`                          | `true` = tampilkan tombol akun demo di halaman login                                         |
| `VITE_COMPANY_NAME`, `_ADDRESS`, `_PHONE`, `_BANK` | Identitas di dokumen cetak invoice                                                           |

Akun demo: lihat README backend (`<role>@erp.test`, password `password`).

## Struktur

```
src/
  api/          pemanggilan endpoint (satu file per modul) + client Axios
  auth/         AuthProvider, ProtectedRoute, daftar role dan hak akses
  components/   layout, komponen UI umum, dan komponen per modul
  config/       menu sidebar dan konfigurasi master data
  hooks/        useListParams (filter dan halaman di URL), useDebouncedValue
  lib/          format angka/tanggal, status, utilitas
  pages/        satu file per halaman
```

## Konvensi

- **Filter dan halaman daftar disimpan di URL**, jadi refresh, tombol back, dan berbagi link bekerja.
- **Angka uang selalu string dari backend** dan tidak dihitung ulang di frontend. Satu-satunya perkiraan ada di form PO/SO, dan diberi label "estimasi".
- **Hak akses di UI hanya kosmetik** (menyembunyikan menu dan tombol). Yang memutuskan tetap middleware dan service di backend.
- Token API disimpan di `localStorage` dan kedaluwarsa dalam 8 jam (diatur di backend). Tidak ada HTML mentah yang dirender dari input user.

## Deploy

1. Isi `VITE_API_URL` di pengaturan host, lalu `npm run build`.
2. Host statis butuh aturan fallback ke `index.html` (sudah ada di `vercel.json`).
3. Di backend, isi `CORS_ALLOWED_ORIGINS` dengan URL frontend.

## Batasan

Belum ada: ekspor CSV/Excel, import massal master data, lampiran dokumen, kartu stok dengan saldo awal/akhir di UI (endpoint-nya sudah ada), tes otomatis frontend (tes backend: 57 tes), dan antarmuka multi-bahasa.
