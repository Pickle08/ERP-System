<?php

namespace App\Services;

use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use LogicException;

class DocumentNumberService
{
    /**
     * Nomor berikutnya, format PREFIX-YYYYMM-0001. Reset tiap bulan.
     *
     * WAJIB di dalam DB::transaction() milik pemanggil. Baris sequence dikunci
     * sampai transaksi selesai, jadi dua request barengan tidak dapat nomor sama,
     * dan kalau transaksi rollback, nomornya ikut balik (tidak ada lompatan).
     */
    public function next(string $prefix, ?CarbonInterface $date = null): string
    {
        if (DB::transactionLevel() === 0) {
            throw new LogicException('DocumentNumberService::next() harus dipanggil di dalam DB transaction.');
        }

        $period = ($date ?? now())->format('Ym');

        DB::table('document_sequences')->insertOrIgnore([
            'prefix' => $prefix,
            'period' => $period,
            'last_number' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $last = DB::table('document_sequences')
            ->where('prefix', $prefix)
            ->where('period', $period)
            ->lockForUpdate()
            ->value('last_number');

        $next = $last + 1;

        DB::table('document_sequences')
            ->where('prefix', $prefix)
            ->where('period', $period)
            ->update(['last_number' => $next, 'updated_at' => now()]);

        return sprintf('%s-%s-%04d', $prefix, $period, $next);
    }
}
