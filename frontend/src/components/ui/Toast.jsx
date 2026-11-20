import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
} from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const push = useCallback((type, message) => {
        const id = crypto.randomUUID();
        setToasts((t) => [...t, { id, type, message }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
    }, []);

    const api = useMemo(
        () => ({
            success: (m) => push("success", m),
            error: (m) => push("error", m),
        }),
        [push],
    );

    return (
        <ToastContext.Provider value={api}>
            {children}
            <div
                className="fixed right-4 top-4 z-[60] flex flex-col gap-2"
                aria-live="polite">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className={`rounded-md px-4 py-3 text-sm text-white shadow-lg ${
                            t.type === "success" ? "bg-green-600" : "bg-red-600"
                        }`}>
                        {t.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export const useToast = () => useContext(ToastContext);
