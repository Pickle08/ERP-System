<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserHasRole
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (!$user || !$user->is_active) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (!$user->hasRole(...$roles)) {
            return response()->json(['message' => 'Anda tidak punya akses ke resource ini.'], 403);
        }

        return $next($request);
    }
}
