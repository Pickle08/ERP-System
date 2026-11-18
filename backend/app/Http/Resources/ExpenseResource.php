<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ExpenseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = fn($u) => $u ? ['id' => $u->id, 'name' => $u->name] : null;

        return [
            'id' => $this->id,
            'expense_number' => $this->expense_number,
            'expense_date' => $this->expense_date?->format('Y-m-d'),
            'category' => $this->category->value,
            'description' => $this->description,
            'amount' => $this->amount,
            'reference_number' => $this->reference_number,
            'status' => $this->status->value,
            'voided_at' => $this->voided_at,
            'void_reason' => $this->void_reason,

            'created_by' => $this->whenLoaded('creator', fn() => $user($this->creator)),
            'voided_by' => $this->whenLoaded('voider', fn() => $user($this->voider)),
            'created_at' => $this->created_at,
        ];
    }
}
