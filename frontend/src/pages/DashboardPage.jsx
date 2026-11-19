import { ROLE_LABELS } from "../auth/roles";
import { useAuth } from "../auth/useAuth";
import PageHeader from "../components/ui/PageHeader";

export default function DashboardPage() {
    const { user } = useAuth();

    return (
        <>
            <PageHeader
                title={`Halo, ${user.name}`}
                description={`Masuk sebagai ${ROLE_LABELS[user.role] ?? user.role}.`}
            />
            <div className="rounded-xl bg-white p-6 text-sm text-slate-600 shadow">
                Ringkasan dashboard menyusul setelah modul transaksi selesai.
                Untuk sekarang, mulai dari menu <strong>Stok Produk</strong>.
            </div>
        </>
    );
}
