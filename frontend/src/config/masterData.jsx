import { getAllCategories } from "../api/categories";
import { crudApi } from "../api/crud";
import { getAllUnits } from "../api/units";
import { CUSTOMER_WRITE_ROLES, MASTER_WRITE_ROLES } from "../auth/permissions";
import Badge from "../components/ui/Badge";
import { formatCurrency, formatNumber } from "../lib/format";

const activeBadge = (row) => (
    <Badge tone={row.is_active ? "green" : "slate"}>
        {row.is_active ? "Aktif" : "Nonaktif"}
    </Badge>
);
const dash = (value) => value || "-";

const partyColumns = [
    {
        key: "code",
        header: "Kode",
        cell: (row) => <span className="font-mono text-xs">{row.code}</span>,
    },
    { key: "name", header: "Nama", cell: (row) => row.name },
    {
        key: "contact_person",
        header: "Kontak",
        cell: (row) => dash(row.contact_person),
    },
    { key: "phone", header: "Telepon", cell: (row) => dash(row.phone) },
    { key: "email", header: "Email", cell: (row) => dash(row.email) },
    { key: "is_active", header: "Status", cell: activeBadge },
];

const partyFields = [
    {
        name: "code",
        label: "Kode",
        type: "text",
        required: true,
        maxLength: 30,
    },
    {
        name: "name",
        label: "Nama",
        type: "text",
        required: true,
        maxLength: 150,
    },
    {
        name: "contact_person",
        label: "Nama kontak",
        type: "text",
        maxLength: 100,
    },
    { name: "phone", label: "Telepon", type: "text", maxLength: 30 },
    {
        name: "email",
        label: "Email",
        type: "text",
        inputType: "email",
        maxLength: 150,
    },
    { name: "address", label: "Alamat", type: "textarea" },
    {
        name: "is_active",
        label: "Aktif (muncul di pilihan form transaksi)",
        type: "checkbox",
    },
];

export const PRODUCTS = {
    key: "products",
    singular: "Produk",
    title: "Produk",
    description: "Master produk, harga, dan stok minimum.",
    api: crudApi("products"),
    writeRoles: MASTER_WRITE_ROLES,
    invalidate: ["product-search", "stocks"],
    searchPlaceholder: "Cari nama atau SKU...",
    activeFilter: true,
    columns: [
        {
            key: "sku",
            header: "SKU",
            cell: (row) => <span className="font-mono text-xs">{row.sku}</span>,
        },
        { key: "name", header: "Nama", cell: (row) => row.name },
        {
            key: "category",
            header: "Kategori",
            cell: (row) => row.category?.name ?? "-",
        },
        { key: "unit", header: "Satuan", cell: (row) => row.unit?.code ?? "-" },
        {
            key: "cost_price",
            header: "Harga beli",
            align: "right",
            cell: (row) => formatCurrency(row.cost_price),
        },
        {
            key: "sell_price",
            header: "Harga jual",
            align: "right",
            cell: (row) => formatCurrency(row.sell_price),
        },
        {
            key: "min_stock",
            header: "Stok min.",
            align: "right",
            cell: (row) => formatNumber(row.min_stock),
        },
        { key: "is_active", header: "Status", cell: activeBadge },
    ],
    fields: [
        {
            name: "sku",
            label: "SKU",
            type: "text",
            required: true,
            maxLength: 50,
        },
        {
            name: "name",
            label: "Nama produk",
            type: "text",
            required: true,
            maxLength: 150,
        },
        {
            name: "category_id",
            label: "Kategori",
            type: "select",
            required: true,
            optionsKey: ["categories", "all"],
            optionsFetch: getAllCategories,
            optionLabel: (option) => option.name,
        },
        {
            name: "unit_id",
            label: "Satuan",
            type: "select",
            required: true,
            optionsKey: ["units", "all"],
            optionsFetch: getAllUnits,
            optionLabel: (option) => `${option.name} (${option.code})`,
        },
        {
            name: "cost_price",
            label: "Harga beli",
            type: "number",
            required: true,
            step: "0.01",
        },
        {
            name: "sell_price",
            label: "Harga jual",
            type: "number",
            required: true,
            step: "0.01",
        },
        {
            name: "min_stock",
            label: "Stok minimum",
            type: "number",
            step: "0.001",
            omitIfEmpty: true,
            hint: "Batas untuk peringatan stok menipis.",
        },
        { name: "description", label: "Deskripsi", type: "textarea" },
        {
            name: "is_active",
            label: "Produk aktif (muncul di pilihan form transaksi)",
            type: "checkbox",
        },
    ],
    deleteDescription: (row) =>
        `Produk "${row.name}" akan dihapus dari daftar. Riwayat transaksinya tetap aman, tapi SKU ${row.sku} tidak bisa dipakai lagi. Produk yang masih punya stok tidak bisa dihapus. Kalau cuma mau berhenti dijual, lebih baik nonaktifkan lewat Ubah.`,
};

export const CATEGORIES = {
    key: "categories",
    singular: "Kategori",
    title: "Kategori Produk",
    description: "Pengelompokan produk.",
    api: crudApi("categories"),
    writeRoles: MASTER_WRITE_ROLES,
    invalidate: ["products"],
    searchPlaceholder: "Cari nama kategori...",
    activeFilter: false,
    columns: [
        { key: "name", header: "Nama kategori", cell: (row) => row.name },
    ],
    fields: [
        {
            name: "name",
            label: "Nama kategori",
            type: "text",
            required: true,
            maxLength: 100,
        },
    ],
    deleteDescription: (row) =>
        `Kategori "${row.name}" akan dihapus. Kategori yang masih dipakai produk tidak bisa dihapus.`,
};

export const UNITS = {
    key: "units",
    singular: "Satuan",
    title: "Satuan",
    description: "Satuan ukur produk (pcs, kg, box, ...).",
    api: crudApi("units"),
    writeRoles: MASTER_WRITE_ROLES,
    invalidate: ["products"],
    searchPlaceholder: "Cari nama atau kode satuan...",
    activeFilter: false,
    columns: [
        {
            key: "code",
            header: "Kode",
            cell: (row) => (
                <span className="font-mono text-xs">{row.code}</span>
            ),
        },
        { key: "name", header: "Nama satuan", cell: (row) => row.name },
    ],
    fields: [
        {
            name: "name",
            label: "Nama satuan",
            type: "text",
            required: true,
            maxLength: 50,
        },
        {
            name: "code",
            label: "Kode",
            type: "text",
            required: true,
            maxLength: 10,
        },
    ],
    deleteDescription: (row) =>
        `Satuan "${row.name}" akan dihapus. Satuan yang masih dipakai produk tidak bisa dihapus.`,
};

export const SUPPLIERS = {
    key: "suppliers",
    singular: "Supplier",
    title: "Supplier",
    description: "Pemasok barang untuk Purchase Order.",
    api: crudApi("suppliers"),
    writeRoles: MASTER_WRITE_ROLES,
    searchPlaceholder: "Cari nama atau kode supplier...",
    activeFilter: true,
    columns: partyColumns,
    fields: partyFields,
    deleteDescription: (row) =>
        `Supplier "${row.name}" akan dihapus dari daftar (riwayat PO tetap aman). Kalau cuma mau berhenti dipakai, lebih baik nonaktifkan lewat Ubah.`,
};

export const CUSTOMERS = {
    key: "customers",
    singular: "Customer",
    title: "Customer",
    description: "Pelanggan untuk Sales Order.",
    api: crudApi("customers"),
    writeRoles: CUSTOMER_WRITE_ROLES,
    searchPlaceholder: "Cari nama atau kode customer...",
    activeFilter: true,
    columns: partyColumns,
    fields: partyFields,
    deleteDescription: (row) =>
        `Customer "${row.name}" akan dihapus dari daftar (riwayat SO dan invoice tetap aman). Kalau cuma mau berhenti dipakai, lebih baik nonaktifkan lewat Ubah.`,
};
