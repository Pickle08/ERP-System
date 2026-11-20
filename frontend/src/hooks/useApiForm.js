import { useState } from "react";

export function useApiForm(initialValues, validate) {
    const [values, setValues] = useState(initialValues);
    const [errors, setErrors] = useState({});
    const [formError, setFormError] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const setValue = (name, value) => {
        setValues((v) => ({ ...v, [name]: value }));
        setErrors((e) => (e[name] ? { ...e, [name]: undefined } : e));
    };

    // send: (values) => Promise<axiosResponse>
    // return: { ok: true, data } | { ok: false }
    const submit = async (send) => {
        if (submitting) return { ok: false };

        const clientErrors = validate ? validate(values) : {};
        if (Object.keys(clientErrors).length) {
            setErrors(clientErrors);
            return { ok: false };
        }

        setSubmitting(true);
        setFormError(null);
        try {
            const res = await send(values);
            return { ok: true, data: res.data };
        } catch (err) {
            const res = err.response;
            if (!res) {
                setFormError(
                    "Tidak bisa terhubung ke server. Periksa koneksi lalu coba lagi.",
                );
            } else if (res.status === 422) {
                const serverErrors = res.data?.errors ?? {};
                setErrors(
                    Object.fromEntries(
                        Object.entries(serverErrors).map(([k, v]) => [k, v[0]]),
                    ),
                );
                setFormError(res.data?.message ?? "Data tidak valid.");
            } else {
                setFormError(
                    res.data?.message ?? "Terjadi kesalahan di server.",
                );
            }
            return { ok: false };
        } finally {
            setSubmitting(false);
        }
    };

    return { values, setValue, errors, formError, submitting, submit };
}
