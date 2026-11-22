export const monthStart = (date) => `${date.slice(0, 7)}-01`;

// date: 'YYYY-MM-DD'. Hitungan di UTC supaya tidak bergeser oleh zona waktu browser
export function shiftDays(date, days) {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);

    return d.toISOString().slice(0, 10);
}
