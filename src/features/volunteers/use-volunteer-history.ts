import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

export interface ParticipationEntry {
  id: string
  participation_status: string
  total_hours: number
  role_description: string | null
  notes: string | null
  events: { id: string; name: string; date: string } | null
  event_booths: { id: string; name: string } | null
}

export interface EventEvaluationEntry {
  id: string
  performance_rating: number | null
  commitment_rating: number | null
  teamwork_rating: number | null
  communication_rating: number | null
  notes: string | null
  recommend_for_future_events: boolean | null
  created_at: string
  events: { id: string; name: string; date: string } | null
  profiles: { full_name: string } | null
}

export interface MonthlyEvaluationEntry {
  id: string
  month: number
  year: number
  overall_rating: number | null
  strengths: string | null
  areas_to_improve: string | null
  leader_notes: string | null
  future_leader_potential: boolean
  needs_follow_up: boolean
  departments: { name: string } | null
  profiles: { full_name: string } | null
}

export function useVolunteerHistory(volunteerId: string | undefined) {
  return useQuery({
    queryKey: ["volunteer-history", volunteerId],
    queryFn: async () => {
      const [participationsRes, eventEvalsRes, monthlyEvalsRes, tasksRes] = await Promise.all([
        supabase
          .from("event_participants")
          .select(
            "id, participation_status, total_hours, role_description, notes, events (id, name, date), event_booths:booth_id (id, name)"
          )
          .eq("volunteer_id", volunteerId!),
        supabase
          .from("event_evaluations")
          .select(
            "id, performance_rating, commitment_rating, teamwork_rating, communication_rating, notes, recommend_for_future_events, created_at, events (id, name, date), profiles:evaluated_by (full_name)"
          )
          .eq("volunteer_id", volunteerId!)
          .order("created_at", { ascending: false }),
        supabase
          .from("monthly_evaluations")
          .select(
            "id, month, year, overall_rating, strengths, areas_to_improve, leader_notes, future_leader_potential, needs_follow_up, departments (name), profiles:evaluated_by (full_name)"
          )
          .eq("volunteer_id", volunteerId!)
          .order("year", { ascending: false })
          .order("month", { ascending: false }),
        supabase
          .from("tasks")
          .select("id, title, status, priority, due_date")
          .or(`assigned_to_volunteer_id.eq.${volunteerId},related_volunteer_id.eq.${volunteerId}`),
      ])

      const participations = (participationsRes.data ?? []) as unknown as ParticipationEntry[]
      const totalHours = participations.reduce((sum, p) => sum + (p.total_hours ?? 0), 0)

      return {
        participations,
        totalHours,
        eventEvaluations: (eventEvalsRes.data ?? []) as unknown as EventEvaluationEntry[],
        monthlyEvaluations: (monthlyEvalsRes.data ?? []) as unknown as MonthlyEvaluationEntry[],
        tasks: tasksRes.data ?? [],
      }
    },
    enabled: !!volunteerId,
  })
}
