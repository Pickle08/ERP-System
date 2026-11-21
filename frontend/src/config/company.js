// Identitas perusahaan untuk dokumen cetak. Diatur lewat .env, tanpa mengubah kode.
export const COMPANY = {
    name: import.meta.env.VITE_COMPANY_NAME || "PT Contoh Distribusi",
    address:
        import.meta.env.VITE_COMPANY_ADDRESS ||
        "Jl. Contoh No. 1, Jember, Jawa Timur",
    phone: import.meta.env.VITE_COMPANY_PHONE || "(0331) 000-000",
    bank:
        import.meta.env.VITE_COMPANY_BANK ||
        "Bank Contoh 000-000-0000 a.n. PT Contoh Distribusi",
};
