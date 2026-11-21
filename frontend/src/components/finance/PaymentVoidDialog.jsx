import { useQueryClient } from "@tanstack/react-query";
import { voidPayment } from "../../api/payments";
import { formatCurrency } from "../../lib/format";
import { invalidateAfterPayment } from "../../lib/queryInvalidation";
import { useToast } from "../toast/useToast";
import ReasonDialog from "../ui/ReasonDialog";

export default function PaymentVoidDialog({ payment, onClose }) {
    const queryClient = useQueryClient();
    const toast = useToast();

    return (
        <ReasonDialog
            title={`Void pembayaran ${payment.payment_number}`}
            description={`Pembayaran ${formatCurrency(payment.amount)} akan dibatalkan dan sisa tagihan invoice dikembalikan. Pembayaran tidak bisa diedit; kalau salah input, void lalu catat ulang.`}
            submitLabel="Void pembayaran"
            mutationFn={(reason) => voidPayment(payment.id, reason)}
            onSuccess={() => {
                invalidateAfterPayment(queryClient);
                toast.success(`Pembayaran ${payment.payment_number} di-void.`);
            }}
            // misal 409 (sudah di-void di tempat lain): muat ulang supaya layar tidak basi
            onError={() => invalidateAfterPayment(queryClient)}
            onClose={onClose}
        />
    );
}
