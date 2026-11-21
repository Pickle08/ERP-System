import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getErrorMessage, getFieldErrors } from "../../api/errors";
import {
    cancelSalesOrder,
    confirmSalesOrder,
    issueSalesOrder,
} from "../../api/salesOrders";
import { inputClass } from "../../lib/ui";
import { useToast } from "../toast/useToast";
import Field from "../ui/Field";
import Modal from "../ui/Modal";

const ACTIONS = {
    confirm: {
        title: "Konfirmasi SO",
        description: () =>
            "Sistem mengecek ketersediaan stok. Konfirmasi tidak mereservasi dan tidak mengurangi stok; stok baru berkurang saat barang keluar.",
        submit: "Konfirmasi SO",
        button: "bg-emerald-600 hover:bg-emerald-700",
        noteLabel: "Catatan (opsional)",
        noteRequired: false,
        request: confirmSalesOrder,
        success: (so) => `SO ${so.so_number} dikonfirmasi.`,
    },
    issue: {
        title: "Barang Keluar",
        description: (so) =>
            `Seluruh ${so.items?.length ?? 0} item dikeluarkan dari ${so.warehouse?.name ?? "gudang"}, stok langsung berkurang, ` +
            "dan invoice dibuat otomatis. Kalau stok salah satu item kurang, seluruh pengeluaran dibatalkan.",
        submit: "Keluarkan Barang",
        button: "bg-indigo-600 hover:bg-indigo-700",
        noteLabel: "Catatan (opsional)",
        noteRequired: false,
        request: issueSalesOrder,
        success: (so) =>
            `Barang SO ${so.so_number} dikeluarkan, invoice dibuat.`,
    },
    cancel: {
        title: "Batalkan SO",
        description: (so) =>
            so.status === "issued"
                ? "Barang sudah keluar: stok akan DIKEMBALIKAN dan invoice di-void. Ditolak kalau invoice sudah ada pembayaran."
                : "SO akan dibatalkan. Stok tidak terpengaruh karena barang belum keluar.",
        submit: "Batalkan SO",
        button: "bg-red-600 hover:bg-red-700",
        noteLabel: "Alasan pembatalan",
        noteRequired: true,
        request: cancelSalesOrder,
        success: (so) => `SO ${so.so_number} dibatalkan.`,
    },
};

export default function SalesOrderActionDialog({ action, so, onClose }) {
    const cfg = ACTIONS[action];
    const queryClient = useQueryClient();
    const toast = useToast();

    const [note, setNote] = useState("");
    const [clientError, setClientError] = useState(null);

    const mutation = useMutation({
        mutationFn: () => cfg.request(so.id, note.trim()),
        onSuccess: (updated) => {
            queryClient.setQueryData(["sales-order", String(so.id)], updated);
            queryClient.invalidateQueries({ queryKey: ["sales-order"] });
            queryClient.invalidateQueries({ queryKey: ["sales-orders"] });

            if (action !== "confirm") {
                // barang keluar / batal bisa mengubah stok dan invoice
                queryClient.invalidateQueries({ queryKey: ["stocks"] });
                queryClient.invalidateQueries({ queryKey: ["movements"] });
                queryClient.invalidateQueries({ queryKey: ["invoices"] });
            }

            toast.success(cfg.success(updated));
            onClose();
        },
        onError: () => {
            // misal 409: status SO sudah berubah di tempat lain, muat ulang supaya halaman tidak basi
            queryClient.invalidateQueries({ queryKey: ["sales-order"] });
        },
    });

    const is422 = mutation.error?.response?.status === 422;
    const raw = is422 ? (mutation.error.response.data?.errors ?? {}) : {};
    // Semua pesan (misal daftar produk yang stoknya kurang), kecuali yang milik kolom catatan
    const bannerMessages = Object.entries(raw)
        .filter(([key]) => key !== "note")
        .flatMap(([, messages]) => messages);
    const generalError =
        mutation.isError && !is422 ? getErrorMessage(mutation.error) : null;
    const noteError = clientError ?? getFieldErrors(mutation.error).note;

    const onSubmit = (e) => {
        e.preventDefault();

        if (cfg.noteRequired && !note.trim()) {
            setClientError("Alasan pembatalan wajib diisi.");

            return;
        }

        mutation.mutate();
    };

    const busy = mutation.isPending;

    return (
        <Modal
            title={`${cfg.title} ${so.so_number}`}
            onClose={onClose}
            dismissible={!busy}>
            <form onSubmit={onSubmit} noValidate className="space-y-4">
                <p className="text-sm text-slate-600">{cfg.description(so)}</p>

                {(bannerMessages.length > 0 || generalError) && (
                    <div
                        role="alert"
                        className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                        {bannerMessages.length > 1 ? (
                            <ul className="list-disc space-y-1 pl-4">
                                {bannerMessages.map((message) => (
                                    <li key={message}>{message}</li>
                                ))}
                            </ul>
                        ) : (
                            (bannerMessages[0] ?? generalError)
                        )}
                    </div>
                )}

                <Field label={cfg.noteLabel} htmlFor="note" error={noteError}>
                    <textarea
                        id="note"
                        rows={3}
                        maxLength={255}
                        data-autofocus
                        value={note}
                        onChange={(e) => {
                            setNote(e.target.value);
                            setClientError(null);
                            if (mutation.isError) mutation.reset();
                        }}
                        className={inputClass(!!noteError)}
                    />
                </Field>

                <div className="flex justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                        Kembali
                    </button>
                    <button
                        type="submit"
                        disabled={busy}
                        className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 ${cfg.button}`}>
                        {busy ? "Memproses..." : cfg.submit}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
