import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getErrorMessage, getFieldErrors } from "../../api/errors";
import { inputClass } from "../../lib/ui";
import { useToast } from "../toast/useToast";
import Field from "../ui/Field";
import Modal from "../ui/Modal";

function initialValues(fields, row) {
    return Object.fromEntries(
        fields.map((f) => {
            if (f.type === "checkbox")
                return [
                    f.name,
                    row ? Boolean(row[f.name]) : (f.initial ?? true),
                ];

            return [
                f.name,
                row ? String(row[f.name] ?? "") : String(f.initial ?? ""),
            ];
        }),
    );
}

// Validasi ringan di sisi klien; aturan sebenarnya (unik, dll) dijaga backend
function validate(fields, values) {
    const errors = {};

    for (const f of fields) {
        if (f.type === "checkbox") continue;
        const v = String(values[f.name]).trim();

        if (f.required && v === "") errors[f.name] = `${f.label} wajib diisi.`;
        else if (f.type === "number" && v !== "" && Number(v) < 0)
            errors[f.name] = "Tidak boleh negatif.";
    }

    return errors;
}

function buildPayload(fields, values) {
    const payload = {};

    for (const f of fields) {
        const raw = values[f.name];

        if (f.type === "checkbox") {
            payload[f.name] = Boolean(raw);
            continue;
        }

        const v = String(raw).trim();
        if (v === "") {
            if (!f.omitIfEmpty && !f.required) payload[f.name] = null; // kolom opsional dikosongkan
            continue;
        }

        payload[f.name] = f.type === "select" ? Number(v) : v; // angka desimal tetap string
    }

    return payload;
}

function SelectInput({ field, value, onChange, hasError }) {
    const options = useQuery({
        queryKey: field.optionsKey,
        queryFn: field.optionsFetch,
        staleTime: 5 * 60_000,
    });

    return (
        <select
            id={field.name}
            value={value}
            onChange={onChange}
            disabled={options.isLoading}
            className={inputClass(hasError)}>
            <option value="">
                {options.isLoading
                    ? "Memuat..."
                    : `Pilih ${field.label.toLowerCase()}`}
            </option>
            {(options.data ?? []).map((option) => (
                <option key={option.id} value={option.id}>
                    {field.optionLabel(option)}
                </option>
            ))}
        </select>
    );
}

export default function CrudFormDialog({ config, row, onClose }) {
    const isEdit = Boolean(row);
    const queryClient = useQueryClient();
    const toast = useToast();

    const [values, setValues] = useState(() =>
        initialValues(config.fields, row),
    );
    const [clientErrors, setClientErrors] = useState({});

    const mutation = useMutation({
        mutationFn: (payload) =>
            isEdit
                ? config.api.update(row.id, payload)
                : config.api.create(payload),
        onSuccess: () => {
            for (const key of [config.key, ...(config.invalidate ?? [])]) {
                queryClient.invalidateQueries({ queryKey: [key] });
            }
            toast.success(
                `${config.singular} ${isEdit ? "diperbarui" : "ditambahkan"}.`,
            );
            onClose();
        },
    });

    const serverErrors = getFieldErrors(mutation.error);
    const errors = { ...serverErrors, ...clientErrors };
    const known = config.fields.map((f) => f.name);
    const unmapped = Object.entries(serverErrors).find(
        ([key]) => !known.includes(key),
    )?.[1];
    const generalError =
        unmapped ??
        (mutation.isError && Object.keys(serverErrors).length === 0
            ? getErrorMessage(mutation.error)
            : null);

    const setValue = (name, value) => {
        setValues((prev) => ({ ...prev, [name]: value }));
        setClientErrors((prev) => ({ ...prev, [name]: undefined }));
        if (mutation.isError) mutation.reset();
    };

    const onSubmit = (e) => {
        e.preventDefault();

        const found = validate(config.fields, values);
        setClientErrors(found);
        if (Object.keys(found).length > 0) return;

        mutation.mutate(buildPayload(config.fields, values));
    };

    const busy = mutation.isPending;

    return (
        <Modal
            title={`${isEdit ? "Ubah" : "Tambah"} ${config.singular}`}
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

                {config.fields.map((f, index) => {
                    const error = errors[f.name];
                    const onChange = (e) => setValue(f.name, e.target.value);

                    if (f.type === "checkbox") {
                        return (
                            <label
                                key={f.name}
                                className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={values[f.name]}
                                    onChange={(e) =>
                                        setValue(f.name, e.target.checked)
                                    }
                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                {f.label}
                            </label>
                        );
                    }

                    return (
                        <Field
                            key={f.name}
                            label={f.label}
                            htmlFor={f.name}
                            error={error}
                            hint={f.hint}>
                            {f.type === "select" ? (
                                <SelectInput
                                    field={f}
                                    value={values[f.name]}
                                    onChange={onChange}
                                    hasError={!!error}
                                />
                            ) : f.type === "textarea" ? (
                                <textarea
                                    id={f.name}
                                    rows={3}
                                    value={values[f.name]}
                                    onChange={onChange}
                                    className={inputClass(!!error)}
                                />
                            ) : (
                                <input
                                    id={f.name}
                                    type={
                                        f.type === "number"
                                            ? "number"
                                            : (f.inputType ?? "text")
                                    }
                                    step={f.step}
                                    min={f.type === "number" ? "0" : undefined}
                                    maxLength={f.maxLength}
                                    data-autofocus={
                                        index === 0 ? true : undefined
                                    }
                                    value={values[f.name]}
                                    onChange={onChange}
                                    className={inputClass(!!error)}
                                />
                            )}
                        </Field>
                    );
                })}

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
                        {busy ? "Menyimpan..." : "Simpan"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
