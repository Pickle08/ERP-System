import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getErrorMessage, getFieldErrors } from "../../api/errors";
import {
    approvePurchaseOrder,
    cancelPurchaseOrder,
    receivePurchaseOrder,
} from "../../api/purchaseOrders";
import { inputClass } from "../../lib/ui";
import { useToast } from "../toast/useToast";
import Field from "../ui/Field";
import Modal from "../ui/Modal";

const ACTIONS = {
    approve: {
        title: "Setujui PO",
        description: () =>
            "PO akan disetujui dan siap diterima. Stok belum berubah sampai barang diterima.",
        submit: "Setujui PO",
        button: "bg-emerald-600 hover:bg-emerald-700",
        noteLabel: "Catatan (opsional)",
        noteRequired: false,
        request: approvePurchaseOrder,
        success: (po) => `PO ${po.po_number} disetujui.`,
    },
    receive: {
        title: "Terima Barang",
        description: (po) =>
            `Seluruh ${po.items?.length ?? 0} item akan diterima ke ${po.warehouse?.name ?? "gudang"} dan stok langsung bertambah. ` +
            "PO yang sudah diterima tidak bisa dibatalkan.",
        submit: "Terima Barang",
        button: "bg-indigo-600 hover:bg-indigo-700",
        noteLabel: "Catatan (opsional)",
        noteRequired: false,
        request: receivePurchaseOrder,
        success: (po) => `Barang PO ${po.po_number} diterima, stok bertambah.`,
    },
    cancel: {
        title: "Batalkan PO",
        description: () =>
            "PO akan dibatalkan dan tidak bisa dibuka kembali. Alasan pembatalan dicatat di histori.",
        submit: "Batalkan PO",
        button: "bg-red-600 hover:bg-red-700",
        noteLabel: "Alasan pembatalan",
        noteRequired: true,
        request: cancelPurchaseOrder,
        success: (po) => `PO ${po.po_number} dibatalkan.`,
    },
};

export default function PurchaseOrderActionDialog({ action, po, onClose }) {
    const cfg = ACTIONS[action];
    const queryClient = useQueryClient();
    const toast = useToast();

    const [note, setNote] = useState("");
    const [clientError, setClientError] = useState(null);

    const mutation = useMutation({
        mutationFn: () => cfg.request(po.id, note.trim()),
        onSuccess: (updated) => {
            queryClient.setQueryData(
                ["purchase-order", String(po.id)],
                updated,
            );
            queryClient.invalidateQueries({ queryKey: ["purchase-order"] });
            queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });

            if (action === "receive") {
                // stok berubah: tabel stok dan riwayat pergerakan harus segar
                queryClient.invalidateQueries({ queryKey: ["stocks"] });
                queryClient.invalidateQueries({ queryKey: ["movements"] });
            }

            toast.success(cfg.success(updated));
            onClose();
        },
        onError: () => {
            // misal 409: status PO sudah berubah di tempat lain, muat ulang supaya halaman tidak basi
            queryClient.invalidateQueries({ queryKey: ["purchase-order"] });
        },
    });

    const fieldErrors = getFieldErrors(mutation.error);
    const noteError = clientError ?? fieldErrors.note;
    const generalError =
        mutation.isError && Object.keys(fieldErrors).length === 0
            ? getErrorMessage(mutation.error)
            : null;

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
            title={`${cfg.title} ${po.po_number}`}
            onClose={onClose}
            dismissible={!busy}>
            <form onSubmit={onSubmit} noValidate className="space-y-4">
                <p className="text-sm text-slate-600">{cfg.description(po)}</p>

                {generalError && (
                    <div
                        role="alert"
                        className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                        {generalError}
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
