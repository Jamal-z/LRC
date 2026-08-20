import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type {
  EvaluationPhase,
  EventEvaluationRow,
  EventStatus,
} from "@/types/database.types"

/**
 * Booth evaluations run in two phases. Communication appears in both on
 * purpose — communicating while preparing is a different skill from handling
 * visitors on the day, so each phase scores it separately.
 */
export const PREPARATION_CRITERIA = [
  {
    key: "meeting_attendance_rating",
    label: "Meeting attendance",
    hint: "Attendance and punctuality at the preparation meetings",
  },
  {
    key: "task_completion_rating",
    label: "Task completion",
    hint: "Finished the tasks they were given before the event",
  },
  {
    key: "communication_rating",
    label: "Communication",
    hint: "Responsiveness with the leader and the team while preparing",
  },
] as const

export const POST_EVENT_CRITERIA = [
  {
    key: "performance_rating",
    label: "Performance at the event",
    hint: "Quality of the work they did on the day",
  },
  { key: "teamwork_rating", label: "Teamwork", hint: "Working with the rest of the team" },
  {
    key: "communication_rating",
    label: "Communication",
    hint: "With visitors and with the team during the event",
  },
  {
    key: "attitude_rating",
    label: "Attitude with people",
    hint: "How respectfully they dealt with volunteers and students",
  },
  {
    key: "commitment_rating",
    label: "Punctuality",
    hint: "Arrived on time and stuck to the agreed shift times",
  },
] as const

export const PHASES = [
  {
    key: "preparation",
    label: "Preparation",
    shortLabel: "Prep",
    parenthetical: "Before",
    criteria: PREPARATION_CRITERIA,
    /** shifts and the talent flags only make sense once the event has happened */
    hasShifts: false,
    hasFlags: false,
  },
  {
    key: "post_event",
    label: "Post-event",
    shortLabel: "Post",
    parenthetical: "After",
    criteria: POST_EVENT_CRITERIA,
    hasShifts: true,
    hasFlags: true,
  },
] as const

/**
 * Department teams are evaluated once for an event, not in phases, and keep the
 * original criteria — the before/after split is a booth-only change.
 */
export const DEPARTMENT_CRITERIA = [
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

export type RatingKey =
  | (typeof PREPARATION_CRITERIA)[number]["key"]
  | (typeof POST_EVENT_CRITERIA)[number]["key"]
  | (typeof DEPARTMENT_CRITERIA)[number]["key"]

export function criteriaFor(
  phase: EvaluationPhase,
  isDepartment = false
): readonly { readonly key: RatingKey; readonly label: string; readonly hint: string }[] {
  if (isDepartment) return DEPARTMENT_CRITERIA
  return phase === "preparation" ? PREPARATION_CRITERIA : POST_EVENT_CRITERIA
}

/** Yes/no flags recorded alongside the ratings. Post-event only. */
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

/**
 * Averages only the criteria that belong to the row's own phase, so a
 * preparation row is not dragged down by the post-event columns it never fills.
 */
export function evaluationAverage(
  evaluation: Partial<Record<RatingKey, number | null>> & {
    phase?: EvaluationPhase
    department_id?: string | null
  }
) {
  const values = criteriaFor(evaluation.phase ?? "post_event", !!evaluation.department_id)
    .map((criterion) => evaluation[criterion.key])
    .filter((v): v is number => v != null)
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
          "id, name, date, status, event_booths (id), event_participants (id), event_evaluations (volunteer_id)"
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
        event_evaluations: { volunteer_id: string }[]
      }[]).map((event) => ({
        id: event.id,
        name: event.name,
        date: event.date,
        status: event.status,
        boothCount: event.event_booths.length,
        participantCount: event.event_participants.length,
        // a booth volunteer files one row per phase, so count people not rows
        evaluationCount: new Set(event.event_evaluations.map((e) => e.volunteer_id)).size,
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
  /** overall progress: for booths a volunteer counts only once BOTH phases are in */
  evaluatedCount: number
  /** how many volunteers have that phase on record (booths show both bars) */
  phaseCounts: Record<EvaluationPhase, number>
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
            .select("id, volunteer_id, booth_id, department_id, evaluated_by, phase")
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
        phase: EvaluationPhase
      }[]

      /** volunteers with `phase` recorded for this group, whoever submitted it */
      function volunteersWithPhase(
        rows: typeof evaluations,
        phase: EvaluationPhase
      ): Set<string> {
        return new Set(rows.filter((e) => e.phase === phase).map((e) => e.volunteer_id))
      }

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
        ...(() => {
          // progress counts every evaluation, whoever submitted it
          const mine = evaluations.filter((e) => e.booth_id === booth.id)
          const prep = volunteersWithPhase(mine, "preparation")
          const post = volunteersWithPhase(mine, "post_event")
          return {
            phaseCounts: { preparation: prep.size, post_event: post.size },
            // a booth volunteer is only "done" when both phases are filled in
            evaluatedCount: [...prep].filter((id) => post.has(id)).length,
          }
        })(),
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
          // teams stay single-phase, so every row lands in post_event
          evaluatedCount: new Set(
            evaluations
              .filter((e) => e.department_id === row.departments!.id)
              .map((e) => e.volunteer_id)
          ).size,
          phaseCounts: {
            preparation: 0,
            post_event: new Set(
              evaluations
                .filter((e) => e.department_id === row.departments!.id)
                .map((e) => e.volunteer_id)
            ).size,
          },
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
/** What is on record for one volunteer in one phase. */
export interface PhaseEntry {
  evaluation: EventEvaluationRow | null
  /** who submitted the evaluation shown above (null when it's yours) */
  evaluatedByName: string | null
  isOwnEvaluation: boolean
}

const EMPTY_PHASE_ENTRY: PhaseEntry = {
  evaluation: null,
  evaluatedByName: null,
  isOwnEvaluation: false,
}

export interface EvaluationTarget {
  volunteerId: string
  fullName: string
  photoUrl: string | null
  roleDescription: string | null
  /** one entry per phase; departments only ever populate `post_event` */
  phases: Record<EvaluationPhase, PhaseEntry>
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

      function entryFor(volunteerId: string, phase: EvaluationPhase): PhaseEntry {
        const own = evaluations.find(
          (ev) =>
            ev.volunteer_id === volunteerId &&
            ev.evaluated_by === evaluatorId &&
            ev.phase === phase
        )
        // reviewers fall back to whatever the leader submitted
        const shown =
          own ??
          (isReviewer
            ? evaluations.find((ev) => ev.volunteer_id === volunteerId && ev.phase === phase)
            : undefined)
        if (!shown) return EMPTY_PHASE_ENTRY

        return {
          evaluation: shown,
          evaluatedByName: own ? null : (shown.profiles?.full_name ?? "a leader"),
          isOwnEvaluation: !!own,
        }
      }

      const targets = roster
        .filter((row) => row.volunteers)
        .map<EvaluationTarget>((row) => ({
          volunteerId: row.volunteer_id,
          fullName: row.volunteers!.full_name,
          photoUrl: row.volunteers!.photo_url,
          roleDescription: row.role_description ?? null,
          phases: {
            preparation: entryFor(row.volunteer_id, "preparation"),
            post_event: entryFor(row.volunteer_id, "post_event"),
          },
        }))
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
  phase: EvaluationPhase
  meeting_attendance_rating: number | null
  task_completion_rating: number | null
  shifts_count: number
  performance_rating: number | null
  teamwork_rating: number | null
  communication_rating: number | null
  attitude_rating: number | null
  commitment_rating: number | null
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
