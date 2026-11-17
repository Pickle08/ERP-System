<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PurchaseOrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'po_number' => $this->po_number,
            'status' => $this->status->value,
            'order_date' => $this->order_date?->format('Y-m-d'),
            'expected_date' => $this->expected_date?->format('Y-m-d'),
            'subtotal' => $this->subtotal,
            'tax_amount' => $this->tax_amount,
            'total' => $this->total,
            'notes' => $this->notes,
            'items_count' => $this->whenCounted('items'),

            'supplier' => $this->whenLoaded('supplier', fn() => [
                'id' => $this->supplier->id,
                'code' => $this->supplier->code,
                'name' => $this->supplier->name,
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
                'line_total' => $i->line_total,
            ])->all()),

            'status_histories' => $this->whenLoaded('statusHistories', fn() => $this->statusHistories->map(fn($h) => [
                'from_status' => $h->from_status?->value,
                'to_status' => $h->to_status->value,
                'changed_by' => $h->changer ? ['id' => $h->changer->id, 'name' => $h->changer->name] : null,
                'note' => $h->note,
                'created_at' => $h->created_at,
            ])->all()),

            'created_by' => $this->whenLoaded('creator', fn() => $this->creator
                ? ['id' => $this->creator->id, 'name' => $this->creator->name] : null),
            'approved_by' => $this->whenLoaded('approver', fn() => $this->approver
                ? ['id' => $this->approver->id, 'name' => $this->approver->name] : null),
            'received_by' => $this->whenLoaded('receiver', fn() => $this->receiver
                ? ['id' => $this->receiver->id, 'name' => $this->receiver->name] : null),

            'approved_at' => $this->approved_at,
            'received_at' => $this->received_at,
            'created_at' => $this->created_at,
        ];
    }
}
