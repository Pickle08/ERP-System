<?php

namespace App\Models;

use App\Enums\SalesOrderStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class SalesOrder extends Model
{
    // subtotal & total sengaja TIDAK fillable: dihitung database.
    protected $fillable = [
        'so_number',
        'customer_id',
        'warehouse_id',
        'order_date',
        'payment_terms_days',
        'status',
        'tax_amount',
        'notes',
        'created_by',
        'confirmed_by',
        'confirmed_at',
        'issued_by',
        'issued_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => SalesOrderStatus::class,
            'order_date' => 'date:Y-m-d',
            'payment_terms_days' => 'integer',
            'subtotal' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'total' => 'decimal:2',
            'confirmed_at' => 'datetime',
            'issued_at' => 'datetime',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class)->withTrashed();
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(SalesOrderItem::class);
    }

    public function statusHistories(): HasMany
    {
        return $this->hasMany(SalesOrderStatusHistory::class);
    }

    public function invoice(): HasOne
    {
        return $this->hasOne(Invoice::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function confirmer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'confirmed_by');
    }

    public function issuer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'issued_by');
    }
}
