<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = fn($u) => $u ? ['id' => $u->id, 'name' => $u->name] : null;

        return [
            'id' => $this->id,
            'payment_number' => $this->payment_number,
            'payment_date' => $this->payment_date?->format('Y-m-d'),
            'amount' => $this->amount,
            'method' => $this->method->value,
            'reference_number' => $this->reference_number,
            'notes' => $this->notes,
            'status' => $this->status->value,
            'voided_at' => $this->voided_at,
            'void_reason' => $this->void_reason,

            'invoice' => $this->whenLoaded('invoice', fn() => [
                'id' => $this->invoice->id,
                'invoice_number' => $this->invoice->invoice_number,
                'total' => $this->invoice->total,
                'paid_amount' => $this->invoice->paid_amount,
                'outstanding_amount' => $this->invoice->outstanding_amount,
                'payment_status' => $this->invoice->payment_status->value,
                'customer' => $this->invoice->relationLoaded('customer') && $this->invoice->customer
                    ? ['id' => $this->invoice->customer->id, 'name' => $this->invoice->customer->name]
                    : null,
            ]),

            'created_by' => $this->whenLoaded('creator', fn() => $user($this->creator)),
            'voided_by' => $this->whenLoaded('voider', fn() => $user($this->voider)),
            'created_at' => $this->created_at,
        ];
    }
}
