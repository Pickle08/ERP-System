<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StockLevelResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'product_id' => $this->id,
            'sku' => $this->sku,
            'name' => $this->name,
            'unit' => $this->unit?->code,
            'min_stock' => $this->min_stock,
            'quantity' => $this->stock_quantity ?? '0.000',
            'is_active' => $this->is_active,
        ];
    }
}
