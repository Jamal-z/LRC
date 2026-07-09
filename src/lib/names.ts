// Normalizes a person's name for duplicate matching:
// case/whitespace-insensitive, and tolerant of common Arabic spelling variants
// (hamza forms, taa marbuta vs ha, alef maqsura, diacritics, tatweel).
export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "") // Arabic diacritics + tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ")
}
