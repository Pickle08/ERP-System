import { useCallback, useMemo, useRef, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { ToastContext } from "./context";

const DURATION_MS = 4000;

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const nextId = useRef(1);

    const dismiss = useCallback(
        (id) => setToasts((list) => list.filter((t) => t.id !== id)),
        [],
    );

    const push = useCallback(
        (type, message) => {
            const id = nextId.current++;
            setToasts((list) => [...list, { id, type, message }]);
            setTimeout(() => dismiss(id), DURATION_MS);
        },
        [dismiss],
    );

    const api = useMemo(
        () => ({
            success: (message) => push("success", message),
            error: (message) => push("error", message),
        }),
        [push],
    );

    return (
        <ToastContext.Provider value={api}>
            {children}

            <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        role={toast.type === "error" ? "alert" : "status"}
                        className={`pointer-events-auto flex items-start gap-2 rounded-lg px-3 py-2 text-sm shadow-lg ${
                            toast.type === "error"
                                ? "bg-red-600 text-white"
                                : "bg-slate-900 text-white"
                        }`}>
                        {toast.type === "error" ? (
                            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        ) : (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        )}
                        <span>{toast.message}</span>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
