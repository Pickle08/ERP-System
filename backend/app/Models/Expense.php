<?php

namespace App\Models;

use App\Enums\ExpenseCategory;
use App\Enums\RecordStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Expense extends Model
{
    protected $fillable = [
        'expense_number',
        'expense_date',
        'category',
        'description',
        'amount',
        'reference_number',
        'status',
        'voided_at',
        'voided_by',
        'void_reason',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'expense_date' => 'date:Y-m-d',
            'category' => ExpenseCategory::class,
            'amount' => 'decimal:2',
            'status' => RecordStatus::class,
            'voided_at' => 'datetime',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function voider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by');
    }
}
