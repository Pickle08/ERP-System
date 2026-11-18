<?php

namespace App\Services;

use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Enums\RecordStatus;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PaymentService
{
    public function __construct(private readonly DocumentNumberService $numbers)
    {
    }

    public function record(Invoice $invoice, array $data, User $user): Payment
    {
        return DB::transaction(function () use ($invoice, $data, $user) {
            $locked = Invoice::whereKey($invoice->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== InvoiceStatus::Active) {
                abort(409, 'Invoice sudah di-void, tidak bisa menerima pembayaran.');
            }

            if (Carbon::parse($data['payment_date'])->lt($locked->invoice_date)) {
                throw ValidationException::withMessages([
                    'payment_date' => ['Tanggal pembayaran tidak boleh sebelum tanggal invoice.'],
                ]);
            }

            $amount = (string) $data['amount'];

            // Guard "tidak boleh melebihi total" dicek di dalam SQL, bukan di PHP.
            $affected = DB::update(
                'UPDATE invoices
                    SET paid_amount = paid_amount + CAST(? AS DECIMAL(18,2)), updated_at = ?
                  WHERE id = ?
                    AND paid_amount + CAST(? AS DECIMAL(18,2)) <= total',
                [$amount, now(), $locked->id, $amount]
            );

            if ($affected === 0) {
                throw ValidationException::withMessages([
                    'amount' => ['Jumlah pembayaran melebihi sisa tagihan invoice.'],
                ]);
            }

            $this->refreshPaymentStatus($locked->id);

            return Payment::create([
                'payment_number' => $this->numbers->next('PAY'),
                'invoice_id' => $locked->id,
                'payment_date' => $data['payment_date'],
                'amount' => $amount,
                'method' => $data['method'],
                'reference_number' => $data['reference_number'] ?? null,
                'notes' => $data['notes'] ?? null,
                'status' => RecordStatus::Active,
                'created_by' => $user->id,
            ]);
        });
    }

    public function void(Payment $payment, User $user, string $reason): Payment
    {
        return DB::transaction(function () use ($payment, $user, $reason) {
            $locked = Payment::whereKey($payment->id)->lockForUpdate()->firstOrFail();

            if ($locked->status === RecordStatus::Void) {
                abort(409, 'Pembayaran sudah di-void.');
            }

            Invoice::whereKey($locked->invoice_id)->lockForUpdate()->firstOrFail();

            DB::update(
                'UPDATE invoices
                    SET paid_amount = paid_amount - CAST(? AS DECIMAL(18,2)), updated_at = ?
                  WHERE id = ?',
                [$locked->amount, now(), $locked->invoice_id]
            );

            $this->refreshPaymentStatus($locked->invoice_id);

            $locked->update([
                'status' => RecordStatus::Void,
                'voided_at' => now(),
                'voided_by' => $user->id,
                'void_reason' => $reason,
            ]);

            return $locked;
        });
    }

    private function refreshPaymentStatus(int $invoiceId): void
    {
        DB::update(
            'UPDATE invoices
                SET payment_status = CASE
                    WHEN paid_amount <= 0 THEN ?
                    WHEN paid_amount >= total THEN ?
                    ELSE ?
                END
              WHERE id = ?',
            [
                PaymentStatus::Unpaid->value,
                PaymentStatus::Paid->value,
                PaymentStatus::Partial->value,
                $invoiceId,
            ]
        );
    }
}
