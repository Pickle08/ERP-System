<?php

namespace App\Models;

use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Invoice extends Model
{
    protected $fillable = [
        'invoice_number',
        'sales_order_id',
        'customer_id',
        'invoice_date',
        'due_date',
        'subtotal',
        'tax_amount',
        'total',
        'paid_amount',
        'payment_status',
        'status',
        'voided_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'invoice_date' => 'date:Y-m-d',
            'due_date' => 'date:Y-m-d',
            'subtotal' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'total' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'payment_status' => PaymentStatus::class,
            'status' => InvoiceStatus::class,
            'voided_at' => 'datetime',
        ];
    }

    public function salesOrder(): BelongsTo
    {
        return $this->belongsTo(SalesOrder::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class)->withTrashed();
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
