import {
    PO_APPROVE_ROLES,
    PO_RECEIVE_ROLES,
    PO_WRITE_ROLES,
} from "../../auth/permissions";
import { useAuth } from "../../auth/useAuth";

// Hanya menentukan tombol mana yang tampil; keputusan akhir tetap di backend
export default function PurchaseOrderActions({ po, onAction }) {
    const { user } = useAuth();
    const role = user.role;
    const buttons = [];

    if (po.status === "draft" && PO_APPROVE_ROLES.includes(role)) {
        buttons.push({
            action: "approve",
            label: "Setujui",
            className: "bg-emerald-600 text-white hover:bg-emerald-700",
        });
    }

    if (po.status === "approved" && PO_RECEIVE_ROLES.includes(role)) {
        buttons.push({
            action: "receive",
            label: "Terima Barang",
            className: "bg-indigo-600 text-white hover:bg-indigo-700",
        });
    }

    if (
        ["draft", "approved"].includes(po.status) &&
        PO_WRITE_ROLES.includes(role)
    ) {
        buttons.push({
            action: "cancel",
            label: "Batalkan",
            className:
                "border border-red-300 bg-white text-red-600 hover:bg-red-50",
        });
    }

    return buttons.map(({ action, label, className }) => (
        <button
            key={action}
            onClick={() => onAction(action)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${className}`}>
            {label}
        </button>
    ));
}
