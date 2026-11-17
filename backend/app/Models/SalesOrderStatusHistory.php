<?php

namespace App\Models;

use App\Enums\SalesOrderStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalesOrderStatusHistory extends Model
{
    const UPDATED_AT = null; // histori immutable

    protected $fillable = ['sales_order_id', 'from_status', 'to_status', 'changed_by', 'note'];

    protected function casts(): array
    {
        return [
            'from_status' => SalesOrderStatus::class,
            'to_status' => SalesOrderStatus::class,
        ];
    }

    public function changer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
