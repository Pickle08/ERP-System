const numberFormat = new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 3,
});

// Backend mengirim angka desimal sebagai string ("12.500"); ini hanya untuk tampilan
export const formatNumber = (value) => numberFormat.format(Number(value ?? 0));
