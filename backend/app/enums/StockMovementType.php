<?php

namespace App\Enums;

enum StockMovementType: string
{
    case StockIn = 'stock_in';
    case StockOut = 'stock_out';
    case PurchaseReceipt = 'purchase_receipt';
    case SalesIssue = 'sales_issue';
    case SalesCancel = 'sales_cancel';
}
