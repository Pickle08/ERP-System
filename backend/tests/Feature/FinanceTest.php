<?php

namespace Tests\Feature;

use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Enums\SalesOrderStatus;
use App\Models\Customer;
use App\Models\Expense;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Role;
use App\Models\SalesOrder;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\MasterDataSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FinanceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
        $this->seed(MasterDataSeeder::class);
    }

    private function makeUser(string $slug): User
    {
        return User::factory()->create([
            'role_id' => Role::where('slug', $slug)->value('id'),
            'is_active' => true,
        ]);
    }

    private function actingAsRole(string $slug): User
    {
        $user = $this->makeUser($slug);
        Sanctum::actingAs($user);

        return $user;
    }

    private function makeInvoice(string $total = '10000.00', InvoiceStatus $status = InvoiceStatus::Active): Invoice
    {
        $admin = $this->makeUser('admin');
        $customer = Customer::firstOrCreate(['code' => 'CUS-T01'], ['name' => 'Customer Tes']);

        $so = SalesOrder::create([
            'so_number' => 'SO-T-' . uniqid(),
            'customer_id' => $customer->id,
            'warehouse_id' => Warehouse::firstOrFail()->id,
            'order_date' => now()->toDateString(),
            'status' => SalesOrderStatus::Issued,
            'created_by' => $admin->id,
        ]);

        return Invoice::create([
            'invoice_number' => 'INV-T-' . uniqid(),
            'sales_order_id' => $so->id,
            'customer_id' => $customer->id,
            'invoice_date' => now()->toDateString(),
            'subtotal' => $total,
            'tax_amount' => 0,
            'total' => $total,
            'paid_amount' => 0,
            'payment_status' => PaymentStatus::Unpaid,
            'status' => $status,
            'created_by' => $admin->id,
        ]);
    }

    private function paymentPayload(int|float|string $amount, array $overrides = []): array
    {
        return array_merge([
            'payment_date' => now()->toDateString(),
            'amount' => $amount,
            'method' => 'bank_transfer',
        ], $overrides);
    }

    private function expensePayload(array $overrides = []): array
    {
        return array_merge([
            'expense_date' => now()->toDateString(),
            'category' => 'transport',
            'description' => 'Bensin pengiriman',
            'amount' => 150000,
        ], $overrides);
    }

    // ---------- PEMBAYARAN ----------

    public function test_partial_then_full_payment_updates_invoice(): void
    {
        $invoice = $this->makeInvoice('10000.00');
        $this->actingAsRole('finance');

        $response = $this->postJson("/api/invoices/{$invoice->id}/payments", $this->paymentPayload(4000))
            ->assertCreated()
            ->assertJsonPath('data.amount', '4000.00')
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.invoice.payment_status', 'partial')
            ->assertJsonPath('data.invoice.outstanding_amount', '6000.00');

        $this->assertMatchesRegularExpression('/^PAY-\d{6}-0001$/', $response->json('data.payment_number'));

        $invoice->refresh();
        $this->assertSame('4000.00', $invoice->paid_amount);
        $this->assertSame('6000.00', $invoice->outstanding_amount);
        $this->assertSame('partial', $invoice->payment_status->value);

        $this->postJson("/api/invoices/{$invoice->id}/payments", $this->paymentPayload(6000))
            ->assertCreated()
            ->assertJsonPath('data.invoice.payment_status', 'paid');

        $invoice->refresh();
        $this->assertSame('10000.00', $invoice->paid_amount);
        $this->assertSame('0.00', $invoice->outstanding_amount);
        $this->assertSame('paid', $invoice->payment_status->value);
    }

    public function test_overpayment_is_rejected(): void
    {
        $invoice = $this->makeInvoice('1000.00');
        $this->actingAsRole('finance');

        $this->postJson("/api/invoices/{$invoice->id}/payments", $this->paymentPayload(1000.01))
            ->assertStatus(422)->assertJsonValidationErrors('amount');

        $this->postJson("/api/invoices/{$invoice->id}/payments", $this->paymentPayload(1000))->assertCreated();

        // Sudah lunas: pembayaran tambahan berapa pun ditolak
        $this->postJson("/api/invoices/{$invoice->id}/payments", $this->paymentPayload(1))
            ->assertStatus(422)->assertJsonValidationErrors('amount');

        $this->assertSame(1, Payment::count());
        $this->assertSame('1000.00', $invoice->refresh()->paid_amount);
    }

    public function test_cannot_pay_a_void_invoice(): void
    {
        $invoice = $this->makeInvoice('1000.00', InvoiceStatus::Void);
        $this->actingAsRole('finance');

        $this->postJson("/api/invoices/{$invoice->id}/payments", $this->paymentPayload(100))
            ->assertStatus(409);

        $this->assertDatabaseCount('payments', 0);
    }

    public function test_rejects_invalid_amount_and_dates(): void
    {
        $invoice = $this->makeInvoice('1000.00');
        $this->actingAsRole('finance');
        $url = "/api/invoices/{$invoice->id}/payments";

        foreach ([0, -5] as $amount) {
            $this->postJson($url, $this->paymentPayload($amount))
                ->assertStatus(422)->assertJsonValidationErrors('amount');
        }

        $this->postJson($url, $this->paymentPayload(100, ['payment_date' => now()->subDay()->toDateString()]))
            ->assertStatus(422)->assertJsonValidationErrors('payment_date');

        $this->postJson($url, $this->paymentPayload(100, ['payment_date' => now()->addDay()->toDateString()]))
            ->assertStatus(422)->assertJsonValidationErrors('payment_date');

        $this->postJson($url, $this->paymentPayload(100, ['method' => 'bitcoin']))
            ->assertStatus(422)->assertJsonValidationErrors('method');

        $this->assertDatabaseCount('payments', 0);
    }

    public function test_void_payment_restores_invoice_and_allows_repayment(): void
    {
        $invoice = $this->makeInvoice('10000.00');
        $this->actingAsRole('finance');

        $paymentId = $this->postJson("/api/invoices/{$invoice->id}/payments", $this->paymentPayload(4000))
            ->assertCreated()->json('data.id');

        $this->postJson("/api/payments/{$paymentId}/void", [])
            ->assertStatus(422)->assertJsonValidationErrors('reason');

        $this->postJson("/api/payments/{$paymentId}/void", ['reason' => 'Salah input nominal'])
            ->assertOk()
            ->assertJsonPath('data.status', 'void')
            ->assertJsonPath('data.void_reason', 'Salah input nominal')
            ->assertJsonPath('data.invoice.payment_status', 'unpaid');

        $invoice->refresh();
        $this->assertSame('0.00', $invoice->paid_amount);
        $this->assertSame('10000.00', $invoice->outstanding_amount);

        // Void dua kali ditolak, dan tidak mengurangi paid_amount dua kali
        $this->postJson("/api/payments/{$paymentId}/void", ['reason' => 'Lagi'])->assertStatus(409);
        $this->assertSame('0.00', $invoice->refresh()->paid_amount);

        // Setelah void, tagihan bisa dibayar penuh lagi
        $this->postJson("/api/invoices/{$invoice->id}/payments", $this->paymentPayload(10000))->assertCreated();
        $this->assertSame('paid', $invoice->refresh()->payment_status->value);
    }

    public function test_payment_role_permissions(): void
    {
        $invoice = $this->makeInvoice('1000.00');
        $url = "/api/invoices/{$invoice->id}/payments";

        $this->actingAsRole('sales');
        $this->postJson($url, $this->paymentPayload(100))->assertForbidden();

        $this->actingAsRole('warehouse');
        $this->getJson('/api/payments')->assertForbidden();

        $this->actingAsRole('owner');
        $this->postJson($url, $this->paymentPayload(100))->assertForbidden();
        $this->getJson('/api/payments')->assertOk();

        $this->actingAsRole('finance');
        $this->postJson($url, $this->paymentPayload(100))->assertCreated();
    }

    public function test_invoice_detail_includes_payments_and_outstanding(): void
    {
        $invoice = $this->makeInvoice('1000.00');
        $this->actingAsRole('finance');
        $this->postJson("/api/invoices/{$invoice->id}/payments", $this->paymentPayload(250))->assertCreated();

        $this->getJson("/api/invoices/{$invoice->id}")
            ->assertOk()
            ->assertJsonPath('data.paid_amount', '250.00')
            ->assertJsonPath('data.outstanding_amount', '750.00')
            ->assertJsonCount(1, 'data.payments');
    }

    // ---------- BIAYA OPERASIONAL ----------

    public function test_create_expense(): void
    {
        $this->actingAsRole('finance');

        $response = $this->postJson('/api/expenses', $this->expensePayload())
            ->assertCreated()
            ->assertJsonPath('data.amount', '150000.00')
            ->assertJsonPath('data.category', 'transport')
            ->assertJsonPath('data.status', 'active');

        $this->assertMatchesRegularExpression('/^EXP-\d{6}-0001$/', $response->json('data.expense_number'));
    }

    public function test_expense_validation(): void
    {
        $this->actingAsRole('finance');

        foreach ([0, -1] as $amount) {
            $this->postJson('/api/expenses', $this->expensePayload(['amount' => $amount]))
                ->assertStatus(422)->assertJsonValidationErrors('amount');
        }

        $this->postJson('/api/expenses', $this->expensePayload(['category' => 'liburan']))
            ->assertStatus(422)->assertJsonValidationErrors('category');

        $this->postJson('/api/expenses', $this->expensePayload(['expense_date' => now()->addDay()->toDateString()]))
            ->assertStatus(422)->assertJsonValidationErrors('expense_date');

        $this->assertDatabaseCount('expenses', 0);
    }

    public function test_void_expense(): void
    {
        $this->actingAsRole('finance');
        $id = $this->postJson('/api/expenses', $this->expensePayload())->assertCreated()->json('data.id');

        $this->postJson("/api/expenses/{$id}/void", [])
            ->assertStatus(422)->assertJsonValidationErrors('reason');

        $this->postJson("/api/expenses/{$id}/void", ['reason' => 'Input dobel'])
            ->assertOk()->assertJsonPath('data.status', 'void');

        $this->postJson("/api/expenses/{$id}/void", ['reason' => 'Lagi'])->assertStatus(409);

        $this->assertSame('void', Expense::findOrFail($id)->status->value);
    }

    public function test_expense_role_permissions(): void
    {
        $this->actingAsRole('sales');
        $this->postJson('/api/expenses', $this->expensePayload())->assertForbidden();
        $this->getJson('/api/expenses')->assertForbidden();

        $this->actingAsRole('owner');
        $this->postJson('/api/expenses', $this->expensePayload())->assertForbidden();
        $this->getJson('/api/expenses')->assertOk();

        $this->actingAsRole('admin');
        $this->postJson('/api/expenses', $this->expensePayload())->assertCreated();
    }

    public function test_expense_list_filters(): void
    {
        $this->actingAsRole('finance');

        $this->postJson('/api/expenses', $this->expensePayload(['category' => 'transport']))->assertCreated();
        $this->postJson('/api/expenses', $this->expensePayload(['category' => 'rent', 'description' => 'Sewa gudang']))->assertCreated();
        $voidId = $this->postJson('/api/expenses', $this->expensePayload(['category' => 'rent', 'description' => 'Salah']))
            ->assertCreated()->json('data.id');
        $this->postJson("/api/expenses/{$voidId}/void", ['reason' => 'Salah'])->assertOk();

        $this->getJson('/api/expenses')->assertOk()->assertJsonCount(3, 'data');
        $this->getJson('/api/expenses?category=rent')->assertOk()->assertJsonCount(2, 'data');
        $this->getJson('/api/expenses?category=rent&status=active')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/expenses?search=Sewa')->assertOk()->assertJsonCount(1, 'data');

        $tomorrow = now()->addDay()->toDateString();
        $this->getJson("/api/expenses?from={$tomorrow}")->assertOk()->assertJsonCount(0, 'data');
    }
}
