# ERP Distributor: Backend API

REST API untuk ERP sederhana perusahaan distributor (satu gudang): master data, stok, pembelian (PO), penjualan (SO + invoice), pembayaran, biaya operasional, dan laporan dasar.

Frontend ada di `../frontend` (React + Tailwind CSS v3).

## Tech stack

| Bagian    | Teknologi                                          |
| --------- | -------------------------------------------------- |
| Framework | Laravel LARAVEL_VERSION                            |
| Bahasa    | PHP PHP_VERSION                                    |
| Database  | MySQL (dijalankan lewat Laragon)                   |
| Auth      | Laravel Sanctum (Bearer token), RBAC dengan 6 role |
| Test      | PHPUnit, database test MySQL terpisah              |

## Instalasi

Prasyarat: Laragon (PHP, MySQL, Composer), Git.

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Buat database (HeidiSQL/phpMyAdmin, atau `mysql -u root -e "CREATE DATABASE erp_distributor CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"`), lalu atur `.env`:

```env
APP_TIMEZONE=Asia/Jakarta
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=erp_distributor
DB_USERNAME=root
DB_PASSWORD=
```

Migrate, seed, dan jalankan:

```bash
php artisan migrate:fresh --seed                  # skema + role + master data + akun demo
php artisan db:seed --class=DemoDataSeeder        # opsional: 90 hari transaksi demo
php artisan serve                                 # http://127.0.0.1:8000
```

## Akun demo

Password semua akun: `password` (hanya untuk lokal).

| Role        | Email                |
| ----------- | -------------------- |
| Admin       | admin@erp.test       |
| Sales       | sales@erp.test       |
| Gudang      | warehouse@erp.test   |
| Procurement | procurement@erp.test |
| Finance     | finance@erp.test     |
| Owner       | owner@erp.test       |

Login: `POST /api/auth/login` dengan `{"email", "password"}`, lalu kirim `Authorization: Bearer <token>` dan `Accept: application/json` di setiap request.

## Hak akses

| Modul                              | Baca                                         | Tulis                                                                                                            |
| ---------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Kategori, satuan, supplier, produk | Semua role                                   | Admin, Procurement                                                                                               |
| Customer                           | Semua role                                   | Admin, Sales                                                                                                     |
| Stok (daftar, riwayat)             | Semua role                                   | Stock In/Out manual: Admin, Gudang                                                                               |
| Purchase Order                     | Admin, Procurement, Gudang, Finance, Owner   | Buat/ubah/batal: Admin, Procurement. Setujui: Admin, Owner. Terima barang: Admin, Gudang                         |
| Sales Order                        | Admin, Sales, Gudang, Finance, Owner         | Buat/ubah/konfirmasi/batal: Admin, Sales. Barang keluar: Admin, Gudang. Batal setelah barang keluar: hanya Admin |
| Invoice                            | Admin, Sales, Finance, Owner                 | Dibuat otomatis saat barang keluar                                                                               |
| Pembayaran, biaya                  | Admin, Finance, Owner                        | Admin, Finance                                                                                                   |
| Laporan                            | Admin, Finance, Owner (kartu stok: + Gudang) | n/a                                                                                                              |

## Alur dan aturan bisnis

- **Pembelian:** `draft` → `approved` → `received` (atau `cancelled`). Stok bertambah **hanya** saat barang diterima, dalam satu transaksi database dengan perubahan status.
- **Penjualan:** `draft` → `confirmed` → `issued` (atau `cancelled`). Konfirmasi hanya **mengecek** stok (tanpa reservasi). Stok berkurang saat barang keluar, dan invoice dibuat otomatis.
- **Stok tidak pernah negatif:** dijaga di SQL (`UPDATE ... WHERE saldo + delta >= 0`) dan `CHECK` constraint.
- **Ledger stok immutable:** setiap perubahan = 1 baris `stock_movements`. Saldo harus sama dengan jumlah movement.
- **Pembatalan SO setelah barang keluar:** stok dikembalikan lewat movement baru, invoice di-void. Ditolak jika invoice sudah ada pembayaran.
- **Pembayaran:** tidak boleh melebihi sisa tagihan. Salah input dikoreksi dengan **void** (alasan wajib), bukan edit.
- **Total dihitung database** (generated column), bukan PHP. Tidak ada aritmetika uang float.
- **Nomor dokumen** (`PO-202611-0001`, `SO-`, `INV-`, `PAY-`, `EXP-`) berurutan per bulan, tanpa lompatan.

## Endpoint utama

Semua di bawah `/api`. List mendukung `search`, `per_page` (maks 100), dan filter spesifik; response berbentuk `{data, links, meta}`. Error validasi `422 {message, errors}`, konflik status `409`, tanpa akses `403`.

| Grup    | Endpoint                                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------ |
| Auth    | `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`                                                      |
| Master  | `/categories`, `/units`, `/suppliers`, `/customers`, `/products` (CRUD)                                      |
| Stok    | `GET /stocks` (`?low_stock=1`), `GET /stocks/{product}/movements`, `POST /stocks/in`, `POST /stocks/out`     |
| PO      | `/purchase-orders` (CRUD kecuali hapus), `POST .../approve`, `.../receive`, `.../cancel`                     |
| SO      | `/sales-orders`, `POST .../confirm`, `.../issue`, `.../cancel`                                               |
| Invoice | `GET /invoices`, `GET /invoices/{id}`                                                                        |
| Finance | `POST /invoices/{id}/payments`, `GET /payments`, `POST /payments/{id}/void`, `/expenses` (+ `POST .../void`) |
| Laporan | `/reports/summary`, `/sales`, `/purchases`, `/receivables`, `/expenses`, `/stock-card`                       |

## Definisi laporan

| Laporan                 | Definisi                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------- |
| Penjualan               | Invoice `active` (void tidak dihitung), berdasarkan tanggal invoice                     |
| Pembelian               | PO `received` (default), berdasarkan tanggal PO                                         |
| Piutang                 | Snapshot hari ini: invoice `active` yang masih ada sisa. Umur dihitung dari jatuh tempo |
| Biaya, pembayaran masuk | Yang berstatus `active`, berdasarkan tanggal transaksi                                  |
| Kartu stok              | Saldo awal, mutasi, saldo akhir dari ledger stok                                        |

## Testing

Tes memakai database MySQL **terpisah** (`erp_distributor_test`) karena logika stok bergantung pada perilaku MySQL.

```bash
mysql -u root -e "CREATE DATABASE erp_distributor_test"
php artisan test
```

Pastikan `phpunit.xml` mengarah ke `erp_distributor_test`, **bukan** database dev (`RefreshDatabase` menghapus isi database).

Cek konsistensi data kapan saja (saldo stok vs ledger, pembayaran vs invoice):

```bash
php artisan erp:check-integrity
```

## Backup dan restore

```bash
bash scripts/backup.sh                              # hasil di backups/<db>_<waktu>.sql
bash scripts/restore.sh backups/<file>.sql          # DESTRUKTIF, minta konfirmasi, lalu cek integritas
```

Verifikasi backup tanpa menyentuh database utama:

```bash
mysql -u root -e "CREATE DATABASE erp_restore_check"
mysql -u root erp_restore_check < backups/<file>.sql
mysql -u root erp_restore_check -e "SELECT COUNT(*) AS invoices FROM invoices"
mysql -u root -e "DROP DATABASE erp_restore_check"
```

`mysqldump`/`mysql` harus ada di PATH (Laragon → Tools → Path), atau set `MYSQLDUMP` / `MYSQL_BIN`.

## Batasan MVP

- Penerimaan barang dan pengiriman **penuh saja** (belum parsial).
- Tidak ada reservasi stok: dua SO bisa sama-sama `confirmed` untuk stok yang cuma cukup satu; yang kedua ditolak saat barang keluar.
- Tidak ada costing stok (FIFO/average), jadi **belum ada laporan laba/rugi**.
- Satu gudang aktif (skema sudah siap multi-gudang).
- Belum ada retur ke supplier, refund, atau kredit customer.
- Piutang hanya snapshot hari ini, bukan posisi per tanggal tertentu.
- Token API berlaku 8 jam (`config/sanctum.php`).
