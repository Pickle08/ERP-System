import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export default function Modal({
    title,
    onClose,
    dismissible = true,
    children,
}) {
    const ref = useRef(null);

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog || dialog.open) return;

        dialog.showModal();
        // fokus ke elemen yang ditandai data-autofocus (misal kolom pertama form)
        dialog.querySelector("[data-autofocus]")?.focus();
    }, []);

    return (
        <dialog
            ref={ref}
            onClose={onClose}
            // Esc: batalkan penutupan bawaan kalau lagi tidak boleh ditutup
            onCancel={(e) => {
                if (!dismissible) e.preventDefault();
            }}
            // klik area gelap (target = elemen dialog itu sendiri)
            onClick={(e) => {
                if (dismissible && e.target === e.currentTarget) onClose();
            }}
            className="w-full max-w-md rounded-xl p-0 shadow-xl backdrop:bg-black/40">
            <div className="p-5">
                <div className="mb-4 flex items-start justify-between gap-4">
                    <h2 className="text-lg font-semibold text-slate-800">
                        {title}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={!dismissible}
                        aria-label="Tutup"
                        className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-40">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                {children}
            </div>
        </dialog>
    );
}
