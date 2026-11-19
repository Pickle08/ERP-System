// Error validasi 422 per field: { email: 'pesan', password: 'pesan' }
export function getFieldErrors(error) {
    const errors =
        error?.response?.status === 422 ? error.response.data?.errors : null;
    if (!errors) return {};

    return Object.fromEntries(
        Object.entries(errors).map(([field, messages]) => [field, messages[0]]),
    );
}

// Satu pesan yang aman ditampilkan ke user
export function getErrorMessage(error) {
    if (!error?.response)
        return "Tidak dapat terhubung ke server. Pastikan backend berjalan.";

    const { status, data } = error.response;

    if (status === 422 && data?.errors)
        return Object.values(data.errors).flat()[0];
    if (status === 429)
        return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";
    if (status === 403)
        return data?.message || "Anda tidak punya akses untuk aksi ini.";

    return data?.message || "Terjadi kesalahan. Coba lagi.";
}
