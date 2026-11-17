<?php

namespace App\Enums;

enum StockMovementType: string
{
    case StockIn = 'stock_in';
    case StockOut = 'stock_out';
    // Step 4/5 nanti nambah: PurchaseReceipt, SalesIssue, SalesCancel
}
