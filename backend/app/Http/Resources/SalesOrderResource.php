<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SalesOrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = fn($u) => $u ? ['id' => $u->id, 'name' => $u->name] : null;

        return [
            'id' => $this->id,
            'so_number' => $this->so_number,
            'status' => $this->status->value,
            'order_date' => $this->order_date?->format('Y-m-d'),
            'payment_terms_days' => $this->payment_terms_days,
            'subtotal' => $this->subtotal,
            'tax_amount' => $this->tax_amount,
            'total' => $this->total,
            'notes' => $this->notes,
            'items_count' => $this->whenCounted('items'),

            'customer' => $this->whenLoaded('customer', fn() => [
                'id' => $this->customer->id,
                'code' => $this->customer->code,
                'name' => $this->customer->name,
            ]),
            'warehouse' => $this->whenLoaded('warehouse', fn() => [
                'id' => $this->warehouse->id,
                'code' => $this->warehouse->code,
                'name' => $this->warehouse->name,
            ]),

            'items' => $this->whenLoaded('items', fn() => $this->items->map(fn($i) => [
                'id' => $i->id,
                'product' => ['id' => $i->product->id, 'sku' => $i->product->sku, 'name' => $i->product->name],
                'quantity' => $i->quantity,
                'unit_price' => $i->unit_price,
                'discount_percent' => $i->discount_percent,
                'line_total' => $i->line_total,
            ])->all()),

            'invoice' => $this->whenLoaded('invoice', fn() => $this->invoice ? [
                'id' => $this->invoice->id,
                'invoice_number' => $this->invoice->invoice_number,
                'total' => $this->invoice->total,
                'payment_status' => $this->invoice->payment_status->value,
                'status' => $this->invoice->status->value,
            ] : null),

            'status_histories' => $this->whenLoaded('statusHistories', fn() => $this->statusHistories->map(fn($h) => [
                'from_status' => $h->from_status?->value,
                'to_status' => $h->to_status->value,
                'changed_by' => $user($h->changer),
                'note' => $h->note,
                'created_at' => $h->created_at,
            ])->all()),

            'created_by' => $this->whenLoaded('creator', fn() => $user($this->creator)),
            'confirmed_by' => $this->whenLoaded('confirmer', fn() => $user($this->confirmer)),
            'issued_by' => $this->whenLoaded('issuer', fn() => $user($this->issuer)),

            'confirmed_at' => $this->confirmed_at,
            'issued_at' => $this->issued_at,
            'created_at' => $this->created_at,
        ];
    }
}
