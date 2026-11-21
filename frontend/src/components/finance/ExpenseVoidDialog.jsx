import { useQueryClient } from "@tanstack/react-query";
import { voidExpense } from "../../api/expenses";
import { formatCurrency } from "../../lib/format";
import { useToast } from "../toast/useToast";
import ReasonDialog from "../ui/ReasonDialog";

export default function ExpenseVoidDialog({ expense, onClose }) {
    const queryClient = useQueryClient();
    const toast = useToast();

    const refresh = () =>
        queryClient.invalidateQueries({ queryKey: ["expenses"] });

    return (
        <ReasonDialog
            title={`Void biaya ${expense.expense_number}`}
            description={`Biaya ${formatCurrency(expense.amount)} (${expense.description}) akan dibatalkan dan tidak masuk laporan. Biaya tidak bisa diedit; kalau salah input, void lalu catat ulang.`}
            submitLabel="Void biaya"
            mutationFn={(reason) => voidExpense(expense.id, reason)}
            onSuccess={() => {
                refresh();
                toast.success(`Biaya ${expense.expense_number} di-void.`);
            }}
            onError={refresh}
            onClose={onClose}
        />
    );
}
