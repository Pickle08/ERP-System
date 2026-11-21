// Bandingkan uang dalam sen (bilangan bulat), bukan float desimal
export const toCents = (value) => Math.round(Number(value) * 100);
