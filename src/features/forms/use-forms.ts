import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { normalizeName } from "@/lib/names"
import { slugify } from "@/lib/slug"
import { planRenewalMerge, renewalNoteEntry, summariseMerge } from "./renewal-merge"

export { slugify } from "@/lib/slug"
import type {
  FormFieldRow,
  FormFieldType,
  FormResponseRow,
  FormRow,
  VolunteerPrivateInsert,
  VolunteerPrivateRow,
  VolunteerUpdate,
} from "@/types/database.types"

export interface FormWithCounts extends FormRow {
  form_responses: { id: string; status: string }[]
}

/** Volunteer columns a form field can feed into when a response is accepted. */
export const FIELD_MAPPINGS = [
  { value: "full_name", label: "Full name", target: "volunteers" },
  { value: "university_id", label: "University ID", target: "private" },
  { value: "major", label: "Major", target: "private" },
  { value: "phone", label: "WhatsApp / phone", target: "private" },
  { value: "email", label: "Email", target: "private" },
  { value: "city", label: "City / residence", target: "private" },
  { value: "department", label: "Team / department (by name)", target: "volunteers" },
  { value: "languages", label: "Languages", target: "private" },
  { value: "skills", label: "Skills", target: "private" },
  { value: "availability", label: "Availability", target: "private" },
  { value: "internal_notes", label: "Notes", target: "private" },
] as const

/** Question labels that give away which volunteer column they belong to. */
const MAPPING_HINTS: [string, RegExp][] = [
  ["full_name", /\b(full ?name|your name)\b|الاسم ?الكامل|الاسم ?الثلاثي|^\s*(الاسم|اسم)/i],
  ["university_id", /\b(university|student|uni)[ _-]?(id|number|no)\b|الرقم ?الجامعي|رقم ?الطالب/i],
  ["phone", /\b(phone|mobile|whats ?app)\b|هاتف|جوال|موبايل|واتس/i],
  ["email", /\b(e-?mail)\b|ايميل|إيميل|بريد/i],
  ["major", /\b(major|specialisation|specialization|faculty)\b|التخصص|الكليه|الكلية/i],
  ["city", /\b(city|town|residence|address)\b|المدينه|المدينة|السكن|العنوان/i],
  ["department", /\b(team|department|committee)\b|الفريق|القسم|اللجنه|اللجنة/i],
  ["languages", /\b(languages?)\b|اللغات|اللغه|اللغة/i],
  ["skills", /\b(skills?)\b|المهارات|مهارات/i],
  ["availability", /\b(availability|available|free ?time)\b|التفرغ|الاوقات|الأوقات|متاح/i],
]

/**
 * Guesses which volunteer column a question feeds.
 *
 * Used when questions arrive from outside the builder — an uploaded HTML form
 * — where nobody has picked a mapping yet. A wrong guess is visible and
 * changeable in the question's own dropdown, so guessing beats leaving every
 * imported question unmapped.
 */
export function guessMapping(label: string): string | null {
  if (!label?.trim()) return null
  for (const [target, pattern] of MAPPING_HINTS) {
    if (pattern.test(label)) return target
  }
  return null
}

export const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
  { value: "radio", label: "Multiple choice (one)" },
  { value: "checkbox", label: "Checkboxes (many)" },
]

/**
 * Finds the volunteer a form response belongs to.
 *
 * University ID and phone are checked before the name: they identify one
 * person, whereas two different volunteers can easily share a common name.
 * Returns null when nobody matches.
 */
export async function findMatchingVolunteer(mapped: Record<string, string>) {
  const [{ data: volunteers }, { data: privates }] = await Promise.all([
    supabase.from("volunteers").select("id, full_name"),
    supabase.from("volunteer_private").select("volunteer_id, phone, university_id"),
  ])

  const byId =
    mapped.university_id &&
    (privates ?? []).find((v) => v.university_id === mapped.university_id)?.volunteer_id
  if (byId) return { id: byId, matchedOn: "university ID" as const }

  const byPhone =
    mapped.phone && (privates ?? []).find((v) => v.phone === mapped.phone)?.volunteer_id
  if (byPhone) return { id: byPhone, matchedOn: "phone" as const }

  const byName =
    mapped.full_name &&
    (volunteers ?? []).find(
      (v) => normalizeName(v.full_name) === normalizeName(mapped.full_name)
    )?.id
  if (byName) return { id: byName, matchedOn: "name" as const }

  return null
}



export function useForms() {
  return useQuery({
    queryKey: ["forms"],
    queryFn: async (): Promise<FormWithCounts[]> => {
      const { data, error } = await supabase
        .from("forms")
        .select("*, form_responses (id, status)")
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as unknown as FormWithCounts[]
    },
  })
}

export function useForm(idOrSlug: string | undefined, bySlug = false) {
  return useQuery({
    queryKey: ["form", idOrSlug, bySlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms")
        .select("*")
        .eq(bySlug ? "slug" : "id", idOrSlug!)
        .maybeSingle()
      if (error) throw error
      return (data as FormRow | null) ?? null
    },
    enabled: !!idOrSlug,
  })
}

export function useFormFields(formId: string | undefined) {
  return useQuery({
    queryKey: ["form-fields", formId],
    queryFn: async (): Promise<FormFieldRow[]> => {
      const { data, error } = await supabase
        .from("form_fields")
        .select("*")
        .eq("form_id", formId!)
        .order("position")
      if (error) throw error
      return data as unknown as FormFieldRow[]
    },
    enabled: !!formId,
  })
}

export function useFormResponses(formId: string | undefined) {
  return useQuery({
    queryKey: ["form-responses", formId],
    queryFn: async (): Promise<FormResponseRow[]> => {
      const { data, error } = await supabase
        .from("form_responses")
        .select("*")
        .eq("form_id", formId!)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as unknown as FormResponseRow[]
    },
    enabled: !!formId,
  })
}

export function useSaveForm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      form,
      fields,
    }: {
      form: Partial<FormRow> & { title: string }
      fields: (Partial<FormFieldRow> & { label: string })[]
    }) => {
      let formId = form.id

      if (formId) {
        const { id, ...updates } = form
        const { error } = await supabase.from("forms").update(updates).eq("id", id!)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from("forms")
          .insert({ ...form, slug: form.slug ?? slugify(form.title) })
          .select("id")
          .single()
        if (error) throw error
        formId = data.id
      }

      // fields are small and fully owned by the form — replace them wholesale
      const { error: delError } = await supabase.from("form_fields").delete().eq("form_id", formId!)
      if (delError) throw delError

      if (fields.length) {
        const { error: insError } = await supabase.from("form_fields").insert(
          fields.map((field, index) => ({
            form_id: formId!,
            label: field.label,
            help_text: field.help_text ?? null,
            field_type: field.field_type ?? "text",
            options: field.options ?? [],
            is_required: field.is_required ?? false,
            maps_to: field.maps_to ?? null,
            position: index,
          }))
        )
        if (insError) throw insError
      }

      return formId!
    },
    onSuccess: (formId) => {
      queryClient.invalidateQueries({ queryKey: ["forms"] })
      queryClient.invalidateQueries({ queryKey: ["form", formId] })
      queryClient.invalidateQueries({ queryKey: ["form-fields", formId] })
    },
  })
}

export function useDeleteForm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("forms").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["forms"] }),
  })
}

export function useSubmitFormResponse() {
  return useMutation({
    mutationFn: async ({
      formId,
      answers,
    }: {
      formId: string
      answers: Record<string, string | string[] | null>
    }) => {
      const { error } = await supabase
        .from("form_responses")
        .insert({ form_id: formId, answers, status: "pending" })
      if (error) throw error
    },
  })
}

/**
 * Turns an accepted response into real data, following the form's configured
 * destination: a new volunteer, a participant on a specific event, or nothing
 * at all (keep it as a record only).
 */
export function useReviewResponse() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      response,
      form,
      fields,
      decision,
      reviewerId,
    }: {
      response: FormResponseRow
      form: FormRow
      fields: FormFieldRow[]
      decision: "approved" | "rejected"
      reviewerId: string | null
    }) => {
      // set once we know which volunteer this response ended up touching
      let touchedVolunteerId: string | null = null

      if (decision === "approved" && form.destination !== "none") {
        // collect the mapped answers by their target column
        const mapped: Record<string, string> = {}
        for (const field of fields) {
          if (!field.maps_to) continue
          const raw = response.answers[field.id]
          const value = Array.isArray(raw) ? raw.join("، ") : (raw ?? "")
          if (value) mapped[field.maps_to] = String(value).trim()
        }

        const fullName = mapped.full_name
        if (!fullName) {
          throw new Error(
            'This form has no field mapped to "Full name", so an accepted response cannot become a volunteer. Edit the form and map one field to Full name.'
          )
        }

        // resolve the team: an explicit answer wins, otherwise the form default
        let departmentId = form.destination_department_id
        if (mapped.department) {
          const { data: depts } = await supabase.from("departments").select("id, name")
          const match = (depts ?? []).find(
            (d) => normalizeName(d.name) === normalizeName(mapped.department)
          )
          if (match) departmentId = match.id
        }

        // ---- renewal: merge into the person we already have, never create ----
        if (form.destination === "renew_volunteers") {
          const match = await findMatchingVolunteer({ ...mapped, full_name: fullName })

          if (!match) {
            // flag it for a human rather than quietly adding a stranger
            await supabase
              .from("form_responses")
              .update({
                review_note: `No volunteer matched "${fullName}" by name, university ID or phone. Handle this one by hand.`,
              })
              .eq("id", response.id)
            throw new Error(
              `${fullName} isn't on the volunteer roster — no match by name, university ID or phone. The response has been flagged for manual review.`
            )
          }

          const [{ data: currentPrivate }, { data: currentVolunteer }] = await Promise.all([
            supabase.from("volunteer_private").select("*").eq("volunteer_id", match.id).maybeSingle(),
            supabase.from("volunteers").select("status").eq("id", match.id).maybeSingle(),
          ])

          const plan = planRenewalMerge(mapped, currentPrivate as VolunteerPrivateRow | null)

          const privateUpdate: VolunteerPrivateInsert = {
            volunteer_id: match.id,
            ...plan.updates,
            renewed_at: new Date().toISOString(),
          }
          // keep the replaced values in the internal notes so nothing is lost
          const noteEntry = renewalNoteEntry(plan)
          if (noteEntry) {
            privateUpdate.internal_notes = [
              (currentPrivate as VolunteerPrivateRow | null)?.internal_notes,
              noteEntry,
            ]
              .filter(Boolean)
              .join("\n")
          }

          const { error: privateError } = await supabase
            .from("volunteer_private")
            .upsert(privateUpdate, { onConflict: "volunteer_id" })
          if (privateError) throw privateError

          const volunteerUpdate: VolunteerUpdate = {}
          if (departmentId) volunteerUpdate.primary_department_id = departmentId
          // renewing puts someone back on the active roster, but a status that
          // means something to the team (needs_follow_up) is left alone
          const dormant = ["new", "inactive", "archived", "on_hold"]
          let reactivated = false
          if (currentVolunteer && dormant.includes(currentVolunteer.status)) {
            volunteerUpdate.status = "active"
            volunteerUpdate.archived_at = null
            reactivated = true
          }
          if (Object.keys(volunteerUpdate).length) {
            const { error: volError } = await supabase
              .from("volunteers")
              .update(volunteerUpdate)
              .eq("id", match.id)
            if (volError) throw volError
          }

          const { error: doneError } = await supabase
            .from("form_responses")
            .update({
              status: decision,
              reviewed_by: reviewerId,
              reviewed_at: new Date().toISOString(),
              volunteer_id: match.id,
              review_note: [
                `Matched by ${match.matchedOn}.`,
                summariseMerge(plan),
                reactivated ? "Status set back to active." : null,
              ]
                .filter(Boolean)
                .join(" "),
            })
            .eq("id", response.id)
          if (doneError) throw doneError
          return
        }

        // reuse an existing volunteer when the person is already on file
        let volunteerId = (await findMatchingVolunteer({ ...mapped, full_name: fullName }))?.id ?? null

        if (!volunteerId) {
          const { data: created, error: createError } = await supabase
            .from("volunteers")
            .insert({
              full_name: fullName,
              primary_department_id: departmentId,
              status: "new",
            })
            .select("id")
            .single()
          if (createError) throw createError
          volunteerId = created.id

          const privatePayload = {
            volunteer_id: volunteerId,
            university_id: mapped.university_id ?? null,
            major: mapped.major ?? null,
            phone: mapped.phone ?? null,
            email: mapped.email ?? null,
            city: mapped.city ?? null,
            languages: mapped.languages ?? null,
            skills: mapped.skills ?? null,
            availability: mapped.availability ?? null,
            internal_notes: mapped.internal_notes ?? null,
          }
          const { error: privateError } = await supabase
            .from("volunteer_private")
            .upsert(privatePayload, { onConflict: "volunteer_id" })
          if (privateError) throw privateError
        }

        touchedVolunteerId = volunteerId

        if (form.destination === "event_participants" && form.destination_event_id) {
          const { error: participantError } = await supabase.from("event_participants").insert({
            event_id: form.destination_event_id,
            volunteer_id: volunteerId,
            department_id: departmentId,
            participation_status: "confirmed",
          })
          // a duplicate just means they were already signed up — not an error worth failing on
          if (participantError && !/duplicate key/i.test(participantError.message)) {
            throw participantError
          }
        }
      }

      const { error } = await supabase
        .from("form_responses")
        .update({
          status: decision,
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          ...(touchedVolunteerId ? { volunteer_id: touchedVolunteerId } : {}),
        })
        .eq("id", response.id)
      if (error) throw error
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["form-responses", variables.form.id] })
      queryClient.invalidateQueries({ queryKey: ["forms"] })
      queryClient.invalidateQueries({ queryKey: ["volunteers"] })
      queryClient.invalidateQueries({ queryKey: ["events"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}
