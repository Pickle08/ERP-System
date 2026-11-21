import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getErrorMessage, getFieldErrors } from "../../api/errors";
import { createExpense } from "../../api/expenses";
import { todayInJakarta } from "../../lib/format";
import { EXPENSE_CATEGORY } from "../../lib/statuses";
import { inputClass } from "../../lib/ui";
import { useToast } from "../toast/useToast";
import Field from "../ui/Field";
import Modal from "../ui/Modal";

const FORM_FIELDS = [
    "expense_date",
    "category",
    "description",
    "amount",
    "reference_number",
];

function validate(form) {
    const errors = {};

    if (!form.expense_date) errors.expense_date = "Tanggal wajib diisi.";
    else if (form.expense_date > todayInJakarta())
        errors.expense_date = "Tidak boleh di masa depan.";
    if (!form.category) errors.category = "Pilih kategori.";
    if (!form.description.trim()) errors.description = "Deskripsi wajib diisi.";
    if (!form.amount || !(Number(form.amount) > 0))
        errors.amount = "Jumlah harus lebih dari 0.";

    return errors;
}

export default function ExpenseFormDialog({ onClose }) {
    const queryClient = useQueryClient();
    const toast = useToast();

    const [form, setForm] = useState({
        expense_date: todayInJakarta(),
        category: "",
        description: "",
        amount: "",
        reference_number: "",
    });
    const [clientErrors, setClientErrors] = useState({});

    const mutation = useMutation({
        mutationFn: createExpense,
        onSuccess: (expense) => {
            queryClient.invalidateQueries({ queryKey: ["expenses"] });
            toast.success(`Biaya ${expense.expense_number} dicatat.`);
            onClose();
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

        const found = validate(form);
        setClientErrors(found);
        if (Object.keys(found).length > 0) return;

        mutation.mutate({
            expense_date: form.expense_date,
            category: form.category,
            description: form.description.trim(),
            amount: form.amount, // string: tidak ada float di jalur ini
            reference_number: form.reference_number.trim() || null,
        });
    };

    const busy = mutation.isPending;

    return (
        <Modal
            title="Catat Biaya Operasional"
            onClose={onClose}
            dismissible={!busy}>
            <form onSubmit={onSubmit} noValidate className="space-y-4">
                {generalError && (
                    <div
                        role="alert"
                        className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                        {generalError}
                    </div>
                )}

                <Field
                    label="Tanggal"
                    htmlFor="expense_date"
                    error={errors.expense_date}>
                    <input
                        id="expense_date"
                        type="date"
                        max={todayInJakarta()}
                        value={form.expense_date}
                        onChange={setField("expense_date")}
                        className={inputClass(!!errors.expense_date)}
                    />
                </Field>

                <Field
                    label="Kategori"
                    htmlFor="category"
                    error={errors.category}>
                    <select
                        id="category"
                        data-autofocus
                        value={form.category}
                        onChange={setField("category")}
                        className={inputClass(!!errors.category)}>
                        <option value="">Pilih kategori</option>
                        {Object.entries(EXPENSE_CATEGORY).map(
                            ([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ),
                        )}
                    </select>
                </Field>

                <Field
                    label="Deskripsi"
                    htmlFor="description"
                    error={errors.description}>
                    <input
                        id="description"
                        type="text"
                        maxLength={255}
                        value={form.description}
                        onChange={setField("description")}
                        className={inputClass(!!errors.description)}
                    />
                </Field>

                <Field label="Jumlah" htmlFor="amount" error={errors.amount}>
                    <input
                        id="amount"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        value={form.amount}
                        onChange={setField("amount")}
                        className={inputClass(!!errors.amount)}
                    />
                </Field>

                <Field
                    label="No. referensi, misal nota (opsional)"
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
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
                        {busy ? "Menyimpan..." : "Catat Biaya"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
