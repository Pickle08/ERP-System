<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

abstract class Controller
{
    protected function perPage(Request $request): int
    {
        return max(1, min($request->integer('per_page', 15), 100));
    }
}
