import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { getErrorMessage, getFieldErrors } from "../api/errors";
import { useAuth } from "../auth/useAuth";

const SHOW_DEMO = import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === "true";

const DEMO_ACCOUNTS = [
    { label: "Admin", email: "admin@erp.test" },
    { label: "Sales", email: "sales@erp.test" },
    { label: "Gudang", email: "warehouse@erp.test" },
    { label: "Procurement", email: "procurement@erp.test" },
    { label: "Finance", email: "finance@erp.test" },
    { label: "Owner", email: "owner@erp.test" },
];

export default function LoginPage() {
    const { user, login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const redirectTo = location.state?.from?.pathname || "/";

    const [form, setForm] = useState({ email: "", password: "" });

    const mutation = useMutation({
        mutationFn: login,
        onSuccess: () => navigate(redirectTo, { replace: true }),
    });

    // Sudah login: tidak perlu lihat halaman login
    if (user) return <Navigate to={redirectTo} replace />;

    const fieldErrors = getFieldErrors(mutation.error);
    const generalError =
        mutation.isError && !fieldErrors.email && !fieldErrors.password
            ? getErrorMessage(mutation.error)
            : null;

    const setField = (name) => (e) =>
        setForm((prev) => ({ ...prev, [name]: e.target.value }));

    const onSubmit = (e) => {
        e.preventDefault();
        mutation.mutate(form);
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
            <div className="w-full max-w-sm">
                <div className="mb-6 text-center">
                    <h1 className="text-2xl font-bold text-slate-800">
                        ERP Distributor
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Masuk untuk melanjutkan
                    </p>
                </div>

                <form
                    onSubmit={onSubmit}
                    className="space-y-4 rounded-xl bg-white p-6 shadow"
                    noValidate>
                    {generalError && (
                        <div
                            role="alert"
                            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                            {generalError}
                        </div>
                    )}

                    <div>
                        <label
                            htmlFor="email"
                            className="block text-sm font-medium text-slate-700">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            autoComplete="username"
                            value={form.email}
                            onChange={setField("email")}
                            className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${
                                fieldErrors.email
                                    ? "border-red-400"
                                    : "border-slate-300"
                            }`}
                        />
                        {fieldErrors.email && (
                            <p className="mt-1 text-xs text-red-600">
                                {fieldErrors.email}
                            </p>
                        )}
                    </div>

                    <div>
                        <label
                            htmlFor="password"
                            className="block text-sm font-medium text-slate-700">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            autoComplete="current-password"
                            value={form.password}
                            onChange={setField("password")}
                            className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${
                                fieldErrors.password
                                    ? "border-red-400"
                                    : "border-slate-300"
                            }`}
                        />
                        {fieldErrors.password && (
                            <p className="mt-1 text-xs text-red-600">
                                {fieldErrors.password}
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={mutation.isPending}
                        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
                        {mutation.isPending ? "Memproses..." : "Masuk"}
                    </button>
                </form>

                {SHOW_DEMO && (
                    <div className="mt-4 rounded-xl bg-white p-4 shadow">
                        <p className="text-xs font-medium text-slate-500">
                            Akun demo (klik untuk mengisi form)
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {DEMO_ACCOUNTS.map((acc) => (
                                <button
                                    key={acc.email}
                                    type="button"
                                    onClick={() =>
                                        setForm({
                                            email: acc.email,
                                            password: "password",
                                        })
                                    }
                                    className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50">
                                    {acc.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
