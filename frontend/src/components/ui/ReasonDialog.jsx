import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { getErrorMessage, getFieldErrors } from "../../api/errors";
import { inputClass } from "../../lib/ui";
import Field from "./Field";
import Modal from "./Modal";

export default function ReasonDialog({
    title,
    description,
    submitLabel,
    reasonLabel = "Alasan",
    mutationFn, // (reason) => Promise
    onSuccess,
    onError,
    onClose,
}) {
    const [reason, setReason] = useState("");
    const [clientError, setClientError] = useState(null);

    const mutation = useMutation({
        mutationFn: () => mutationFn(reason.trim()),
        onSuccess: (result) => {
            onSuccess?.(result);
            onClose();
        },
        onError: (error) => onError?.(error),
    });

    const is422 = mutation.error?.response?.status === 422;
    const raw = is422 ? (mutation.error.response.data?.errors ?? {}) : {};
    const bannerMessages = Object.entries(raw)
        .filter(([key]) => key !== "reason")
        .flatMap(([, messages]) => messages);
    const generalError =
        mutation.isError && !is422 ? getErrorMessage(mutation.error) : null;
    const reasonError = clientError ?? getFieldErrors(mutation.error).reason;

    const onSubmit = (e) => {
        e.preventDefault();

        if (!reason.trim()) {
            setClientError(`${reasonLabel} wajib diisi.`);

            return;
        }

        mutation.mutate();
    };

    const busy = mutation.isPending;

    return (
        <Modal title={title} onClose={onClose} dismissible={!busy}>
            <form onSubmit={onSubmit} noValidate className="space-y-4">
                <p className="text-sm text-slate-600">{description}</p>

                {(bannerMessages.length > 0 || generalError) && (
                    <div
                        role="alert"
                        className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                        {bannerMessages[0] ?? generalError}
                    </div>
                )}

                <Field label={reasonLabel} htmlFor="reason" error={reasonError}>
                    <textarea
                        id="reason"
                        rows={3}
                        maxLength={255}
                        data-autofocus
                        value={reason}
                        onChange={(e) => {
                            setReason(e.target.value);
                            setClientError(null);
                            if (mutation.isError) mutation.reset();
                        }}
                        className={inputClass(!!reasonError)}
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
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">
                        {busy ? "Memproses..." : submitLabel}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
