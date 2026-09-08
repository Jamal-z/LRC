/**
 * Public form links are pasted into WhatsApp, printed on posters and turned
 * into QR codes, so a slug has to survive all of that. A raw Arabic slug does
 * not: it becomes a wall of percent-encoding, and several proxies and link
 * previewers mangle or reject it outright.
 *
 * So every slug we generate is plain ASCII — Arabic titles are transliterated
 * rather than dropped, which keeps the link readable.
 */

/** Arabic letter → Latin. Two-letter forms come first so they win. */
const ARABIC_MAP: [RegExp, string][] = [
  [/[أإآٱا]/g, "a"],
  [/[ثذ]/g, "th"],
  [/خ/g, "kh"],
  [/ش/g, "sh"],
  [/غ/g, "gh"],
  [/ب/g, "b"],
  [/[تط]/g, "t"],
  [/ج/g, "j"],
  [/[حه]/g, "h"],
  [/د/g, "d"],
  [/ر/g, "r"],
  [/[زظ]/g, "z"],
  [/[سص]/g, "s"],
  [/ض/g, "d"],
  [/ع/g, "a"],
  [/ف/g, "f"],
  [/ق/g, "q"],
  [/ك/g, "k"],
  [/ل/g, "l"],
  [/م/g, "m"],
  [/ن/g, "n"],
  [/[وؤ]/g, "w"],
  [/[يیىئ]/g, "y"],
  [/ة/g, "h"],
  [/[ءّ]/g, ""],
]

/** Arabic-Indic and Eastern Arabic-Indic digits → 0-9. */
function latinDigits(value: string) {
  return value.replace(/[٠-٩۰-۹]/g, (d) =>
    String(
      d.charCodeAt(0) >= 0x06f0 ? d.charCodeAt(0) - 0x06f0 : d.charCodeAt(0) - 0x0660
    )
  )
}

/** Turns any title into an ASCII-safe, URL-safe string (may be empty). */
export function transliterate(title: string) {
  let out = latinDigits(title)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // Latin accents: é → e
    .replace(/[ً-ْـ]/g, "") // Arabic diacritics + tatweel

  for (const [pattern, replacement] of ARABIC_MAP) {
    out = out.replace(pattern, replacement)
  }

  return out
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "")
}

/**
 * A unique, ASCII-only slug for a form. The random suffix keeps two forms with
 * the same title apart; `form` is the fallback when a title transliterates to
 * nothing at all (an emoji-only title, say).
 */
export function slugify(title: string) {
  return `${transliterate(title) || "form"}-${Math.random().toString(36).slice(2, 7)}`
}

/** True when a slug would need percent-encoding to sit in a URL. */
export function isAsciiSlug(slug: string) {
  return /^[a-z0-9-]+$/i.test(slug)
}
