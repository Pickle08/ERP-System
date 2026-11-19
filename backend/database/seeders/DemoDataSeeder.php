<?php

namespace Database\Seeders;

use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\SalesOrder;
use App\Models\Supplier;
use App\Models\Unit;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\ExpenseService;
use App\Services\PaymentService;
use App\Services\PurchaseOrderService;
use App\Services\SalesOrderService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Data demo untuk presentasi portfolio: 90 hari transaksi.
 *
 *   php artisan migrate:fresh --seed
 *   php artisan db:seed --class=DemoDataSeeder
 */
class DemoDataSeeder extends Seeder
{
    private const DAYS = 90;
    private const TAX_RATE = 0.11;

    /** @var array<string, User> */
    private array $users = [];
    private int $warehouseId;
    private Carbon $lastDay;
    /** @var array<int, Product> */
    private array $products = [];
    /** @var array<int, Customer> */
    private array $customers = [];
    /** @var array<string, int> kode supplier => id */
    private array $supplierIds = [];
    /** @var array<string, string> sku => kode supplier */
    private array $supplierBySku = [];
    /** @var array<string, int> kode customer => termin bayar (hari) */
    private array $terms = [];
    /** @var array<string, array<int, int>> tanggal => id PO yang datang di hari itu */
    private array $pendingReceipts = [];

    private PurchaseOrderService $purchases;
    private SalesOrderService $sales;
    private PaymentService $payments;
    private ExpenseService $expenses;

    public function run(
        PurchaseOrderService $purchases,
        SalesOrderService $sales,
        PaymentService $payments,
        ExpenseService $expenses,
    ): void {
        if (app()->isProduction()) {
            $this->command->error('DemoDataSeeder tidak boleh dijalankan di production.');

            return;
        }

        if (PurchaseOrder::exists() || SalesOrder::exists()) {
            $this->command->warn('Data transaksi sudah ada. Jalankan "php artisan migrate:fresh --seed" dulu.');

            return;
        }

        $this->purchases = $purchases;
        $this->sales = $sales;
        $this->payments = $payments;
        $this->expenses = $expenses;

        $this->loadUsers();
        $this->warehouseId = Warehouse::firstOrFail()->id;
        $this->seedMasterData();

        mt_srand(20261118);

        $start = now()->subDays(self::DAYS - 1)->startOfDay();
        $this->lastDay = $start->copy()->addDays(self::DAYS - 1);

        try {
            for ($d = 0; $d < self::DAYS; $d++) {
                $day = $start->copy()->addDays($d);
                Carbon::setTestNow($day->copy()->setTime(9, 0));

                foreach ($this->pendingReceipts[$day->toDateString()] ?? [] as $poId) {
                    $this->purchases->receive(
                        PurchaseOrder::findOrFail($poId),
                        $this->users['warehouse'],
                        'Barang diterima lengkap'
                    );
                }

                if ($d === 0 || ($d % 7 === 0 && $d < self::DAYS - 5)) {
                    $this->restock($d === 0, $day);
                }

                $this->simulateSales($day, $d);
                $this->processPayments($day);
                $this->postExpenses($day, $d);
            }

            $this->closingPipeline();
        } finally {
            Carbon::setTestNow(); // selalu kembalikan jam normal
        }

        $this->summarize();
    }

    // ---------------------------------------------------------------- master

    private function loadUsers(): void
    {
        $users = User::with('role')->get()->keyBy(fn(User $u) => $u->role->slug);

        foreach (['admin', 'sales', 'warehouse', 'procurement', 'finance', 'owner'] as $slug) {
            if (!isset($users[$slug])) {
                throw new RuntimeException("User demo '{$slug}@erp.test' tidak ada. Jalankan: php artisan migrate:fresh --seed");
            }

            $this->users[$slug] = $users[$slug];
        }
    }

    private function seedMasterData(): void
    {
        $suppliers = [
            ['SUP-001', 'PT Sumber Pangan Makmur', 'Budi Santoso', '081210001001', 'penjualan@sumberpangan.example', 'Jl. Industri Raya No. 12, Jakarta Timur'],
            ['SUP-002', 'CV Kertas Nusantara', 'Rina Wijaya', '081210001002', 'order@kertasnusantara.example', 'Jl. Percetakan No. 8, Bandung'],
            ['SUP-003', 'PT Rumah Bersih Indonesia', 'Hendra Gunawan', '081210001003', 'sales@rumahbersih.example', 'Kawasan Industri Jababeka, Bekasi'],
            ['SUP-004', 'UD Berkah Sentosa', 'Siti Rahayu', '081210001004', 'berkah.sentosa@example.com', 'Jl. Pasar Induk No. 21, Surabaya'],
            ['SUP-005', 'PT Global Elektrindo', 'Andi Pratama', '081210001005', 'sales@globalelektrindo.example', 'Jl. Mangga Dua Raya No. 5, Jakarta Utara'],
        ];

        foreach ($suppliers as [$code, $name, $contact, $phone, $email, $address]) {
            $this->supplierIds[$code] = Supplier::updateOrCreate(['code' => $code], [
                'name' => $name,
                'contact_person' => $contact,
                'phone' => $phone,
                'email' => $email,
                'address' => $address,
                'is_active' => true,
            ])->id;
        }

        // kode, nama, kontak, telepon, alamat, termin bayar (hari; 0 = tunai)
        $customers = [
            ['CUS-001', 'Toko Sinar Jaya', 'Hartono', '081310002001', 'Jl. Pasar Baru No. 3, Jember', 14],
            ['CUS-002', 'Mitra Swalayan Sejahtera', 'Lestari', '081310002002', 'Jl. Gajah Mada No. 45, Jember', 30],
            ['CUS-003', 'CV Cahaya Mandiri', 'Wahyudi', '081310002003', 'Jl. Sultan Agung No. 17, Lumajang', 30],
            ['CUS-004', 'Warung Berkah Ibu Sari', 'Sari', '081310002004', 'Jl. Kartini No. 9, Jember', 0],
            ['CUS-005', 'PT Maju Bersama Retail', 'Dewi', '081310002005', 'Jl. Ahmad Yani No. 102, Banyuwangi', 45],
            ['CUS-006', 'Koperasi Karya Bakti', 'Suparman', '081310002006', 'Jl. Diponegoro No. 28, Bondowoso', 30],
            ['CUS-007', 'Toko Grosir Murah Meriah', 'Anton', '081310002007', 'Jl. Hayam Wuruk No. 61, Jember', 14],
            ['CUS-008', 'UD Rezeki Barokah', 'Mulyadi', '081310002008', 'Jl. Trunojoyo No. 7, Situbondo', 0],
        ];

        $this->customers = [];
        foreach ($customers as [$code, $name, $contact, $phone, $address, $terms]) {
            $this->customers[] = Customer::updateOrCreate(['code' => $code], [
                'name' => $name,
                'contact_person' => $contact,
                'phone' => $phone,
                'address' => $address,
                'is_active' => true,
            ]);
            $this->terms[$code] = $terms;
        }

        // sku, nama, kategori, satuan, harga beli, harga jual, stok minimum, supplier
        $products = [
            ['ELK-001', 'Kabel USB-C 1m', 'Elektronik', 'pcs', 18000, 28000, 30, 'SUP-005'],
            ['ELK-002', 'Charger 20W', 'Elektronik', 'pcs', 45000, 69000, 20, 'SUP-005'],
            ['ELK-003', 'Power Bank 10000mAh', 'Elektronik', 'pcs', 135000, 185000, 15, 'SUP-005'],
            ['ELK-004', 'Headset Kabel', 'Elektronik', 'pcs', 22000, 35000, 25, 'SUP-005'],
            ['ELK-005', 'Lampu LED 9W (isi 6)', 'Elektronik', 'box', 62000, 85000, 20, 'SUP-005'],
            ['ATK-001', 'Pulpen Hitam (isi 12)', 'Alat Tulis', 'pack', 18000, 26000, 40, 'SUP-002'],
            ['ATK-002', 'Buku Tulis A5 (isi 10)', 'Alat Tulis', 'pack', 32000, 45000, 30, 'SUP-002'],
            ['ATK-003', 'Kertas HVS A4 70gsm', 'Alat Tulis', 'box', 165000, 205000, 15, 'SUP-002'],
            ['ATK-004', 'Spidol Whiteboard', 'Alat Tulis', 'pcs', 6500, 10000, 50, 'SUP-002'],
            ['ATK-005', 'Map Plastik (isi 12)', 'Alat Tulis', 'pack', 14000, 21000, 30, 'SUP-002'],
            ['FNB-001', 'Beras Premium', 'Makanan & Minuman', 'kg', 12500, 15000, 200, 'SUP-001'],
            ['FNB-002', 'Gula Pasir', 'Makanan & Minuman', 'kg', 14000, 16500, 150, 'SUP-001'],
            ['FNB-003', 'Minyak Goreng', 'Makanan & Minuman', 'ltr', 15500, 18500, 150, 'SUP-001'],
            ['FNB-004', 'Teh Celup (isi 25)', 'Makanan & Minuman', 'box', 9000, 13000, 60, 'SUP-004'],
            ['FNB-005', 'Kopi Bubuk 200g', 'Makanan & Minuman', 'pack', 17000, 24000, 40, 'SUP-004'],
            ['RTG-001', 'Sabun Cuci Piring 800ml', 'Perlengkapan Rumah Tangga', 'pcs', 11500, 16000, 40, 'SUP-003'],
            ['RTG-002', 'Deterjen Bubuk 1kg', 'Perlengkapan Rumah Tangga', 'pcs', 21000, 29000, 40, 'SUP-003'],
            ['RTG-003', 'Tisu Gulung (isi 6)', 'Perlengkapan Rumah Tangga', 'pack', 25000, 36000, 30, 'SUP-003'],
            ['RTG-004', 'Sapu Lantai', 'Perlengkapan Rumah Tangga', 'pcs', 18000, 28000, 15, 'SUP-003'],
            ['RTG-005', 'Ember Plastik 10L', 'Perlengkapan Rumah Tangga', 'pcs', 15000, 24000, 20, 'SUP-003'],
        ];

        foreach ($products as [$sku, $name, $category, $unit, $cost, $sell, $min, $supplier]) {
            Product::updateOrCreate(['sku' => $sku], [
                'name' => $name,
                'category_id' => Category::where('name', $category)->value('id'),
                'unit_id' => Unit::where('code', $unit)->value('id'),
                'cost_price' => $cost,
                'sell_price' => $sell,
                'min_stock' => $min,
                'is_active' => true,
            ]);
            $this->supplierBySku[$sku] = $supplier;
        }

        $this->products = Product::with('unit')
            ->whereIn('sku', array_keys($this->supplierBySku))
            ->orderBy('id')
            ->get()
            ->all();
    }

    // ------------------------------------------------------------- pembelian

    private function restock(bool $initial, Carbon $day): void
    {
        $bySupplier = [];

        foreach ($this->products as $p) {
            $min = (int) round((float) $p->min_stock);

            $qty = $initial
                ? $min * 8
                : ($this->stockOf($p->id) < $min * 3 ? $min * 6 : 0);

            if ($qty > 0) {
                $bySupplier[$this->supplierBySku[$p->sku]][] = [
                    'product_id' => $p->id,
                    'quantity' => $qty,
                    'unit_price' => $p->cost_price,
                ];
            }
        }

        foreach ($bySupplier as $supplierCode => $items) {
            $po = $this->placePurchaseOrder($this->supplierIds[$supplierCode], $items, $day);
            $this->purchases->approve($po, $this->users['owner'], 'Disetujui (data demo)');

            $receiveOn = $day->copy()->addDays(mt_rand(1, 3));
            if ($receiveOn->lte($this->lastDay)) {
                $this->pendingReceipts[$receiveOn->toDateString()][] = $po->id;
            }
        }
    }

    private function placePurchaseOrder(int $supplierId, array $items, Carbon $day): PurchaseOrder
    {
        $subtotal = 0.0;
        foreach ($items as $i) {
            $subtotal += $i['quantity'] * (float) $i['unit_price'];
        }

        return $this->purchases->create([
            'supplier_id' => $supplierId,
            'warehouse_id' => $this->warehouseId,
            'order_date' => $day->toDateString(),
            'expected_date' => $day->copy()->addDays(3)->toDateString(),
            'tax_amount' => number_format(round($subtotal * self::TAX_RATE), 2, '.', ''),
            'notes' => 'Order restock (data demo)',
            'items' => $items,
        ], $this->users['procurement']);
    }

    /** Di hari terakhir: satu PO masih draft, satu PO disetujui tapi barang belum datang. */
    private function closingPipeline(): void
    {
        $this->placePurchaseOrder($this->supplierIds['SUP-002'], $this->itemsFor('SUP-002', 5), $this->lastDay);

        $approved = $this->placePurchaseOrder($this->supplierIds['SUP-003'], $this->itemsFor('SUP-003', 5), $this->lastDay);
        $this->purchases->approve($approved, $this->users['owner'], 'Disetujui, menunggu barang datang');
    }

    private function itemsFor(string $supplierCode, int $multiplier): array
    {
        $items = [];

        foreach ($this->products as $p) {
            if ($this->supplierBySku[$p->sku] === $supplierCode) {
                $items[] = [
                    'product_id' => $p->id,
                    'quantity' => (int) round((float) $p->min_stock) * $multiplier,
                    'unit_price' => $p->cost_price,
                ];
            }
        }

        return $items;
    }

    // ------------------------------------------------------------- penjualan

    private function simulateSales(Carbon $day, int $d): void
    {
        if ($day->isSunday() || $d < 4) {
            return; // minggu libur, dan tunggu barang pertama datang
        }

        $recent = $d >= self::DAYS - 3;

        for ($n = mt_rand(1, 3); $n > 0; $n--) {
            $customer = $this->customers[mt_rand(0, count($this->customers) - 1)];
            $items = $this->pickItems();

            if ($items === []) {
                continue;
            }

            $net = 0.0;
            foreach ($items as $i) {
                $net += $i['quantity'] * (float) $i['unit_price'] * (1 - $i['discount_percent'] / 100);
            }

            $so = $this->sales->create([
                'customer_id' => $customer->id,
                'warehouse_id' => $this->warehouseId,
                'order_date' => $day->toDateString(),
                'payment_terms_days' => $this->terms[$customer->code],
                'tax_amount' => number_format(round($net * self::TAX_RATE), 2, '.', ''),
                'items' => $items,
            ], $this->users['sales']);

            $roll = mt_rand(1, 100);

            if ($recent) {
                // Beberapa hari terakhir sengaja dibiarkan di berbagai tahap (pipeline)
                if ($roll <= 30) {
                    continue; // draft
                }
                $this->sales->confirm($so, $this->users['sales']);
                if ($roll <= 55) {
                    continue; // confirmed
                }
                $this->sales->issue($so, $this->users['warehouse']);

                continue;
            }

            if ($roll <= 4) {
                $this->sales->cancel($so, $this->users['sales'], 'Customer batal sebelum konfirmasi');

                continue;
            }

            $this->sales->confirm($so, $this->users['sales']);

            if ($roll <= 8) {
                $this->sales->cancel($so, $this->users['sales'], 'Customer batal setelah konfirmasi');

                continue;
            }

            $this->sales->issue($so, $this->users['warehouse']);

            if ($roll <= 10) {
                $this->sales->cancel($so, $this->users['admin'], 'Barang diretur customer');
            }
        }
    }

    private function pickItems(): array
    {
        $wanted = mt_rand(1, 4);
        $items = [];
        $used = [];

        for ($try = 0; $try < 12 && count($items) < $wanted; $try++) {
            $p = $this->products[mt_rand(0, count($this->products) - 1)];

            if (isset($used[$p->id])) {
                continue;
            }

            $qty = in_array($p->unit->code, ['kg', 'ltr'], true) ? mt_rand(20, 80) : mt_rand(2, 20);

            if ($this->stockOf($p->id) < $qty) {
                continue;
            }

            $used[$p->id] = true;
            $items[] = [
                'product_id' => $p->id,
                'quantity' => $qty,
                'unit_price' => $p->sell_price,
                'discount_percent' => [0, 0, 0, 0, 2.5, 5][mt_rand(0, 5)],
            ];
        }

        return $items;
    }

    // ------------------------------------------------------------ pembayaran

    /**
     * Nasib tiap invoice ditentukan dari id-nya (deterministik):
     *   id % 10 = 0..5 : lunas, di sekitar jatuh tempo
     *   id % 10 = 6..7 : dibayar sebagian (~40%), sisanya jadi piutang
     *   id % 10 = 8..9 : tidak dibayar sama sekali (jadi piutang, sebagian telat)
     */
    private function processPayments(Carbon $day): void
    {
        $invoices = Invoice::where('status', InvoiceStatus::Active->value)
            ->whereIn('payment_status', [PaymentStatus::Unpaid->value, PaymentStatus::Partial->value])
            ->get();

        foreach ($invoices as $inv) {
            $plan = $inv->id % 10;

            if ($plan >= 8) {
                continue;
            }

            $payDay = ($inv->due_date ?? $inv->invoice_date)->copy()->addDays(($inv->id * 7) % 25 - 3);
            if ($payDay->lt($inv->invoice_date)) {
                $payDay = $inv->invoice_date->copy();
            }

            if ($payDay->toDateString() !== $day->toDateString()) {
                continue;
            }

            if ($plan >= 6) {
                if ($inv->payment_status !== PaymentStatus::Unpaid) {
                    continue;
                }

                $partial = floor((float) $inv->total * 0.4 / 1000) * 1000;
                $amount = $partial >= 1000 ? number_format($partial, 2, '.', '') : $inv->outstanding_amount;
            } else {
                $amount = $inv->outstanding_amount;
            }

            $this->payments->record($inv, [
                'payment_date' => $day->toDateString(),
                'amount' => $amount,
                'method' => ['bank_transfer', 'bank_transfer', 'bank_transfer', 'cash', 'other'][$inv->id % 5],
                'reference_number' => $inv->id % 5 < 3 ? 'TRF-' . str_pad((string) $inv->id, 6, '0', STR_PAD_LEFT) : null,
            ], $this->users['finance']);
        }
    }

    // ----------------------------------------------------------------- biaya

    private function postExpenses(Carbon $day, int $d): void
    {
        $due = [];

        if ($day->day === 1) {
            $due[] = ['rent', 'Sewa gudang ' . $day->format('m/Y'), 15000000];
        }
        if ($day->day === 25) {
            $due[] = ['salary', 'Gaji karyawan ' . $day->format('m/Y'), 28500000];
        }
        if ($d % 7 === 3) {
            $due[] = ['transport', 'Bensin dan ongkos kirim', mt_rand(45, 90) * 10000];
        }
        if ($d % 15 === 10) {
            $due[] = ['utilities', 'Listrik dan air', mt_rand(120, 190) * 10000];
        }
        if ($d % 30 === 12) {
            $due[] = ['marketing', 'Promosi dan brosur', 2500000];
        }
        if ($d % 20 === 5) {
            $due[] = ['supplies', 'Perlengkapan kantor', mt_rand(30, 60) * 10000];
        }

        foreach ($due as [$category, $description, $amount]) {
            $this->expenses->create([
                'expense_date' => $day->toDateString(),
                'category' => $category,
                'description' => $description,
                'amount' => $amount,
            ], $this->users['finance']);
        }

        if ($d === 40) {
            $dup = $this->expenses->create([
                'expense_date' => $day->toDateString(),
                'category' => 'other',
                'description' => 'Input ganda (salah input)',
                'amount' => 350000,
            ], $this->users['finance']);

            $this->expenses->void($dup, $this->users['finance'], 'Input ganda');
        }
    }

    // ---------------------------------------------------------------- helper

    private function stockOf(int $productId): float
    {
        return (float) DB::table('stock_balances')->where('product_id', $productId)->sum('quantity');
    }

    private function summarize(): void
    {
        $this->command->info(sprintf(
            'Data demo selesai: %d PO, %d SO, %d invoice, %d pembayaran, %d biaya.',
            PurchaseOrder::count(),
            SalesOrder::count(),
            Invoice::count(),
            DB::table('payments')->count(),
            DB::table('expenses')->count(),
        ));
        $this->command->info('Login: <role>@erp.test / password (admin, sales, warehouse, procurement, finance, owner)');
    }
}
