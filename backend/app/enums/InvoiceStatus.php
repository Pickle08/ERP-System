<?php

namespace App\Enums;

enum InvoiceStatus: string
{
    case Active = 'active';
    case Void = 'void';
}
