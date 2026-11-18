<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InvoiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'invoice_number' => $this->invoice_number,
            'invoice_date' => $this->invoice_date?->format('Y-m-d'),
            'due_date' => $this->due_date?->format('Y-m-d'),
            'subtotal' => $this->subtotal,
            'tax_amount' => $this->tax_amount,
            'total' => $this->total,
            'paid_amount' => $this->paid_amount,
            'outstanding_amount' => $this->outstanding_amount,
            'payment_status' => $this->payment_status->value,
            'status' => $this->status->value,
            'voided_at' => $this->voided_at,

            'customer' => $this->whenLoaded('customer', fn() => [
                'id' => $this->customer->id,
                'code' => $this->customer->code,
                'name' => $this->customer->name,
                'address' => $this->customer->address,
            ]),

            'sales_order' => $this->whenLoaded('salesOrder', fn() => [
                'id' => $this->salesOrder->id,
                'so_number' => $this->salesOrder->so_number,
                'order_date' => $this->salesOrder->order_date?->format('Y-m-d'),
                'payment_terms_days' => $this->salesOrder->payment_terms_days,
                'notes' => $this->salesOrder->notes,
                'items' => $this->salesOrder->relationLoaded('items')
                    ? $this->salesOrder->items->map(fn($i) => [
                        'product' => ['sku' => $i->product->sku, 'name' => $i->product->name],
                        'quantity' => $i->quantity,
                        'unit_price' => $i->unit_price,
                        'discount_percent' => $i->discount_percent,
                        'line_total' => $i->line_total,
                    ])->all()
                    : null,
            ]),

            'payments' => $this->whenLoaded('payments', fn() => $this->payments->map(fn($p) => [
                'id' => $p->id,
                'payment_number' => $p->payment_number,
                'payment_date' => $p->payment_date?->format('Y-m-d'),
                'amount' => $p->amount,
                'method' => $p->method->value,
                'status' => $p->status->value,
            ])->all()),

            'created_at' => $this->created_at,
        ];
    }
}
