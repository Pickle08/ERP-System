<?php

namespace App\Enums;

enum SalesOrderStatus: string
{
    case Draft = 'draft';
    case Confirmed = 'confirmed';
    case Issued = 'issued';
    case Cancelled = 'cancelled';

    /** @return array<int, self> */
    public function allowedNext(): array
    {
        return match ($this) {
            self::Draft => [self::Confirmed, self::Cancelled],
            self::Confirmed => [self::Issued, self::Cancelled],
            self::Issued => [self::Cancelled],
            self::Cancelled => [],
        };
    }

    public function canTransitionTo(self $to): bool
    {
        return in_array($to, $this->allowedNext(), true);
    }
}
