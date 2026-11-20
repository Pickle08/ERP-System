import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getErrorMessage, getFieldErrors } from "../../api/errors";
import { stockIn, stockOut } from "../../api/stocks";
import { getWarehouses } from "../../api/warehouses";
import { formatNumber } from "../../lib/format";
import { inputClass } from "../../lib/ui";
import { useToast } from "../toast/useToast";
import Field from "../ui/Field";
import Modal from "../ui/Modal";

const CONFIG = {
    in: {
        title: "Stok Masuk",
        submit: "Catat Stok Masuk",
        verb: "bertambah",
        button: "bg-emerald-600 hover:bg-emerald-700",
        reasons: [
            "Stok awal",
            "Penyesuaian stok (selisih opname)",
            "Barang masuk lainnya",
        ],
    },
    out: {
        title: "Stok Keluar",
        submit: "Catat Stok Keluar",
        verb: "berkurang",
        button: "bg-amber-600 hover:bg-amber-700",
        reasons: [
            "Barang rusak",
            "Barang kedaluwarsa",
            "Penyesuaian stok (selisih opname)",
            "Pemakaian internal",
        ],
    },
};

const FORM_FIELDS = [
    "warehouse_id",
    "quantity",
    "reason",
    "reference_number",
    "notes",
];

// Validasi ringan di sisi klien; aturan sebenarnya tetap dijaga backend
function validate(form) {
    const errors = {};
    const quantity = Number(form.quantity);

    if (!form.warehouse_id) errors.warehouse_id = "Pilih gudang.";
    if (!form.quantity || !(quantity > 0))
        errors.quantity = "Jumlah harus lebih dari 0.";
    if (!form.reason.trim()) errors.reason = "Alasan wajib diisi.";

    return errors;
}

export default function StockMovementDialog({ mode, product, onClose }) {
    const cfg = CONFIG[mode];
    const queryClient = useQueryClient();
    const toast = useToast();

    const [form, setForm] = useState({
        quantity: "",
        reason: "",
        reference_number: "",
        notes: "",
        warehouse_id: "",
    });
    const [clientErrors, setClientErrors] = useState({});

    const warehouses = useQuery({
        queryKey: ["warehouses"],
        queryFn: getWarehouses,
        staleTime: 10 * 60_000,
    });
    const warehouseList = warehouses.data ?? [];
    // Kalau user belum memilih, pakai gudang pertama
    const warehouseId = form.warehouse_id || (warehouseList[0]?.id ?? "");

    const mutation = useMutation({
        mutationFn: (payload) =>
            mode === "in" ? stockIn(payload) : stockOut(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["stocks"] });
            queryClient.invalidateQueries({ queryKey: ["movements"] });

            const unit = product.unit ? ` ${product.unit}` : "";
            toast.success(
                `Stok ${product.name} ${cfg.verb} ${formatNumber(form.quantity)}${unit}.`,
            );
            onClose();
        },
    });

    const serverErrors = getFieldErrors(mutation.error);
    const errors = { ...serverErrors, ...clientErrors };

    // Error server yang tidak punya field di form (misal produk sudah dihapus) tampil sebagai banner
    const unmappedError = Object.entries(serverErrors).find(
        ([key]) => !FORM_FIELDS.includes(key),
    )?.[1];
    const generalError =
        unmappedError ??
        (mutation.isError && Object.keys(serverErrors).length === 0
            ? getErrorMessage(mutation.error)
            : null) ??
        (warehouses.isError ? "Gagal memuat daftar gudang." : null);

    const setField = (name) => (e) => {
        setForm((prev) => ({ ...prev, [name]: e.target.value }));
        setClientErrors((prev) => ({ ...prev, [name]: undefined }));
        if (mutation.isError) mutation.reset();
    };

    const onSubmit = (e) => {
        e.preventDefault();

        const found = validate({ ...form, warehouse_id: warehouseId });
        setClientErrors(found);
        if (Object.keys(found).length > 0) return;

        mutation.mutate({
            product_id: product.product_id,
            warehouse_id: warehouseId,
            quantity: form.quantity, // string: tidak ada float di jalur ini
            reason: form.reason.trim(),
            reference_number: form.reference_number.trim() || null,
            notes: form.notes.trim() || null,
        });
    };

    const busy = mutation.isPending;

    return (
        <Modal title={cfg.title} onClose={onClose} dismissible={!busy}>
            <form onSubmit={onSubmit} noValidate className="space-y-4">
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-sm font-medium text-slate-800">
                        {product.name}
                    </p>
                    <p className="text-xs text-slate-500">
                        {product.sku} · Stok saat ini:{" "}
                        {formatNumber(product.quantity)} {product.unit}
                    </p>
                </div>

                {generalError && (
                    <div
                        role="alert"
                        className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                        {generalError}
                    </div>
                )}

                <Field
                    label="Gudang"
                    htmlFor="warehouse_id"
                    error={errors.warehouse_id}>
                    {warehouseList.length === 1 ? (
                        <p className="text-sm text-slate-700">
                            {warehouseList[0].name}
                        </p>
                    ) : (
                        <select
                            id="warehouse_id"
                            value={warehouseId}
                            onChange={setField("warehouse_id")}
                            disabled={warehouses.isLoading}
                            className={inputClass(!!errors.warehouse_id)}>
                            {warehouses.isLoading && (
                                <option value="">Memuat...</option>
                            )}
                            {warehouseList.map((w) => (
                                <option key={w.id} value={w.id}>
                                    {w.name}
                                </option>
                            ))}
                        </select>
                    )}
                </Field>

                <Field
                    label={`Jumlah${product.unit ? ` (${product.unit})` : ""}`}
                    htmlFor="quantity"
                    error={errors.quantity}
                    hint={
                        mode === "out"
                            ? `Stok tersedia: ${formatNumber(product.quantity)}`
                            : undefined
                    }>
                    <input
                        id="quantity"
                        type="number"
                        inputMode="decimal"
                        step="0.001"
                        min="0"
                        data-autofocus
                        value={form.quantity}
                        onChange={setField("quantity")}
                        className={inputClass(!!errors.quantity)}
                    />
                </Field>

                <Field label="Alasan" htmlFor="reason" error={errors.reason}>
                    <input
                        id="reason"
                        type="text"
                        list="reason-options"
                        maxLength={255}
                        value={form.reason}
                        onChange={setField("reason")}
                        className={inputClass(!!errors.reason)}
                    />
                    <datalist id="reason-options">
                        {cfg.reasons.map((reason) => (
                            <option key={reason} value={reason} />
                        ))}
                    </datalist>
                </Field>

                <Field
                    label="No. dokumen referensi (opsional)"
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
                        disabled={
                            busy || warehouses.isLoading || warehouses.isError
                        }
                        className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 ${cfg.button}`}>
                        {busy ? "Memproses..." : cfg.submit}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
