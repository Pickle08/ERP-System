import { Link } from "react-router-dom";

export default function StatusPage({ code, title, message }) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 text-center">
            <p className="text-5xl font-bold text-indigo-600">{code}</p>
            <h1 className="mt-3 text-xl font-semibold text-slate-800">
                {title}
            </h1>
            <p className="mt-1 text-slate-500">{message}</p>
            <Link
                to="/"
                className="mt-6 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">
                Kembali ke beranda
            </Link>
        </div>
    );
}
