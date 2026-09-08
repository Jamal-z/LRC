import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { normalizeName } from "@/lib/names"
import type {
  FormFieldRow,
  FormResponseRow,
  FormRow,
  InterviewRow,
  InterviewStatus,
} from "@/types/database.types"

/**
 * What a candidate is scored on, 1–5 stars each, with room for a short note
 * beside every one. Stored in `interviews.ratings` / `interviews.criteria_notes`
 * as jsonb keyed by `key`, so the committee can change this list without a
 * migration.
 *
 * Arabic fluency was dropped (every candidate speaks it) and "other languages"
 * became the free-text `languages` field — stars said nothing useful there.
 */
export const INTERVIEW_CRITERIA = [
  { key: "communication", label: "Communication", hint: "Speaks clearly and listens well" },
  { key: "english", label: "English", hint: "Their level of English" },
  { key: "creativity", label: "Creativity", hint: "Brings ideas of their own" },
  { key: "talent", label: "Talent / skills", hint: "Design, photography, teaching, writing…" },
  { key: "commitment", label: "Commitment", hint: "How dependable they are likely to be" },
  { key: "availability", label: "Availability", hint: "Free time that matches our activities" },
  { key: "teamwork", label: "Teamwork", hint: "Comfortable working with a group" },
  { key: "motivation", label: "Motivation", hint: "Why they want to volunteer with us" },
] as const

export type InterviewCriterionKey = (typeof INTERVIEW_CRITERIA)[number]["key"]

export const INTERVIEW_STATUS_LABELS: Record<InterviewStatus, string> = {
  accepted: "Accepted",
  maybe: "Maybe",
  rejected: "Rejected",
}

export const INTERVIEW_STATUS_BADGE: Record<InterviewStatus, string> = {
  accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  maybe: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
}

export function interviewAverage(ratings: Record<string, number> | null | undefined) {
  const values = Object.values(ratings ?? {}).filter(
    (value): value is number => typeof value === "number"
  )
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

export interface InterviewWithRelations extends InterviewRow {
  departments: { id: string; name: string } | null
  profiles: { id: string; full_name: string } | null
}

export function useInterviews() {
  return useQuery({
    queryKey: ["interviews"],
    queryFn: async (): Promise<InterviewWithRelations[]> => {
      const { data, error } = await supabase
        .from("interviews")
        .select("*, departments (id, name), profiles:interviewed_by (id, full_name)")
        .order("interviewed_at", { ascending: false })
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as unknown as InterviewWithRelations[]
    },
  })
}

export function useInterview(id: string | undefined) {
  return useQuery({
    queryKey: ["interview", id],
    queryFn: async (): Promise<InterviewWithRelations | null> => {
      const { data, error } = await supabase
        .from("interviews")
        .select("*, departments (id, name), profiles:interviewed_by (id, full_name)")
        .eq("id", id!)
        .maybeSingle()
      if (error) throw error
      return (data as unknown as InterviewWithRelations) ?? null
    },
    enabled: !!id,
  })
}

export interface SaveInterviewInput {
  id?: string
  full_name: string
  university_id: string | null
  major: string | null
  phone: string | null
  email: string | null
  city: string | null
  department_id: string | null
  ratings: Record<string, number>
  criteria_notes: Record<string, string>
  languages: string | null
  volunteered_before: boolean | null
  previous_volunteering: string | null
  other_skills: string | null
  applied_before: boolean | null
  overall_rating: number | null
  applied_for: string | null
  form_response_id: string | null
  notes: string | null
  strengths: string | null
  concerns: string | null
  status: InterviewStatus
  interviewed_by: string | null
  interviewed_at: string
}

export function useSaveInterview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: SaveInterviewInput) => {
      if (input.id) {
        const { id, ...updates } = input
        const { error } = await supabase.from("interviews").update(updates).eq("id", id)
        if (error) throw error
        return id
      }
      const { data, error } = await supabase
        .from("interviews")
        .insert(input)
        .select("id")
        .single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["interviews"] })
      queryClient.invalidateQueries({ queryKey: ["interview", id] })
      queryClient.invalidateQueries({ queryKey: ["form-applicants"] })
    },
  })
}

export function useSetInterviewStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: InterviewStatus }) => {
      const { error } = await supabase.from("interviews").update({ status }).eq("id", id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["interviews"] }),
  })
}

export function useDeleteInterview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("interviews").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interviews"] })
      queryClient.invalidateQueries({ queryKey: ["form-applicants"] })
    },
  })
}

/* ------------------------------------------------------------------ */
/* Applicants waiting to be interviewed, pulled straight from a form   */
/* ------------------------------------------------------------------ */

/** One person who filled in a form, with their answers already unpacked. */
export interface FormApplicant {
  responseId: string
  formId: string
  formTitle: string
  submittedAt: string
  responseStatus: FormResponseRow["status"]
  /** the answers mapped onto volunteer columns via each field's `maps_to` */
  mapped: Record<string, string>
  /** every answer, in the form's own order, for reading during the interview */
  answers: { label: string; value: string }[]
  fullName: string
  /** set once someone has opened an interview for this response */
  interviewId: string | null
}

/** Forms that have at least one response — the "where do I pick people from" list. */
export function useFormsWithResponses() {
  return useQuery({
    queryKey: ["forms-with-responses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms")
        .select("id, title, slug, is_active, created_at, form_responses (id, status)")
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data as unknown as (Pick<
        FormRow,
        "id" | "title" | "slug" | "is_active" | "created_at"
      > & {
        form_responses: { id: string; status: string }[]
      })[]).filter((form) => form.form_responses.length > 0)
    },
  })
}

function answerToText(raw: string | string[] | null | undefined) {
  if (raw == null) return ""
  return Array.isArray(raw) ? raw.join("، ") : String(raw)
}

/** Everyone who filled in one form, ready to be interviewed. */
export function useFormApplicants(formId: string | undefined) {
  return useQuery({
    queryKey: ["form-applicants", formId],
    queryFn: async (): Promise<FormApplicant[]> => {
      const [{ data: form }, { data: fields }, { data: responses }, { data: interviews }] =
        await Promise.all([
          supabase.from("forms").select("id, title").eq("id", formId!).maybeSingle(),
          supabase.from("form_fields").select("*").eq("form_id", formId!).order("position"),
          supabase
            .from("form_responses")
            .select("*")
            .eq("form_id", formId!)
            .order("created_at", { ascending: false }),
          supabase.from("interviews").select("id, form_response_id").not("form_response_id", "is", null),
        ])

      const fieldRows = (fields ?? []) as unknown as FormFieldRow[]
      const interviewByResponse = new Map(
        (interviews ?? []).map((i) => [i.form_response_id as string, i.id as string])
      )

      return ((responses ?? []) as unknown as FormResponseRow[]).map((response) => {
        const mapped: Record<string, string> = {}
        const answers: { label: string; value: string }[] = []

        for (const field of fieldRows) {
          const value = answerToText(response.answers[field.id]).trim()
          answers.push({ label: field.label, value })
          if (field.maps_to && value) mapped[field.maps_to] = value
        }

        return {
          responseId: response.id,
          formId: response.form_id,
          formTitle: form?.title ?? "",
          submittedAt: response.created_at,
          responseStatus: response.status,
          mapped,
          answers,
          fullName: mapped.full_name || "(no name given)",
          interviewId: interviewByResponse.get(response.id) ?? null,
        }
      })
    },
    enabled: !!formId,
  })
}

/** Loads one applicant so a fresh interview page can pre-fill itself. */
export function useFormApplicant(responseId: string | undefined) {
  return useQuery({
    queryKey: ["form-applicant", responseId],
    queryFn: async (): Promise<FormApplicant | null> => {
      const { data: response, error } = await supabase
        .from("form_responses")
        .select("*")
        .eq("id", responseId!)
        .maybeSingle()
      if (error) throw error
      if (!response) return null

      const row = response as unknown as FormResponseRow
      const [{ data: form }, { data: fields }] = await Promise.all([
        supabase.from("forms").select("id, title").eq("id", row.form_id).maybeSingle(),
        supabase.from("form_fields").select("*").eq("form_id", row.form_id).order("position"),
      ])

      const mapped: Record<string, string> = {}
      const answers: { label: string; value: string }[] = []
      for (const field of (fields ?? []) as unknown as FormFieldRow[]) {
        const value = answerToText(row.answers[field.id]).trim()
        answers.push({ label: field.label, value })
        if (field.maps_to && value) mapped[field.maps_to] = value
      }

      return {
        responseId: row.id,
        formId: row.form_id,
        formTitle: form?.title ?? "",
        submittedAt: row.created_at,
        responseStatus: row.status,
        mapped,
        answers,
        fullName: mapped.full_name || "(no name given)",
        interviewId: null,
      }
    },
    enabled: !!responseId,
  })
}

/** Everything turning a candidate into a volunteer needs off the interview. */
export type ConvertibleInterview = Pick<
  InterviewRow,
  | "id"
  | "full_name"
  | "university_id"
  | "major"
  | "phone"
  | "email"
  | "city"
  | "department_id"
  | "languages"
  | "other_skills"
  | "notes"
  | "strengths"
  | "previous_volunteering"
>

/** Turns an accepted candidate into a real volunteer (with duplicate checking). */
export function useConvertInterview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (interview: ConvertibleInterview) => {
      const [{ data: existingNames }, { data: existingPrivate }] = await Promise.all([
        supabase.from("volunteers").select("id, full_name"),
        supabase.from("volunteer_private").select("volunteer_id, phone, university_id"),
      ])

      const duplicate =
        (existingNames ?? []).some(
          (v) => normalizeName(v.full_name) === normalizeName(interview.full_name)
        ) ||
        (existingPrivate ?? []).some(
          (v) =>
            (interview.university_id && v.university_id === interview.university_id) ||
            (interview.phone && v.phone === interview.phone)
        )
      if (duplicate) {
        throw new Error("A volunteer with the same name / university ID / phone already exists.")
      }

      const { data: created, error: insertError } = await supabase
        .from("volunteers")
        .insert({
          full_name: interview.full_name,
          primary_department_id: interview.department_id,
          status: "new",
        })
        .select("id")
        .single()
      if (insertError) throw insertError

      const { error: privateError } = await supabase.from("volunteer_private").insert({
        volunteer_id: created.id,
        university_id: interview.university_id,
        major: interview.major,
        phone: interview.phone,
        email: interview.email,
        city: interview.city,
        languages: interview.languages,
        skills: interview.other_skills,
        internal_notes: [
          interview.notes,
          interview.strengths && `Strengths: ${interview.strengths}`,
          interview.previous_volunteering && `Volunteered before: ${interview.previous_volunteering}`,
        ]
          .filter(Boolean)
          .join("\n"),
      })
      if (privateError) throw privateError

      const { error: updateError } = await supabase
        .from("interviews")
        .update({
          converted_volunteer_id: created.id,
          converted_at: new Date().toISOString(),
          status: "accepted",
        })
        .eq("id", interview.id)
      if (updateError) throw updateError

      return created.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interviews"] })
      queryClient.invalidateQueries({ queryKey: ["volunteers"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}
