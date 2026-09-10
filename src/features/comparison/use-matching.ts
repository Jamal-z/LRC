import { useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { normalizeName } from "@/lib/names"
import { matchPerson, type MatchablePerson, type MatchResult } from "@/lib/name-match"
import { useVolunteers } from "@/features/volunteers/use-volunteers"
import type { FormFieldRow, FormResponseRow, VolunteerAliasRow } from "@/types/database.types"

/**
 * Turning the things this system stores into people that can be compared.
 *
 * A volunteer is a row with a name; a form response is a bag of answers keyed
 * by field id. Both have to become the same shape — name plus whatever
 * identifiers were collected — before any of them can be matched to each other.
 */

/* ------------------------------------------------------------------ *
 * Confirmed spellings
 * ------------------------------------------------------------------ */

export function useVolunteerAliases() {
  return useQuery({
    queryKey: ["volunteer-aliases"],
    queryFn: async (): Promise<VolunteerAliasRow[]> => {
      const { data, error } = await supabase.from("volunteer_aliases").select("*")
      // Until migration 021 has been run the table simply isn't there yet.
      // Matching still works without it — it just can't remember anything —
      // so the comparison pages stay usable instead of failing outright.
      if (error?.code === "42P01" || error?.code === "PGRST205") return []
      if (error) throw error
      return data as unknown as VolunteerAliasRow[]
    },
  })
}

/**
 * Records that a name written one way is a volunteer we already have.
 *
 * This is the whole point of the review step: confirm "Mohammad Ilaiwi" is
 * محمد عليوي once, and every future form that spells it that way matches him
 * outright instead of asking again.
 */
export function useConfirmMatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      volunteerId,
      name,
      source,
      responseId,
    }: {
      volunteerId: string
      /** the spelling to remember; skipped when it is already the stored name */
      name: string
      source?: string
      /** when the confirmation came from a form response, link it too */
      responseId?: string
    }) => {
      const { data: volunteer } = await supabase
        .from("volunteers")
        .select("full_name")
        .eq("id", volunteerId)
        .maybeSingle()

      const worthStoring =
        name.trim() && normalizeName(name) !== normalizeName(volunteer?.full_name ?? "")

      if (worthStoring) {
        const { error } = await supabase.from("volunteer_aliases").upsert(
          {
            volunteer_id: volunteerId,
            name: name.trim(),
            normalized: normalizeName(name),
            source: source ?? null,
          },
          { onConflict: "volunteer_id,normalized" }
        )
        if (error) throw error
      }

      if (responseId) {
        const { error } = await supabase
          .from("form_responses")
          .update({ volunteer_id: volunteerId })
          .eq("id", responseId)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["volunteer-aliases"] })
      queryClient.invalidateQueries({ queryKey: ["form-responses"] })
    },
  })
}

/** Undoes a confirmation — the response goes back to being unmatched. */
export function useUnlinkResponse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (responseId: string) => {
      const { error } = await supabase
        .from("form_responses")
        .update({ volunteer_id: null, match_dismissed: false })
        .eq("id", responseId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["form-responses"] }),
  })
}

/**
 * The other answer a reviewer can give: this person is nobody we have.
 *
 * Recorded so the same wrong guess is not offered again every time the page
 * is opened.
 */
export function useDismissMatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (responseId: string) => {
      const { error } = await supabase
        .from("form_responses")
        .update({ match_dismissed: true, volunteer_id: null })
        .eq("id", responseId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["form-responses"] }),
  })
}

/* ------------------------------------------------------------------ *
 * Reading a person out of a form response
 * ------------------------------------------------------------------ */

const answerText = (value: string | string[] | null | undefined) =>
  Array.isArray(value) ? value.join("، ") : (value ?? "")

/** Labels that mean a field holds this identifier, when nothing is mapped. */
const LABEL_HINTS: Record<"full_name" | "university_id" | "phone" | "email", RegExp> = {
  full_name: /\b(full ?name|name)\b|الاسم|اسم/i,
  university_id: /\b(university|student|uni)[ _-]?(id|number|no)\b|الرقم ?الجامعي|رقم ?الطالب/i,
  phone: /\b(phone|mobile|whats ?app|number)\b|هاتف|جوال|موبايل|واتس|رقم ?ال?موبايل/i,
  email: /\b(e-?mail)\b|ايميل|إيميل|بريد/i,
}

export interface IdentityFields {
  full_name?: FormFieldRow
  university_id?: FormFieldRow
  phone?: FormFieldRow
  email?: FormFieldRow
}

/**
 * Works out which questions on a form hold the identifiers.
 *
 * An explicit mapping (set in the form builder) always wins. Forms built
 * before mapping existed — or built in a hurry — fall back to reading the
 * question label, in Arabic or English.
 */
export function identityFields(fields: FormFieldRow[]): IdentityFields {
  const found: IdentityFields = {}

  for (const key of ["full_name", "university_id", "phone", "email"] as const) {
    found[key] = fields.find((field) => field.maps_to === key)
  }

  for (const key of ["full_name", "university_id", "phone", "email"] as const) {
    if (found[key]) continue
    found[key] = fields.find(
      (field) =>
        !field.maps_to &&
        !Object.values(found).includes(field) &&
        field.field_type !== "checkbox" &&
        LABEL_HINTS[key].test(field.label)
    )
  }

  // an email/phone question is recognisable by its type even when the label is odd
  found.email ??= fields.find((field) => field.field_type === "email")
  found.phone ??= fields.find((field) => field.field_type === "phone")

  return found
}

/** The person behind one response, ready to be matched against the roster. */
export function responsePerson(
  response: FormResponseRow,
  keys: IdentityFields
): MatchablePerson {
  return {
    id: response.id,
    name: keys.full_name ? answerText(response.answers[keys.full_name.id]).trim() : "",
    universityId: keys.university_id ? answerText(response.answers[keys.university_id.id]) : null,
    phone: keys.phone ? answerText(response.answers[keys.phone.id]) : null,
    email: keys.email ? answerText(response.answers[keys.email.id]) : null,
  }
}

/**
 * A label for whoever filled a response.
 *
 * Falls back through the identifiers that were actually collected, so a form
 * that never asked for a name still shows something a human recognises rather
 * than a row of blanks.
 */
export function respondentLabel(response: FormResponseRow, keys: IdentityFields) {
  const person = responsePerson(response, keys)
  return (
    person.name ||
    person.email ||
    person.phone ||
    (person.universityId ? `ID ${person.universityId}` : "") ||
    `Anonymous · ${response.id.slice(0, 6)}`
  )
}

/* ------------------------------------------------------------------ *
 * The roster
 * ------------------------------------------------------------------ */

export interface RosterEntry extends MatchablePerson {
  department: string | null
  status: string
}

/** The volunteer roster in matchable form, with every confirmed spelling. */
export function useVolunteerRoster() {
  const volunteers = useVolunteers()
  const aliases = useVolunteerAliases()

  const roster = useMemo<RosterEntry[]>(() => {
    const byVolunteer = new Map<string, string[]>()
    for (const alias of aliases.data ?? []) {
      byVolunteer.set(alias.volunteer_id, [...(byVolunteer.get(alias.volunteer_id) ?? []), alias.name])
    }
    return (volunteers.data ?? []).map((volunteer) => ({
      id: volunteer.id,
      name: volunteer.full_name,
      universityId: volunteer.volunteer_private?.university_id ?? null,
      phone: volunteer.volunteer_private?.phone ?? null,
      email: volunteer.volunteer_private?.email ?? null,
      aliases: byVolunteer.get(volunteer.id) ?? [],
      department: volunteer.departments?.name ?? null,
      status: volunteer.status,
    }))
  }, [volunteers.data, aliases.data])

  return {
    roster,
    isLoading: volunteers.isLoading || aliases.isLoading,
    error: volunteers.error ?? aliases.error,
  }
}

/* ------------------------------------------------------------------ *
 * Comparing two lists of people
 * ------------------------------------------------------------------ */

export interface ComparisonRow {
  /** the person from the left-hand list */
  source: MatchablePerson
  match: MatchResult
  /** already confirmed by a human, or by an accepted response */
  confirmed: boolean
}

export interface Comparison {
  /** left-hand people who were found on the right */
  matched: ComparisonRow[]
  /** found, but the app is not sure enough to count it without a human */
  review: ComparisonRow[]
  /** left-hand people with nobody on the right */
  missing: ComparisonRow[]
  /** right-hand people nobody on the left matched — "who hasn't filled it in" */
  unmatchedTargets: MatchablePerson[]
}

/**
 * Matches every person in `sources` against `targets`.
 *
 * `confirmedTargetIds` short-circuits the guessing for rows a human already
 * settled (a confirmed alias, or an accepted form response that is already
 * linked to a volunteer), so confirmations survive a page reload.
 */
export function comparePeople(
  sources: MatchablePerson[],
  targets: MatchablePerson[],
  confirmedTargetIds: Map<string, string> = new Map(),
  /** sources a reviewer already said are on neither list */
  dismissedSourceIds: Set<string> = new Set()
): Comparison {
  const matched: ComparisonRow[] = []
  const review: ComparisonRow[] = []
  const missing: ComparisonRow[] = []
  const hit = new Set<string>()

  for (const source of sources) {
    const confirmedId = confirmedTargetIds.get(source.id)
    if (confirmedId) {
      const target = targets.find((candidate) => candidate.id === confirmedId)
      if (target) {
        hit.add(target.id)
        matched.push({
          source,
          confirmed: true,
          match: { target, confidence: "exact", score: 1, reason: "Confirmed", runnersUp: [] },
        })
        continue
      }
    }

    if (dismissedSourceIds.has(source.id)) {
      missing.push({
        source,
        confirmed: true,
        match: { target: null, confidence: "none", score: 0, reason: "Checked — not on the roster", runnersUp: [] },
      })
      continue
    }

    const match = matchPerson(source, targets)
    const row: ComparisonRow = { source, match, confirmed: false }

    if (match.confidence === "exact" && match.target) {
      hit.add(match.target.id)
      matched.push(row)
    } else if (match.target || match.runnersUp.length) {
      // "very likely" still counts towards the totals, but stays reviewable
      if (match.confidence === "strong" && match.target) hit.add(match.target.id)
      review.push(row)
    } else {
      missing.push(row)
    }
  }

  return {
    matched,
    review,
    missing,
    unmatchedTargets: targets.filter((target) => !hit.has(target.id)),
  }
}
