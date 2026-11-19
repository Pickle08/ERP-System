import { LogOut, Menu } from "lucide-react";
import { ROLE_LABELS } from "../../auth/roles";
import { useAuth } from "../../auth/useAuth";

export default function Topbar({ onMenuClick }) {
    const { user, logout } = useAuth();

    return (
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
            <button
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
                onClick={onMenuClick}
                aria-label="Buka menu">
                <Menu className="h-5 w-5" />
            </button>

            <div className="ml-auto flex items-center gap-3">
                <div className="text-right leading-tight">
                    <p className="text-sm font-medium text-slate-800">
                        {user.name}
                    </p>
                    <p className="text-xs text-slate-500">
                        {ROLE_LABELS[user.role] ?? user.role}
                    </p>
                </div>
                <button
                    onClick={logout}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Keluar</span>
                </button>
            </div>
        </header>
    );
}
