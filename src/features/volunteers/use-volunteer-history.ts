import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

export interface ParticipationEntry {
  id: string
  participation_status: string
  role_description: string | null
  notes: string | null
  events: { id: string; name: string; date: string } | null
  event_booths: { id: string; name: string } | null
}

export interface VolunteerEvaluationEntry {
  id: string
  meeting_attendance_rating: number | null
  performance_rating: number | null
  teamwork_rating: number | null
  communication_rating: number | null
  shifts_count: number
  notes: string | null
  potential_future_booth_leader: boolean | null
  is_talented: boolean
  needs_follow_up: boolean
  created_at: string
  events: { id: string; name: string; date: string } | null
  event_booths: { id: string; name: string } | null
  departments: { id: string; name: string } | null
  profiles: { full_name: string } | null
}

export function evaluationAverage(evaluation: {
  meeting_attendance_rating: number | null
  performance_rating: number | null
  teamwork_rating: number | null
  communication_rating: number | null
}) {
  const values = [
    evaluation.meeting_attendance_rating,
    evaluation.performance_rating,
    evaluation.teamwork_rating,
    evaluation.communication_rating,
  ].filter((v): v is number => v != null)
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

export function useVolunteerHistory(volunteerId: string | undefined) {
  return useQuery({
    queryKey: ["volunteer-history", volunteerId],
    queryFn: async () => {
      const [participationsRes, evaluationsRes, tasksRes] = await Promise.all([
        supabase
          .from("event_participants")
          .select(
            "id, participation_status, role_description, notes, events (id, name, date), event_booths:booth_id (id, name)"
          )
          .eq("volunteer_id", volunteerId!),
        supabase
          .from("event_evaluations")
          .select(
            "id, meeting_attendance_rating, performance_rating, teamwork_rating, communication_rating, shifts_count, notes, potential_future_booth_leader, is_talented, needs_follow_up, created_at, events (id, name, date), event_booths:booth_id (id, name), departments:department_id (id, name), profiles:evaluated_by (full_name)"
          )
          .eq("volunteer_id", volunteerId!)
          .order("created_at", { ascending: false }),
        supabase
          .from("tasks")
          .select("id, title, status, priority, due_date")
          .or(`assigned_to_volunteer_id.eq.${volunteerId},related_volunteer_id.eq.${volunteerId}`),
      ])

      const participations = (participationsRes.data ?? []) as unknown as ParticipationEntry[]
      const evaluations = (evaluationsRes.data ?? []) as unknown as VolunteerEvaluationEntry[]

      // shifts and the running average both come from the evaluations
      const totalShifts = evaluations.reduce((sum, ev) => sum + (ev.shifts_count ?? 0), 0)
      const averages = evaluations
        .map(evaluationAverage)
        .filter((value): value is number => value != null)
      const cumulativeAverage = averages.length
        ? averages.reduce((a, b) => a + b, 0) / averages.length
        : null

      return {
        participations,
        evaluations,
        totalShifts,
        cumulativeAverage,
        eventsCount: participations.length,
        flags: {
          potentialLeader: evaluations.some((ev) => ev.potential_future_booth_leader),
          talented: evaluations.some((ev) => ev.is_talented),
          needsFollowUp: evaluations.some((ev) => ev.needs_follow_up),
        },
        tasks: tasksRes.data ?? [],
      }
    },
    enabled: !!volunteerId,
  })
}
