export const inputClass = (hasError = false) =>
    `w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${
        hasError ? "border-red-400" : "border-slate-300"
    }`;
