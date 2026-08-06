import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { normalizeName } from "@/lib/names"
import type { InterviewRow, InterviewStatus } from "@/types/database.types"

/**
 * The ten things a candidate is scored on, 1–5 stars each.
 * Stored in `interviews.ratings` as a jsonb object keyed by `key`, so this
 * list can be edited without touching the database.
 */
export const INTERVIEW_CRITERIA = [
  { key: "communication", label: "Communication", hint: "Speaks clearly and listens well" },
  { key: "arabic", label: "Arabic", hint: "Fluency in Arabic" },
  { key: "english", label: "English", hint: "Fluency in English" },
  { key: "other_languages", label: "Other languages", hint: "Any additional language they speak" },
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
      } else {
        const { error } = await supabase.from("interviews").insert(input)
        if (error) throw error
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["interviews"] }),
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["interviews"] }),
  })
}

/** Turns an accepted candidate into a real volunteer (with duplicate checking). */
export function useConvertInterview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (interview: InterviewRow) => {
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
        internal_notes: [interview.notes, interview.strengths && `Strengths: ${interview.strengths}`]
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
