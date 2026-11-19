import { ChevronLeft, ChevronRight } from "lucide-react";

const btn =
    "inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

export default function Pagination({ meta, onPageChange }) {
    if (!meta || meta.total === 0) return null;

    const { current_page: page, last_page: lastPage, from, to, total } = meta;

    return (
        <div className="flex flex-col items-center justify-between gap-3 px-1 py-3 text-sm text-slate-600 sm:flex-row">
            <p>
                Menampilkan {from}–{to} dari {total}
            </p>
            <div className="flex items-center gap-2">
                <button
                    className={btn}
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}>
                    <ChevronLeft className="h-4 w-4" /> Sebelumnya
                </button>
                <span className="px-1">
                    Halaman {page} / {lastPage}
                </span>
                <button
                    className={btn}
                    disabled={page >= lastPage}
                    onClick={() => onPageChange(page + 1)}>
                    Berikutnya <ChevronRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
