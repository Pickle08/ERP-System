// Pembayaran mengubah status/sisa invoice, ringkasan invoice di detail SO, dan daftar pembayaran
export function invalidateAfterPayment(queryClient) {
    for (const key of ["payments", "invoices", "invoice", "sales-order"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
    }
}
