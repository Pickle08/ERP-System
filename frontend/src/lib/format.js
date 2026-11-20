const numberFormat = new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 3,
});

// Backend mengirim angka desimal sebagai string ("12.500"); ini hanya untuk tampilan
export const formatNumber = (value) => numberFormat.format(Number(value ?? 0));

const dateTimeFormat = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta", // zona waktu bisnis, bukan zona browser
});

// Backend mengirim timestamp ISO (UTC); ditampilkan dalam WIB
export const formatDateTime = (value) =>
    value ? dateTimeFormat.format(new Date(value)) : "-";
