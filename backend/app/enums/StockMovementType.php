<?php

namespace App\Enums;

enum StockMovementType: string
{
    case StockIn = 'stock_in';
    case StockOut = 'stock_out';
    case PurchaseReceipt = 'purchase_receipt';
    // Step 5 nanti nambah: PurchaseReceipt, SalesIssue, SalesCancel
}
