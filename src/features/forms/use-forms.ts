import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { normalizeName } from "@/lib/names"
import type {
  FormFieldRow,
  FormFieldType,
  FormResponseRow,
  FormRow,
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

export function slugify(title: string) {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
  // Arabic titles can slugify to an empty string — always keep something unique
  return `${base || "form"}-${Math.random().toString(36).slice(2, 7)}`
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

        // reuse an existing volunteer when the person is already on file
        const [{ data: existingNames }, { data: existingPrivate }] = await Promise.all([
          supabase.from("volunteers").select("id, full_name"),
          supabase.from("volunteer_private").select("volunteer_id, phone, university_id"),
        ])

        let volunteerId =
          (existingNames ?? []).find((v) => normalizeName(v.full_name) === normalizeName(fullName))
            ?.id ??
          (existingPrivate ?? []).find(
            (v) =>
              (mapped.university_id && v.university_id === mapped.university_id) ||
              (mapped.phone && v.phone === mapped.phone)
          )?.volunteer_id ??
          null

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
