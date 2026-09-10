import { normalizeName } from "./names"

/**
 * Matching a person written one way against the same person written another.
 *
 * The hard case is script: the roster says "محمد عليوي" and the form says
 * "Mohammad Ilaiwi". Nothing about those two strings is comparable until both
 * are reduced to the sound they share, so every cross-script comparison here
 * works on a *consonant skeleton*:
 *
 *   محمد  → m h m d → "mhmd"
 *   Mohammad / Muhammad / Mohamed → "mhmd"
 *
 * Short vowels are not written in Arabic at all, which is exactly why the same
 * name comes back from people in a dozen Latin spellings — so both sides drop
 * a, e, i, o, u (and w/y, which stand in for long vowels) and collapse the
 * digraphs transliterators disagree about (kh/gh/sh/th/dh).
 *
 * The skeleton is deliberately lossy, so a cross-script hit is never treated as
 * proof: it is a *proposal* the UI asks a human to confirm once, after which the
 * spelling is stored as an alias and matched exactly forever after.
 */

export type MatchConfidence = "exact" | "strong" | "possible" | "none"

export interface NameMatch {
  confidence: MatchConfidence
  /** 0–1, only meaningful for name-based matches */
  score: number
  /** what actually matched, for showing the reviewer */
  reason: string
}

const NO_MATCH: NameMatch = { confidence: "none", score: 0, reason: "" }

/* ------------------------------------------------------------------ *
 * Skeletons
 * ------------------------------------------------------------------ */

const ARABIC_LETTERS: Record<string, string> = {
  ا: "", آ: "", أ: "", إ: "", ٱ: "", ء: "", ؤ: "", ئ: "", ى: "", ة: "h",
  ب: "b", پ: "b",
  ت: "t", ث: "t", ط: "t",
  ج: "j", چ: "j",
  ح: "h", ه: "h",
  خ: "k", ك: "k", ق: "k", گ: "k",
  د: "d", ذ: "d", ض: "d",
  ر: "r",
  ز: "z", ظ: "z",
  س: "s", ص: "s",
  ش: "$",
  ع: "",
  غ: "g",
  ف: "f", ڤ: "f",
  ل: "l",
  م: "m",
  ن: "n",
  و: "", // long "ou/oo/u" far more often than a consonant "w"
  ي: "", ی: "",
}

const LATIN_DIGRAPHS: [RegExp, string][] = [
  [/sh/g, "$"],
  [/ch/g, "$"],
  [/kh/g, "k"],
  [/gh/g, "g"],
  [/th/g, "t"],
  [/dh/g, "d"],
  [/ph/g, "f"],
  [/ck/g, "k"],
  [/qu?/g, "k"], // Qasem / Kasem, Tareq / Tarek
]

/**
 * Name parts that belong to the part after them.
 *
 * Arabic writes "عبد الله" as two words and English writes "Abdullah" as one,
 * so counting words would make the same person look like two different people.
 * Gluing these onto the following part — on both sides — makes the spacing
 * irrelevant.
 */
const GLUED_PREFIXES = new Set([
  "عبد", "عبدال", "ابو", "ابن", "بن", "بنت", "ام",
  "abd", "abdul", "abdel", "abdal", "abu", "abo", "abou", "ibn", "bin", "bint", "um", "umm",
])

/**
 * The definite article carries no sound of its own. Arabic joins it to the
 * word ("الخطيب") while English hands it over loose ("Al-Khatib", "Al Zahra",
 * "Alsharif"), so it is thrown away wherever it turns up.
 */
const ARTICLES = new Set(["ال", "al", "el", "ul"])

const isArabic = (text: string) => /[؀-ۿ]/.test(text)

/** Collapse doubles and drop a trailing h (ة, -ah, Salah/صلاح all vary). */
function tidySkeleton(skeleton: string) {
  const collapsed = skeleton.replace(/(.)\1+/g, "$1")
  return collapsed.length > 2 ? collapsed.replace(/h$/, "") : collapsed
}

function arabicSkeleton(token: string) {
  // the definite article is written joined ("الرحمن") but transliterated in a
  // dozen ways ("al-Rahman", "ar Rahman", "Rahman") — drop it on both sides
  const body = token.length > 3 ? token.replace(/^ال/, "") : token
  let out = ""
  for (const char of body) out += ARABIC_LETTERS[char] ?? ""
  return tidySkeleton(out)
}

function latinSkeleton(token: string) {
  let body = token
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "")
  if (body.length > 2) body = body.replace(/^a[lr](?=[a-z])/, "")
  for (const [pattern, replacement] of LATIN_DIGRAPHS) body = body.replace(pattern, replacement)
  return tidySkeleton(body.replace(/x/g, "ks").replace(/c/g, "k").replace(/[aeiouwy]/g, ""))
}

/** Consonant-only form of one name part, in whichever script it was written. */
export function nameSkeleton(token: string) {
  return isArabic(token) ? arabicSkeleton(normalizeName(token)) : latinSkeleton(token)
}

/** Every meaningful part of a full name, as skeletons. Filler words dropped. */
export function nameSkeletons(fullName: string): string[] {
  const normalized = normalizeName(fullName)
    // "Abdul Rahman", "Abdel-Rahman" and "Abdulrahman" are one name written
    // three ways; splitting the article off makes all three line up with عبد
    .replace(/\babd[\s-]?[uae]l[\s-]?/g, "abd ")

  const parts: string[] = []
  let pendingPrefix = ""

  for (const token of normalized.split(/[\s.\-_]+/).filter(Boolean)) {
    if (ARTICLES.has(token)) continue
    const skeleton = nameSkeleton(token)
    if (GLUED_PREFIXES.has(token)) {
      pendingPrefix += skeleton
      continue
    }
    if (!skeleton && !pendingPrefix) continue
    parts.push(tidySkeleton(pendingPrefix + skeleton))
    pendingPrefix = ""
  }
  // a name that ends on a particle ("… Abu") still contributes what it has
  if (pendingPrefix) parts.push(tidySkeleton(pendingPrefix))

  return parts.filter(Boolean)
}

/* ------------------------------------------------------------------ *
 * String similarity
 * ------------------------------------------------------------------ */

/** Dice coefficient over letter bigrams — forgiving of one dropped letter. */
function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const bigrams = new Map<string, number>()
  for (let i = 0; i < a.length - 1; i++) {
    const gram = a.slice(i, i + 2)
    bigrams.set(gram, (bigrams.get(gram) ?? 0) + 1)
  }
  let hits = 0
  for (let i = 0; i < b.length - 1; i++) {
    const gram = b.slice(i, i + 2)
    const left = bigrams.get(gram) ?? 0
    if (left > 0) {
      bigrams.set(gram, left - 1)
      hits++
    }
  }
  return (2 * hits) / (a.length + b.length - 2)
}

/** How well two name parts line up: 1 identical, 0.8+ close, 0 unrelated. */
function partScore(a: string, b: string) {
  if (a === b) return 1
  // a one-letter skeleton (Ali → "l") is too thin to fuzzy-match on
  if (a.length < 2 || b.length < 2) return 0
  const score = similarity(a, b)
  return score >= 0.8 ? score : 0
}

/* ------------------------------------------------------------------ *
 * Comparing two names
 * ------------------------------------------------------------------ */

/**
 * How likely two written names are the same person.
 *
 * People write three or four parts on one form and two on the next, so the
 * shorter name is the yardstick: every part of it has to be somewhere in the
 * longer one. Order is ignored — "Ilaiwi Mohammad" is the same person.
 */
export function compareNames(left: string, right: string): NameMatch {
  const [a, b] = [left?.trim() ?? "", right?.trim() ?? ""]
  if (!a || !b) return NO_MATCH

  const [normA, normB] = [normalizeName(a), normalizeName(b)]
  if (normA === normB) {
    return { confidence: "exact", score: 1, reason: "Identical name" }
  }

  const sameScript = isArabic(a) === isArabic(b)
  const partsA = nameSkeletons(a)
  const partsB = nameSkeletons(b)
  if (!partsA.length || !partsB.length) return NO_MATCH

  // greedy: each part of the shorter name claims one unused part of the longer
  const [short, long] = partsA.length <= partsB.length ? [partsA, partsB] : [partsB, partsA]
  const taken = new Set<number>()
  let matched = 0
  let approximated = false
  for (const part of short) {
    let bestIndex = -1
    let bestScore = 0
    long.forEach((other, i) => {
      if (taken.has(i)) return
      const score = partScore(part, other)
      if (score > bestScore) {
        bestScore = score
        bestIndex = i
      }
    })
    if (bestIndex >= 0) {
      taken.add(bestIndex)
      matched++
      if (bestScore < 1) approximated = true
    }
  }

  const coverage = matched / short.length
  // "عبد الله" is two parts and "Abdullah" is one — compare the run-together
  // forms too so the way a name is spaced never decides the outcome
  const joined = similarity(partsA.join(""), partsB.join(""))
  const score = Math.max(coverage, joined)

  const script = sameScript ? "spelling" : "Arabic ↔ English"
  const full = coverage === 1 && short.length >= 2

  // Consonant skeletons are lossy on purpose, and a *near* miss between two of
  // them is where they stop being trustworthy: "احمد" reduces to hmd and
  // "Mahmoud" to mhmd, which are one letter apart and different people. So a
  // match is only ever called likely when every part lined up letter for
  // letter; anything approximate goes to a human.
  if (full && !approximated && (long.length - short.length <= 2 || joined >= 0.6)) {
    return {
      confidence: "strong",
      score,
      reason: `Same name, different ${script} (${short.length} of ${long.length} parts matched)`,
    }
  }
  if (matched >= 2 || full || joined >= 0.85) {
    return {
      confidence: "possible",
      score: score * 0.9,
      reason: approximated
        ? `Close, but not an exact match on every part (${matched} of ${short.length})`
        : `Possibly the same person (${matched} name part${matched === 1 ? "" : "s"} matched)`,
    }
  }
  return NO_MATCH
}

/* ------------------------------------------------------------------ *
 * Identity keys — always better evidence than a name
 * ------------------------------------------------------------------ */

/** Last 9 digits, so 079…, +96279… and 00962 79… are one number. */
export function normalizePhone(phone: string | null | undefined) {
  const digits = (phone ?? "").replace(/\D/g, "")
  return digits.length >= 8 ? digits.slice(-9) : ""
}

export function normalizeId(value: string | null | undefined) {
  return (value ?? "").replace(/\s/g, "").toLowerCase()
}

export function normalizeEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase()
}

/* ------------------------------------------------------------------ *
 * Matching one person against a roster
 * ------------------------------------------------------------------ */

/** One side of a comparison: a volunteer, or a person who filled in a form. */
export interface MatchablePerson {
  id: string
  name: string
  universityId?: string | null
  phone?: string | null
  email?: string | null
  /** confirmed alternative spellings of `name` */
  aliases?: string[]
}

export interface MatchResult {
  /** the row that was matched, when there is one */
  target: MatchablePerson | null
  confidence: MatchConfidence
  score: number
  reason: string
  /** other rows that scored well — shown when a human has to pick */
  runnersUp: { target: MatchablePerson; reason: string; score: number }[]
}

const NOT_FOUND: MatchResult = {
  target: null,
  confidence: "none",
  score: 0,
  reason: "No match on ID, phone, email or name",
  runnersUp: [],
}

/**
 * Finds `person` in `roster`.
 *
 * University ID, phone and email are checked first and settle it outright:
 * they identify one human being, whereas plenty of volunteers share a name.
 * Only when none of them is on file does the name decide, and a name-only
 * result is never returned as `exact`.
 */
export function matchPerson(person: MatchablePerson, roster: MatchablePerson[]): MatchResult {
  const key = {
    universityId: normalizeId(person.universityId),
    phone: normalizePhone(person.phone),
    email: normalizeEmail(person.email),
  }

  for (const [field, label] of [
    ["universityId", "university ID"],
    ["phone", "phone"],
    ["email", "email"],
  ] as const) {
    const value = key[field]
    if (!value) continue
    const hit = roster.find((candidate) => {
      const other =
        field === "phone"
          ? normalizePhone(candidate.phone)
          : field === "email"
            ? normalizeEmail(candidate.email)
            : normalizeId(candidate.universityId)
      return other && other === value
    })
    if (hit) {
      return {
        target: hit,
        confidence: "exact",
        score: 1,
        reason: `Matched by ${label}`,
        runnersUp: [],
      }
    }
  }

  if (!person.name?.trim()) return NOT_FOUND

  // a spelling somebody already confirmed is as good as an ID
  const normalized = normalizeName(person.name)
  const byAlias = roster.find((candidate) =>
    (candidate.aliases ?? []).some((alias) => normalizeName(alias) === normalized)
  )
  if (byAlias) {
    return {
      target: byAlias,
      confidence: "exact",
      score: 1,
      reason: "Confirmed spelling of this volunteer's name",
      runnersUp: [],
    }
  }

  const scored = roster
    .map((candidate) => {
      const direct = compareNames(person.name, candidate.name)
      // an alias may be the closer spelling even when it isn't identical
      const best = (candidate.aliases ?? []).reduce((winner, alias) => {
        const viaAlias = compareNames(person.name, alias)
        return viaAlias.score > winner.score ? viaAlias : winner
      }, direct)
      return { target: candidate, ...best }
    })
    .filter((row) => row.confidence !== "none")
    .sort((a, b) => b.score - a.score)

  if (!scored.length) return NOT_FOUND

  const [best, ...rest] = scored
  const tied = rest.filter((row) => best.score - row.score < 0.05)

  // two people the roster can't tell apart is a question for a human, not a
  // coin flip — hand back the candidates instead of picking one
  if (tied.length) {
    return {
      target: null,
      confidence: "possible",
      score: best.score,
      reason: `${tied.length + 1} volunteers match this name — pick the right one`,
      runnersUp: [best, ...tied].map(({ target, reason, score }) => ({ target, reason, score })),
    }
  }

  return {
    target: best.target,
    // a name alone is never proof, so it never reports better than "strong"
    confidence: best.confidence === "exact" ? "strong" : best.confidence,
    score: best.score,
    reason: best.reason,
    runnersUp: rest.slice(0, 3).map(({ target, reason, score }) => ({ target, reason, score })),
  }
}

export const CONFIDENCE_LABELS: Record<MatchConfidence, string> = {
  exact: "Certain",
  strong: "Very likely",
  possible: "Needs review",
  none: "Not found",
}
