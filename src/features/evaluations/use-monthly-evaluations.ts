import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { MonthlyEvaluationRow } from "@/types/database.types"

/**
 * Monthly team evaluation — for departments that work continuously (Social
 * Media, Design, Translation…) rather than only around events.
 */
export const MONTHLY_CRITERIA = [
  { key: "commitment_rating", label: "Commitment", hint: "Shows up and follows through" },
  { key: "quality_rating", label: "Quality of work", hint: "Standard of what they produced" },
  { key: "communication_rating", label: "Communication", hint: "Responsiveness and clarity" },
  { key: "teamwork_rating", label: "Teamwork", hint: "Working with the rest of the team" },
  { key: "initiative_rating", label: "Initiative", hint: "Brings ideas without being asked" },
] as const

export type MonthlyCriterionKey = (typeof MONTHLY_CRITERIA)[number]["key"]

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

export function monthlyAverage(evaluation: Partial<Record<MonthlyCriterionKey, number | null>>) {
  const values = MONTHLY_CRITERIA.map((c) => evaluation[c.key]).filter(
    (v): v is number => v != null
  )
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

export interface MonthlyTarget {
  volunteerId: string
  fullName: string
  photoUrl: string | null
  evaluation: MonthlyEvaluationRow | null
  evaluatedByName: string | null
  isOwnEvaluation: boolean
}

export function useMonthlyTargets(
  departmentId: string | undefined,
  month: number,
  year: number,
  evaluatorId: string | undefined,
  isReviewer = false
) {
  return useQuery({
    queryKey: ["monthly-targets", departmentId, month, year, evaluatorId, isReviewer],
    queryFn: async () => {
      const [membersRes, evalsRes] = await Promise.all([
        supabase
          .from("volunteer_departments")
          .select("volunteer_id, volunteers!inner (id, full_name, photo_url, status)")
          .eq("department_id", departmentId!)
          .neq("volunteers.status", "archived"),
        supabase
          .from("monthly_evaluations")
          .select("*, profiles:evaluated_by (id, full_name)")
          .eq("department_id", departmentId!)
          .eq("month", month)
          .eq("year", year),
      ])
      if (membersRes.error) throw membersRes.error
      if (evalsRes.error) throw evalsRes.error

      const evaluations = (evalsRes.data ?? []) as unknown as (MonthlyEvaluationRow & {
        profiles: { id: string; full_name: string } | null
      })[]

      return ((membersRes.data ?? []) as unknown as {
        volunteer_id: string
        volunteers: { id: string; full_name: string; photo_url: string | null } | null
      }[])
        .filter((row) => row.volunteers)
        .map<MonthlyTarget>((row) => {
          const own = evaluations.find(
            (ev) => ev.volunteer_id === row.volunteer_id && ev.evaluated_by === evaluatorId
          )
          const shown =
            own ??
            (isReviewer ? evaluations.find((ev) => ev.volunteer_id === row.volunteer_id) : undefined)

          return {
            volunteerId: row.volunteer_id,
            fullName: row.volunteers!.full_name,
            photoUrl: row.volunteers!.photo_url,
            evaluation: shown ?? null,
            evaluatedByName: shown && !own ? (shown.profiles?.full_name ?? "a leader") : null,
            isOwnEvaluation: !!own,
          }
        })
        .sort((a, b) => a.fullName.localeCompare(b.fullName))
    },
    enabled: !!departmentId,
  })
}

export interface SaveMonthlyInput {
  id?: string
  volunteer_id: string
  department_id: string
  month: number
  year: number
  evaluated_by: string
  commitment_rating: number | null
  quality_rating: number | null
  communication_rating: number | null
  teamwork_rating: number | null
  initiative_rating: number | null
  overall_rating: number | null
  strengths: string | null
  areas_to_improve: string | null
  leader_notes: string
  future_leader_potential: boolean
  needs_follow_up: boolean
}

export function useSaveMonthlyEvaluation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: SaveMonthlyInput) => {
      if (input.id) {
        // an admin correcting a leader's evaluation keeps the original author
        const { id, evaluated_by, ...updates } = input
        void evaluated_by
        const { error } = await supabase.from("monthly_evaluations").update(updates).eq("id", id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("monthly_evaluations").insert(input)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monthly-targets"] })
      queryClient.invalidateQueries({ queryKey: ["monthly-summary"] })
      queryClient.invalidateQueries({ queryKey: ["volunteer-history"] })
    },
  })
}

/** How many of the team were evaluated in each of the last few months. */
export function useMonthlySummary(departmentId: string | undefined) {
  return useQuery({
    queryKey: ["monthly-summary", departmentId],
    queryFn: async () => {
      const [membersRes, evalsRes] = await Promise.all([
        supabase
          .from("volunteer_departments")
          .select("volunteer_id, volunteers!inner (id, status)")
          .eq("department_id", departmentId!)
          .neq("volunteers.status", "archived"),
        supabase
          .from("monthly_evaluations")
          .select("month, year, volunteer_id, overall_rating")
          .eq("department_id", departmentId!),
      ])
      if (evalsRes.error) throw evalsRes.error

      const teamSize = (membersRes.data ?? []).length
      const evaluations = (evalsRes.data ?? []) as {
        month: number
        year: number
        volunteer_id: string
        overall_rating: number | null
      }[]

      const byPeriod = new Map<string, { month: number; year: number; ids: Set<string>; ratings: number[] }>()
      for (const evaluation of evaluations) {
        const key = `${evaluation.year}-${evaluation.month}`
        const entry =
          byPeriod.get(key) ?? { month: evaluation.month, year: evaluation.year, ids: new Set<string>(), ratings: [] }
        entry.ids.add(evaluation.volunteer_id)
        if (evaluation.overall_rating != null) entry.ratings.push(evaluation.overall_rating)
        byPeriod.set(key, entry)
      }

      return {
        teamSize,
        periods: Array.from(byPeriod.values())
          .map((entry) => ({
            month: entry.month,
            year: entry.year,
            evaluatedCount: entry.ids.size,
            average: entry.ratings.length
              ? entry.ratings.reduce((a, b) => a + b, 0) / entry.ratings.length
              : null,
          }))
          .sort((a, b) => b.year - a.year || b.month - a.month),
      }
    },
    enabled: !!departmentId,
  })
}
