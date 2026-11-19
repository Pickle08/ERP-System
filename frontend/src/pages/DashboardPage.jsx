import { ROLE_LABELS } from "../auth/roles";
import { useAuth } from "../auth/useAuth";

export default function DashboardPage() {
    const { user, logout } = useAuth();

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
            <div className="w-full max-w-md rounded-xl bg-white p-8 shadow">
                <h1 className="text-xl font-bold text-slate-800">
                    Halo, {user.name}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                    {user.email} · {ROLE_LABELS[user.role] ?? user.role}
                </p>
                <p className="mt-4 text-sm text-slate-600">
                    Frontend dan backend sudah terhubung. Dashboard sungguhan
                    menyusul setelah modul transaksi selesai.
                </p>
                <button
                    onClick={logout}
                    className="mt-6 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                    Keluar
                </button>
            </div>
        </div>
    );
}
