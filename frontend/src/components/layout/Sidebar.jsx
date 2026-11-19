import { NavLink } from "react-router-dom";
import { X } from "lucide-react";
import { useAuth } from "../../auth/useAuth";
import { navForRole } from "../../config/navigation";

export default function Sidebar({ open, onClose }) {
    const { user } = useAuth();
    const sections = navForRole(user.role);

    return (
        <>
            {open && (
                <div
                    className="fixed inset-0 z-30 bg-black/40 lg:hidden"
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}

            <aside
                className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col bg-slate-900 text-slate-300 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
                    open ? "translate-x-0" : "-translate-x-full"
                }`}>
                <div className="flex h-14 shrink-0 items-center justify-between px-4">
                    <span className="text-lg font-bold text-white">
                        ERP Distributor
                    </span>
                    <button
                        className="rounded p-1 hover:bg-slate-800 lg:hidden"
                        onClick={onClose}
                        aria-label="Tutup menu">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
                    {sections.map((section, index) => (
                        <div key={section.title ?? index}>
                            {section.title && (
                                <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    {section.title}
                                </p>
                            )}
                            <ul className="space-y-1">
                                {section.items.map(
                                    ({ label, to, icon: Icon, ready }) => (
                                        <li key={to}>
                                            {ready ? (
                                                <NavLink
                                                    to={to}
                                                    end={to === "/"}
                                                    onClick={onClose}
                                                    className={({ isActive }) =>
                                                        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                                                            isActive
                                                                ? "bg-indigo-600 text-white"
                                                                : "hover:bg-slate-800 hover:text-white"
                                                        }`
                                                    }>
                                                    <Icon className="h-4 w-4" />
                                                    {label}
                                                </NavLink>
                                            ) : (
                                                <span
                                                    title="Segera hadir"
                                                    className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600">
                                                    <Icon className="h-4 w-4" />
                                                    {label}
                                                    <span className="ml-auto rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase">
                                                        Segera
                                                    </span>
                                                </span>
                                            )}
                                        </li>
                                    ),
                                )}
                            </ul>
                        </div>
                    ))}
                </nav>
            </aside>
        </>
    );
}
