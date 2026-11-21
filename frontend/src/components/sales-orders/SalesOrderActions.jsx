import { Link } from "react-router-dom";
import {
    SO_CANCEL_ISSUED_ROLES,
    SO_ISSUE_ROLES,
    SO_WRITE_ROLES,
} from "../../auth/permissions";
import { useAuth } from "../../auth/useAuth";

// Hanya menentukan tombol mana yang tampil; keputusan akhir tetap di backend
export default function SalesOrderActions({ so, onAction }) {
    const { user } = useAuth();
    const role = user.role;
    const buttons = [];

    if (so.status === "draft" && SO_WRITE_ROLES.includes(role)) {
        buttons.push({
            action: "confirm",
            label: "Konfirmasi",
            className: "bg-emerald-600 text-white hover:bg-emerald-700",
        });
    }

    if (so.status === "confirmed" && SO_ISSUE_ROLES.includes(role)) {
        buttons.push({
            action: "issue",
            label: "Barang Keluar",
            className: "bg-indigo-600 text-white hover:bg-indigo-700",
        });
    }

    const canCancel =
        (["draft", "confirmed"].includes(so.status) &&
            SO_WRITE_ROLES.includes(role)) ||
        (so.status === "issued" && SO_CANCEL_ISSUED_ROLES.includes(role));

    if (canCancel) {
        buttons.push({
            action: "cancel",
            label: "Batalkan",
            className:
                "border border-red-300 bg-white text-red-600 hover:bg-red-50",
        });
    }

    const canEdit = so.status === "draft" && SO_WRITE_ROLES.includes(role);

    return (
        <>
            {canEdit && (
                <Link
                    to={`/sales-orders/${so.id}/edit`}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    Ubah
                </Link>
            )}
            {buttons.map(({ action, label, className }) => (
                <button
                    key={action}
                    onClick={() => onAction(action)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium ${className}`}>
                    {label}
                </button>
            ))}
        </>
    );
}
