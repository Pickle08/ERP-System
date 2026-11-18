<?php

namespace App\Enums;

enum ExpenseCategory: string
{
    case Salary = 'salary';
    case Rent = 'rent';
    case Utilities = 'utilities';
    case Transport = 'transport';
    case Marketing = 'marketing';
    case Supplies = 'supplies';
    case Other = 'other';
}
