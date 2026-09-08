import type { VolunteerPrivateRow } from "@/types/database.types"

/**
 * Merging a renewal response into the volunteer we already have.
 *
 * The rules the centre asked for:
 *   - the field was empty on file  → fill it in
 *   - they typed the same value    → change nothing
 *   - they typed something else    → take the new one, and keep a note of
 *                                    what it replaced so nothing is lost
 * A blank answer never wipes a stored value.
 */

/** Private-record columns a form field can feed into during a renewal. */
export const RENEWABLE_FIELDS = [
  { key: "university_id", label: "University ID" },
  { key: "major", label: "Major" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "city", label: "City" },
  { key: "languages", label: "Languages" },
  { key: "skills", label: "Skills" },
  { key: "availability", label: "Availability" },
] as const

export type RenewableKey = (typeof RENEWABLE_FIELDS)[number]["key"]

export interface FieldChange {
  key: RenewableKey
  label: string
  kind: "filled" | "changed"
  from: string | null
  to: string
}

export interface MergePlan {
  /** only the columns that actually need writing */
  updates: Partial<Record<RenewableKey, string>>
  filled: FieldChange[]
  changed: FieldChange[]
  /** true when nothing at all needs to be written */
  unchanged: boolean
}

function isBlank(value: string | null | undefined) {
  return value == null || value.trim() === ""
}

/** Same value once whitespace and case are ignored — phone spacing included. */
function sameValue(a: string, b: string) {
  const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ")
  const digits = (v: string) => v.replace(/\D/g, "")
  if (norm(a) === norm(b)) return true
  // "079 123 4567", "0791234567" and "+962791234567" are all the same number.
  // Only the local part is compared, so a country code isn't a "change".
  const [da, db] = [digits(a), digits(b)]
  if (da.length < 8 || db.length < 8) return false
  return da.slice(-9) === db.slice(-9)
}

/**
 * Works out what a renewal response should change on an existing volunteer.
 * `mapped` holds the answers keyed by each field's `maps_to`.
 */
export function planRenewalMerge(
  mapped: Record<string, string>,
  current: Pick<VolunteerPrivateRow, RenewableKey> | null
): MergePlan {
  const updates: Partial<Record<RenewableKey, string>> = {}
  const filled: FieldChange[] = []
  const changed: FieldChange[] = []

  for (const field of RENEWABLE_FIELDS) {
    const incoming = mapped[field.key]?.trim()
    if (isBlank(incoming)) continue // they left it empty — never wipe what we hold

    const stored: string | null = current?.[field.key] ?? null

    if (stored == null || isBlank(stored)) {
      updates[field.key] = incoming
      filled.push({ key: field.key, label: field.label, kind: "filled", from: null, to: incoming })
      continue
    }

    if (sameValue(stored, incoming)) continue // identical — leave it alone

    updates[field.key] = incoming
    changed.push({
      key: field.key,
      label: field.label,
      kind: "changed",
      from: stored,
      to: incoming,
    })
  }

  return {
    updates,
    filled,
    changed,
    unchanged: filled.length === 0 && changed.length === 0,
  }
}

/** One-line summary shown on the response row. */
export function summariseMerge(plan: MergePlan) {
  if (plan.unchanged) return "Nothing to update — everything already matched."
  const parts: string[] = []
  if (plan.filled.length) {
    parts.push(`Filled ${plan.filled.map((c) => c.label).join(", ")}`)
  }
  if (plan.changed.length) {
    parts.push(
      `Updated ${plan.changed.map((c) => `${c.label} (${c.from} → ${c.to})`).join(", ")}`
    )
  }
  return `${parts.join(". ")}.`
}

/** The trail appended to the volunteer's internal notes, so the old value survives. */
export function renewalNoteEntry(plan: MergePlan, when = new Date()) {
  if (!plan.changed.length) return null
  const stamp = when.toISOString().slice(0, 10)
  const lines = plan.changed.map((c) => `  • ${c.label}: ${c.from} → ${c.to}`)
  return [`[${stamp}] Renewal form updated:`, ...lines].join("\n")
}
