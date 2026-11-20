const numberFormat = new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 3,
});

// Backend mengirim angka desimal sebagai string ("12.500"); ini hanya untuk tampilan
export const formatNumber = (value) => numberFormat.format(Number(value ?? 0));

const currencyFormat = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

// Selalu 2 desimal supaya kolom uang rata dan cocok dengan angka backend
export const formatCurrency = (value) =>
    currencyFormat.format(Number(value ?? 0));

const dateTimeFormat = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta", // zona waktu bisnis, bukan zona browser
});

// Backend mengirim timestamp ISO (UTC); ditampilkan dalam WIB
export const formatDateTime = (value) =>
    value ? dateTimeFormat.format(new Date(value)) : "-";

// Tanggal tanpa jam ("2026-11-18"): timeZone UTC supaya tidak bergeser sehari di zona waktu lain
const dateFormat = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeZone: "UTC",
});

export const formatDate = (value) =>
    value ? dateFormat.format(new Date(value)) : "-";

// Tanggal hari ini menurut zona waktu bisnis (WIB), format YYYY-MM-DD untuk <input type="date">
export const todayInJakarta = () =>
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
