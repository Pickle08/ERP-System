import {
    Boxes,
    ClipboardList,
    FileText,
    LayoutDashboard,
    Receipt,
    ShoppingCart,
    TrendingUp,
    Truck,
    Users,
    Wallet,
} from "lucide-react";

const ALL = ["admin", "sales", "warehouse", "procurement", "finance", "owner"];

// ready: false = halaman belum dibuat (tampil disabled)
export const NAV_SECTIONS = [
    {
        title: null,
        items: [
            {
                label: "Dashboard",
                to: "/",
                icon: LayoutDashboard,
                roles: ALL,
                ready: true,
            },
        ],
    },
    {
        title: "Inventori",
        items: [
            {
                label: "Stok Produk",
                to: "/stocks",
                icon: Boxes,
                roles: ALL,
                ready: true,
            },
        ],
    },
    {
        title: "Transaksi",
        items: [
            {
                label: "Pembelian (PO)",
                to: "/purchase-orders",
                icon: ShoppingCart,
                roles: [
                    "admin",
                    "procurement",
                    "warehouse",
                    "finance",
                    "owner",
                ],
                ready: true,
            },
            {
                label: "Penjualan (SO)",
                to: "/sales-orders",
                icon: ClipboardList,
                roles: ["admin", "sales", "warehouse", "finance", "owner"],
                ready: true,
            },
            {
                label: "Invoice",
                to: "/invoices",
                icon: FileText,
                roles: ["admin", "sales", "finance", "owner"],
                ready: false,
            },
        ],
    },
    {
        title: "Keuangan",
        items: [
            {
                label: "Pembayaran",
                to: "/payments",
                icon: Wallet,
                roles: ["admin", "finance", "owner"],
                ready: false,
            },
            {
                label: "Biaya",
                to: "/expenses",
                icon: Receipt,
                roles: ["admin", "finance", "owner"],
                ready: false,
            },
            {
                label: "Laporan",
                to: "/reports",
                icon: TrendingUp,
                roles: ["admin", "finance", "owner", "warehouse"],
                ready: false,
            },
        ],
    },
    {
        title: "Master Data",
        items: [
            {
                label: "Customer",
                to: "/customers",
                icon: Users,
                roles: ALL,
                ready: false,
            },
            {
                label: "Supplier",
                to: "/suppliers",
                icon: Truck,
                roles: ALL,
                ready: false,
            },
        ],
    },
];

export function navForRole(role) {
    return NAV_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter((item) => item.roles.includes(role)),
    })).filter((section) => section.items.length > 0);
}
