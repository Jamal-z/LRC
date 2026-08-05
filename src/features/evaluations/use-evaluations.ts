import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { EventEvaluationRow, EventStatus } from "@/types/database.types"

/** The five things a volunteer is scored on for an event. */
export const RATING_CRITERIA = [
  {
    key: "meeting_attendance_rating",
    label: "Meeting attendance",
    hint: "Attendance and punctuality at the preparation meetings",
  },
  {
    key: "performance_rating",
    label: "Performance",
    hint: "Quality of the work they did during the event",
  },
  { key: "teamwork_rating", label: "Teamwork", hint: "Working with the rest of the team" },
  {
    key: "communication_rating",
    label: "Communication",
    hint: "With visitors and with the team",
  },
] as const

export type RatingKey = (typeof RATING_CRITERIA)[number]["key"]

/** Yes/no flags recorded alongside the ratings. */
export const EVALUATION_FLAGS = [
  {
    key: "potential_future_booth_leader",
    label: "Potential booth leader",
    hint: "Ready to lead a booth in a future event",
    tone: "positive",
  },
  {
    key: "is_talented",
    label: "Talented",
    hint: "Stands out — worth investing in",
    tone: "positive",
  },
  {
    key: "needs_follow_up",
    label: "Needs follow-up",
    hint: "Would benefit from extra guidance and support",
    tone: "attention",
  },
] as const

export type FlagKey = (typeof EVALUATION_FLAGS)[number]["key"]

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

// ------------------------------------------------------------
// Events available to evaluate, with progress per event
// ------------------------------------------------------------
export interface EvaluationEventSummary {
  id: string
  name: string
  date: string
  status: EventStatus
  boothCount: number
  participantCount: number
  evaluationCount: number
}

export function useEvaluationEvents() {
  return useQuery({
    queryKey: ["evaluation-events"],
    queryFn: async (): Promise<EvaluationEventSummary[]> => {
      const { data, error } = await supabase
        .from("events")
        .select(
          "id, name, date, status, event_booths (id), event_participants (id), event_evaluations (id)"
        )
        .order("date", { ascending: false })
      if (error) throw error

      return ((data ?? []) as unknown as {
        id: string
        name: string
        date: string
        status: EventStatus
        event_booths: { id: string }[]
        event_participants: { id: string }[]
        event_evaluations: { id: string }[]
      }[]).map((event) => ({
        id: event.id,
        name: event.name,
        date: event.date,
        status: event.status,
        boothCount: event.event_booths.length,
        participantCount: event.event_participants.length,
        evaluationCount: event.event_evaluations.length,
      }))
    },
  })
}

// ------------------------------------------------------------
// One event: the groups (booths / department teams) to evaluate
// ------------------------------------------------------------
export interface EvaluationGroup {
  type: "booth" | "department"
  id: string
  name: string
  participantCount: number
  evaluatedCount: number
  leaderNames: string[]
}

export function useEvaluationGroups(eventId: string | undefined, evaluatorId: string | undefined) {
  return useQuery({
    queryKey: ["evaluation-groups", eventId, evaluatorId],
    queryFn: async () => {
      const [eventRes, boothsRes, participantsRes, evalsRes, deptsRes, memberRes] =
        await Promise.all([
          supabase.from("events").select("id, name, date, status").eq("id", eventId!).single(),
          supabase
            .from("event_booths")
            .select("id, name, booth_leaders (user_id, profiles:user_id (full_name))")
            .eq("event_id", eventId!)
            .order("created_at"),
          supabase
            .from("event_participants")
            .select("id, volunteer_id, booth_id, department_id")
            .eq("event_id", eventId!),
          supabase
            .from("event_evaluations")
            .select("id, volunteer_id, booth_id, department_id, evaluated_by")
            .eq("event_id", eventId!),
          supabase
            .from("event_departments")
            .select("department_id, departments (id, name, department_leaders (user_id, profiles:user_id (full_name)))")
            .eq("event_id", eventId!),
          // a team is evaluated as a whole, so its size is its membership —
          // not how many people were registered as event participants
          supabase
            .from("volunteer_departments")
            .select("department_id, volunteers!inner (id, status)")
            .neq("volunteers.status", "archived"),
        ])
      if (eventRes.error) throw eventRes.error

      const participants = (participantsRes.data ?? []) as unknown as {
        id: string
        volunteer_id: string
        booth_id: string | null
        department_id: string | null
      }[]
      const evaluations = (evalsRes.data ?? []) as unknown as {
        volunteer_id: string
        booth_id: string | null
        department_id: string | null
        evaluated_by: string
      }[]

      // department_id -> how many volunteers belong to that team
      const teamSizes = new Map<string, number>()
      for (const row of (memberRes.data ?? []) as unknown as { department_id: string }[]) {
        teamSizes.set(row.department_id, (teamSizes.get(row.department_id) ?? 0) + 1)
      }

      const booths = ((boothsRes.data ?? []) as unknown as {
        id: string
        name: string
        booth_leaders: { user_id: string; profiles: { full_name: string } | null }[]
      }[]).map<EvaluationGroup & { leaderIds: string[] }>((booth) => ({
        type: "booth",
        id: booth.id,
        name: booth.name,
        leaderIds: booth.booth_leaders.map((bl) => bl.user_id),
        leaderNames: booth.booth_leaders.map((bl) => bl.profiles?.full_name ?? "—"),
        participantCount: participants.filter((p) => p.booth_id === booth.id).length,
        // progress counts every evaluation, whoever submitted it
        evaluatedCount: new Set(
          evaluations.filter((e) => e.booth_id === booth.id).map((e) => e.volunteer_id)
        ).size,
      }))

      const departments = ((deptsRes.data ?? []) as unknown as {
        department_id: string
        departments: {
          id: string
          name: string
          department_leaders: { user_id: string; profiles: { full_name: string } | null }[]
        } | null
      }[])
        .filter((row) => row.departments)
        .map<EvaluationGroup & { leaderIds: string[] }>((row) => ({
          type: "department",
          id: row.departments!.id,
          name: row.departments!.name,
          leaderIds: row.departments!.department_leaders.map((dl) => dl.user_id),
          leaderNames: row.departments!.department_leaders.map(
            (dl) => dl.profiles?.full_name ?? "—"
          ),
          // the whole team is evaluated for the event, not just registered participants
          participantCount: teamSizes.get(row.departments!.id) ?? 0,
          evaluatedCount: new Set(
            evaluations
              .filter((e) => e.department_id === row.departments!.id)
              .map((e) => e.volunteer_id)
          ).size,
        }))

      return {
        event: eventRes.data as { id: string; name: string; date: string; status: EventStatus },
        booths,
        departments,
      }
    },
    enabled: !!eventId,
  })
}

// ------------------------------------------------------------
// One group and the people to evaluate in it
// ------------------------------------------------------------
export interface EvaluationTarget {
  volunteerId: string
  fullName: string
  photoUrl: string | null
  roleDescription: string | null
  evaluation: EventEvaluationRow | null
  /** who submitted the evaluation shown above (null when it's yours) */
  evaluatedByName: string | null
  isOwnEvaluation: boolean
}

export function useEvaluationTargets(
  eventId: string | undefined,
  groupType: "booth" | "department",
  groupId: string | undefined,
  evaluatorId: string | undefined,
  /** admins review what leaders submitted instead of scoring from scratch */
  isReviewer = false
) {
  return useQuery({
    queryKey: ["evaluation-targets", eventId, groupType, groupId, evaluatorId, isReviewer],
    queryFn: async () => {
      const isBooth = groupType === "booth"

      const [groupRes, rosterRes, evalsRes] = await Promise.all([
        isBooth
          ? supabase.from("event_booths").select("id, name").eq("id", groupId!).single()
          : supabase.from("departments").select("id, name").eq("id", groupId!).single(),
        // A booth is evaluated per assigned participant; a team is evaluated as
        // a whole, so every member of the team is listed for the event.
        isBooth
          ? supabase
              .from("event_participants")
              .select("volunteer_id, role_description, volunteers (id, full_name, photo_url)")
              .eq("event_id", eventId!)
              .eq("booth_id", groupId!)
          : supabase
              .from("volunteer_departments")
              .select("volunteer_id, volunteers!inner (id, full_name, photo_url, status)")
              .eq("department_id", groupId!)
              .neq("volunteers.status", "archived"),
        supabase
          .from("event_evaluations")
          .select("*, profiles:evaluated_by (id, full_name)")
          .eq("event_id", eventId!)
          .eq(isBooth ? "booth_id" : "department_id", groupId!),
      ])
      if (groupRes.error) throw groupRes.error
      if (rosterRes.error) throw rosterRes.error

      const evaluations = (evalsRes.data ?? []) as unknown as (EventEvaluationRow & {
        profiles: { id: string; full_name: string } | null
      })[]

      const roster = (rosterRes.data ?? []) as unknown as {
        volunteer_id: string
        role_description?: string | null
        volunteers: { id: string; full_name: string; photo_url: string | null } | null
      }[]

      const targets = roster
        .filter((row) => row.volunteers)
        .map<EvaluationTarget>((row) => {
          const own = evaluations.find(
            (ev) => ev.volunteer_id === row.volunteer_id && ev.evaluated_by === evaluatorId
          )
          // reviewers fall back to whatever the leader submitted
          const shown =
            own ?? (isReviewer ? evaluations.find((ev) => ev.volunteer_id === row.volunteer_id) : undefined)

          return {
            volunteerId: row.volunteer_id,
            fullName: row.volunteers!.full_name,
            photoUrl: row.volunteers!.photo_url,
            roleDescription: row.role_description ?? null,
            evaluation: shown ?? null,
            evaluatedByName: shown && !own ? (shown.profiles?.full_name ?? "a leader") : null,
            isOwnEvaluation: !!own,
          }
        })
        .sort((a, b) => a.fullName.localeCompare(b.fullName))

      return {
        group: groupRes.data as { id: string; name: string },
        targets,
      }
    },
    enabled: !!eventId && !!groupId && !!evaluatorId,
  })
}

export interface SaveEvaluationInput {
  id?: string
  event_id: string
  booth_id: string | null
  department_id: string | null
  volunteer_id: string
  evaluated_by: string
  meeting_attendance_rating: number | null
  shifts_count: number
  performance_rating: number | null
  teamwork_rating: number | null
  communication_rating: number | null
  notes: string
  potential_future_booth_leader: boolean
  is_talented: boolean
  needs_follow_up: boolean
}

export function useSaveEvaluation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: SaveEvaluationInput) => {
      if (input.id) {
        // keep the original author on record — an admin editing a leader's
        // evaluation is a correction, not a re-authoring
        const { id, evaluated_by, ...updates } = input
        void evaluated_by
        const { error } = await supabase.from("event_evaluations").update(updates).eq("id", id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("event_evaluations").insert(input)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluation-targets"] })
      queryClient.invalidateQueries({ queryKey: ["evaluation-groups"] })
      queryClient.invalidateQueries({ queryKey: ["evaluation-events"] })
      queryClient.invalidateQueries({ queryKey: ["volunteer-history"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}
