import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getErrorMessage, getFieldErrors } from "../../api/errors";
import { recordPayment } from "../../api/payments";
import { formatCurrency, todayInJakarta } from "../../lib/format";
import { toCents } from "../../lib/money";
import { invalidateAfterPayment } from "../../lib/queryInvalidation";
import { PAYMENT_METHOD } from "../../lib/statuses";
import { inputClass } from "../../lib/ui";
import { useToast } from "../toast/useToast";
import Field from "../ui/Field";
import Modal from "../ui/Modal";

const FORM_FIELDS = [
    "payment_date",
    "amount",
    "method",
    "reference_number",
    "notes",
];

// Validasi ringan di sisi klien; backend tetap memutuskan (sisa tagihan bisa berubah)
function validate(form, invoice) {
    const errors = {};

    if (!form.payment_date) errors.payment_date = "Tanggal wajib diisi.";
    else if (form.payment_date < invoice.invoice_date)
        errors.payment_date = "Tidak boleh sebelum tanggal invoice.";
    else if (form.payment_date > todayInJakarta())
        errors.payment_date = "Tidak boleh di masa depan.";

    if (!form.amount || !(toCents(form.amount) > 0)) {
        errors.amount = "Jumlah harus lebih dari 0.";
    } else if (toCents(form.amount) > toCents(invoice.outstanding_amount)) {
        errors.amount = `Melebihi sisa tagihan (${formatCurrency(invoice.outstanding_amount)}).`;
    }

    return errors;
}

export default function RecordPaymentDialog({ invoice, onClose }) {
    const queryClient = useQueryClient();
    const toast = useToast();

    const [form, setForm] = useState({
        payment_date: todayInJakarta(),
        amount: "",
        method: "bank_transfer",
        reference_number: "",
        notes: "",
    });
    const [clientErrors, setClientErrors] = useState({});

    const mutation = useMutation({
        mutationFn: (payload) => recordPayment(invoice.id, payload),
        onSuccess: (payment) => {
            invalidateAfterPayment(queryClient);

            const paid = payment.invoice?.payment_status === "paid";
            const rest = paid
                ? "Invoice lunas."
                : `Sisa tagihan ${formatCurrency(payment.invoice?.outstanding_amount)}.`;
            toast.success(
                `Pembayaran ${payment.payment_number} dicatat. ${rest}`,
            );
            onClose();
        },
        onError: () => {
            // misal sisa tagihan sudah berubah oleh pembayaran lain: muat ulang supaya angka di layar benar
            queryClient.invalidateQueries({ queryKey: ["invoice"] });
        },
    });

    const serverErrors = getFieldErrors(mutation.error);
    const errors = { ...serverErrors, ...clientErrors };
    const unmapped = Object.entries(serverErrors).find(
        ([key]) => !FORM_FIELDS.includes(key),
    )?.[1];
    const generalError =
        unmapped ??
        (mutation.isError && Object.keys(serverErrors).length === 0
            ? getErrorMessage(mutation.error)
            : null);

    const setField = (name) => (e) => {
        setForm((prev) => ({ ...prev, [name]: e.target.value }));
        setClientErrors((prev) => ({ ...prev, [name]: undefined }));
        if (mutation.isError) mutation.reset();
    };

    const onSubmit = (e) => {
        e.preventDefault();

        const found = validate(form, invoice);
        setClientErrors(found);
        if (Object.keys(found).length > 0) return;

        mutation.mutate({
            payment_date: form.payment_date,
            amount: form.amount, // string: tidak ada float di jalur ini
            method: form.method,
            reference_number: form.reference_number.trim() || null,
            notes: form.notes.trim() || null,
        });
    };

    const busy = mutation.isPending;

    return (
        <Modal
            title={`Catat Pembayaran ${invoice.invoice_number}`}
            onClose={onClose}
            dismissible={!busy}>
            <form onSubmit={onSubmit} noValidate className="space-y-4">
                <dl className="space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <div className="flex justify-between text-slate-500">
                        <dt>Total invoice</dt>
                        <dd>{formatCurrency(invoice.total)}</dd>
                    </div>
                    <div className="flex justify-between text-slate-500">
                        <dt>Sudah dibayar</dt>
                        <dd>{formatCurrency(invoice.paid_amount)}</dd>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-800">
                        <dt>Sisa tagihan</dt>
                        <dd>{formatCurrency(invoice.outstanding_amount)}</dd>
                    </div>
                </dl>

                {generalError && (
                    <div
                        role="alert"
                        className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                        {generalError}
                    </div>
                )}

                <Field
                    label="Tanggal pembayaran"
                    htmlFor="payment_date"
                    error={errors.payment_date}>
                    <input
                        id="payment_date"
                        type="date"
                        min={invoice.invoice_date}
                        max={todayInJakarta()}
                        value={form.payment_date}
                        onChange={setField("payment_date")}
                        className={inputClass(!!errors.payment_date)}
                    />
                </Field>

                <Field
                    label="Jumlah dibayar"
                    htmlFor="amount"
                    error={errors.amount}>
                    <div className="flex gap-2">
                        <input
                            id="amount"
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            data-autofocus
                            value={form.amount}
                            onChange={setField("amount")}
                            className={inputClass(!!errors.amount)}
                        />
                        <button
                            type="button"
                            onClick={() => {
                                setForm((prev) => ({
                                    ...prev,
                                    amount: invoice.outstanding_amount,
                                }));
                                setClientErrors((prev) => ({
                                    ...prev,
                                    amount: undefined,
                                }));
                                if (mutation.isError) mutation.reset();
                            }}
                            className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                            Lunasi
                        </button>
                    </div>
                </Field>

                <Field label="Metode" htmlFor="method" error={errors.method}>
                    <select
                        id="method"
                        value={form.method}
                        onChange={setField("method")}
                        className={inputClass(!!errors.method)}>
                        {Object.entries(PAYMENT_METHOD).map(
                            ([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ),
                        )}
                    </select>
                </Field>

                <Field
                    label="No. referensi, misal bukti transfer (opsional)"
                    htmlFor="reference_number"
                    error={errors.reference_number}>
                    <input
                        id="reference_number"
                        type="text"
                        maxLength={50}
                        value={form.reference_number}
                        onChange={setField("reference_number")}
                        className={inputClass(!!errors.reference_number)}
                    />
                </Field>

                <Field
                    label="Catatan (opsional)"
                    htmlFor="notes"
                    error={errors.notes}>
                    <textarea
                        id="notes"
                        rows={2}
                        value={form.notes}
                        onChange={setField("notes")}
                        className={inputClass(!!errors.notes)}
                    />
                </Field>

                <div className="flex justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                        Batal
                    </button>
                    <button
                        type="submit"
                        disabled={busy}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
                        {busy ? "Menyimpan..." : "Catat Pembayaran"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
