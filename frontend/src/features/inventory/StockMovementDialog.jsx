import { postStockMovement } from "../../api/stocks";
import Modal from "../../components/ui/Modal";
import { useToast } from "../../components/ui/Toast";
import { useApiForm } from "../../hooks/useApiForm";
import { formatNumber } from "../../lib/format";

// MVP satu gudang; nanti ganti dropdown kalau ada endpoint /warehouses
const WAREHOUSE_ID = Number(import.meta.env.VITE_DEFAULT_WAREHOUSE_ID ?? 1);

// HARUS sama dengan aturan `reason` di StockMovementRequest.php
const REASONS = {
    in: [
        ["purchase", "Pembelian"],
        ["customer_return", "Retur customer"],
        ["adjustment", "Penyesuaian"],
        ["opening", "Stok awal"],
    ],
    out: [
        ["sales", "Penjualan"],
        ["damaged", "Rusak"],
        ["lost", "Hilang"],
        ["adjustment", "Penyesuaian"],
    ],
};

const inputCls = (hasError) =>
    `w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${
        hasError
            ? "border-red-500 focus:ring-red-200"
            : "border-slate-300 focus:ring-indigo-500"
    }`;

function Field({ label, error, children }) {
    return (
        <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
                {label}
            </span>
            {children}
            {error && (
                <span className="mt-1 block text-xs text-red-600">{error}</span>
            )}
        </label>
    );
}

export default function StockMovementDialog({
    type,
    product,
    onClose,
    onSuccess,
}) {
    const toast = useToast();
    const isIn = type === "in";

    const validate = (v) => {
        const e = {};
        const qty = Number(v.quantity);
        if (v.quantity === "" || !Number.isFinite(qty) || qty <= 0) {
            e.quantity = "Jumlah harus lebih dari 0";
        } else if (!isIn && qty > Number(product.quantity)) {
            // pengecekan cepat; keputusan final tetap di backend
            e.quantity = `Melebihi stok tersedia (${formatNumber(product.quantity)})`;
        }
        if (!v.reason) e.reason = "Alasan wajib dipilih";
        if (v.reference_number.length > 50)
            e.reference_number = "Maksimal 50 karakter";
        return e;
    };

    const { values, setValue, errors, formError, submitting, submit } =
        useApiForm(
            { quantity: "", reason: "", reference_number: "", notes: "" },
            validate,
        );

    const handleSubmit = async (e) => {
        e.preventDefault();
        const result = await submit((v) =>
            postStockMovement(type, {
                product_id: product.product_id,
                warehouse_id: WAREHOUSE_ID,
                quantity: Number(v.quantity),
                reason: v.reason,
                reference_number: v.reference_number || null,
                notes: v.notes || null,
            }),
        );
        if (result.ok) {
            toast.success(
                `Stok ${product.name} ${isIn ? "bertambah" : "berkurang"} ${values.quantity} ${product.unit ?? ""}`,
            );
            onSuccess();
            onClose();
        }
    };

    return (
        <Modal
            title={`${isIn ? "Stok Masuk" : "Stok Keluar"} — ${product.name}`}
            onClose={onClose}
            locked={submitting}>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <p className="text-sm text-slate-500">
                    Stok saat ini: <b>{formatNumber(product.quantity)}</b>{" "}
                    {product.unit}
                </p>

                {formError && (
                    <div
                        className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
                        role="alert">
                        {formError}
                    </div>
                )}

                <Field label="Jumlah" error={errors.quantity}>
                    <input
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        autoFocus
                        value={values.quantity}
                        onChange={(e) => setValue("quantity", e.target.value)}
                        className={inputCls(errors.quantity)}
                    />
                </Field>

                <Field label="Alasan" error={errors.reason}>
                    <select
                        value={values.reason}
                        onChange={(e) => setValue("reason", e.target.value)}
                        className={inputCls(errors.reason)}>
                        <option value="">Pilih alasan…</option>
                        {REASONS[type].map(([val, label]) => (
                            <option key={val} value={val}>
                                {label}
                            </option>
                        ))}
                    </select>
                </Field>

                <Field
                    label="No. Referensi Dokumen (opsional)"
                    error={errors.reference_number}>
                    <input
                        value={values.reference_number}
                        onChange={(e) =>
                            setValue("reference_number", e.target.value)
                        }
                        placeholder="mis. PO-2026-0012"
                        className={inputCls(errors.reference_number)}
                    />
                </Field>

                <Field label="Catatan (opsional)" error={errors.notes}>
                    <textarea
                        rows={2}
                        value={values.notes}
                        onChange={(e) => setValue("notes", e.target.value)}
                        className={inputCls(errors.notes)}
                    />
                </Field>

                <div className="flex justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50">
                        Batal
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${
                            isIn
                                ? "bg-green-600 hover:bg-green-700"
                                : "bg-orange-600 hover:bg-orange-700"
                        }`}>
                        {submitting ? "Menyimpan…" : "Simpan"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
