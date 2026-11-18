<?php

namespace App\Services;

use App\Enums\RecordStatus;
use App\Models\Expense;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ExpenseService
{
    public function __construct(private readonly DocumentNumberService $numbers)
    {
    }

    public function create(array $data, User $user): Expense
    {
        return DB::transaction(fn() => Expense::create([
            'expense_number' => $this->numbers->next('EXP'),
            'expense_date' => $data['expense_date'],
            'category' => $data['category'],
            'description' => $data['description'],
            'amount' => (string) $data['amount'],
            'reference_number' => $data['reference_number'] ?? null,
            'status' => RecordStatus::Active,
            'created_by' => $user->id,
        ]));
    }

    public function void(Expense $expense, User $user, string $reason): Expense
    {
        return DB::transaction(function () use ($expense, $user, $reason) {
            $locked = Expense::whereKey($expense->id)->lockForUpdate()->firstOrFail();

            if ($locked->status === RecordStatus::Void) {
                abort(409, 'Biaya sudah di-void.');
            }

            $locked->update([
                'status' => RecordStatus::Void,
                'voided_at' => now(),
                'voided_by' => $user->id,
                'void_reason' => $reason,
            ]);

            return $locked;
        });
    }
}
