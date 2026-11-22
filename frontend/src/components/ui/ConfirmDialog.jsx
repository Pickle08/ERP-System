import { useMutation } from "@tanstack/react-query";
import { getErrorMessage } from "../../api/errors";
import Modal from "./Modal";

export default function ConfirmDialog({
    title,
    description,
    confirmLabel,
    mutationFn,
    onSuccess,
    onError,
    onClose,
}) {
    const mutation = useMutation({
        mutationFn,
        onSuccess: (result) => {
            onSuccess?.(result);
            onClose();
        },
        onError: (error) => onError?.(error),
    });
    const busy = mutation.isPending;

    return (
        <Modal title={title} onClose={onClose} dismissible={!busy}>
            <div className="space-y-4">
                <p className="text-sm text-slate-600">{description}</p>

                {mutation.isError && (
                    <div
                        role="alert"
                        className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                        {getErrorMessage(mutation.error)}
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                        Batal
                    </button>
                    <button
                        type="button"
                        data-autofocus
                        onClick={() => mutation.mutate()}
                        disabled={busy}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">
                        {busy ? "Memproses..." : confirmLabel}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
