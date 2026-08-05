import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type {
  EventBoothRow,
  EventInsert,
  EventRow,
  EventUpdate,
  ParticipationStatus,
} from "@/types/database.types"

export interface EventListItem extends EventRow {
  event_departments: { department_id: string; departments: { id: string; name: string } }[]
  event_booths: { id: string }[]
  event_participants: { id: string }[]
}

export function useEvents() {
  return useQuery({
    queryKey: ["events"],
    queryFn: async (): Promise<EventListItem[]> => {
      const { data, error } = await supabase
        .from("events")
        .select(
          "*, event_departments (department_id, departments (id, name)), event_booths (id), event_participants (id)"
        )
        .order("date", { ascending: false })
      if (error) throw error
      return data as unknown as EventListItem[]
    },
  })
}

export interface BoothWithDetails extends EventBoothRow {
  booth_leaders: { id: string; user_id: string; profiles: { id: string; full_name: string } }[]
  event_participants: { id: string }[]
}

export interface ParticipantWithDetails {
  id: string
  event_id: string
  booth_id: string | null
  volunteer_id: string
  department_id: string | null
  role_description: string | null
  participation_status: ParticipationStatus
  start_time: string | null
  end_time: string | null
  total_hours: number
  notes: string | null
  volunteers: { id: string; full_name: string; photo_url: string | null } | null
  departments: { id: string; name: string } | null
  event_booths: { id: string; name: string } | null
}

export interface EventEvalWithDetails {
  id: string
  booth_id: string | null
  department_id: string | null
  volunteer_id: string
  evaluated_by: string
  meeting_attendance_rating: number | null
  shifts_count: number
  performance_rating: number | null
  commitment_rating: number | null
  teamwork_rating: number | null
  communication_rating: number | null
  notes: string | null
  recommend_for_future_events: boolean | null
  potential_future_booth_leader: boolean | null
  is_talented: boolean
  needs_follow_up: boolean
  created_at: string
  volunteers: { id: string; full_name: string } | null
  profiles: { id: string; full_name: string } | null
  event_booths: { id: string; name: string } | null
}

export function useEventDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["events", id],
    queryFn: async () => {
      const [eventRes, boothsRes, participantsRes, sponsorsRes, guestsRes, evalsRes, tasksRes] =
        await Promise.all([
          supabase
            .from("events")
            .select("*, event_departments (department_id, departments (id, name))")
            .eq("id", id!)
            .single(),
          supabase
            .from("event_booths")
            .select(
              "*, booth_leaders (id, user_id, profiles:user_id (id, full_name)), event_participants (id)"
            )
            .eq("event_id", id!)
            .order("created_at"),
          supabase
            .from("event_participants")
            .select(
              "*, volunteers (id, full_name, photo_url), departments (id, name), event_booths:booth_id (id, name)"
            )
            .eq("event_id", id!),
          supabase.from("event_sponsors").select("*").eq("event_id", id!),
          supabase.from("event_guests").select("*").eq("event_id", id!),
          supabase
            .from("event_evaluations")
            .select(
              "*, volunteers (id, full_name), profiles:evaluated_by (id, full_name), event_booths:booth_id (id, name)"
            )
            .eq("event_id", id!),
          supabase
            .from("tasks")
            .select("id, title, status, priority, due_date, profiles:assigned_to_user_id (full_name)")
            .eq("related_event_id", id!),
        ])
      if (eventRes.error) throw eventRes.error

      return {
        event: eventRes.data as unknown as EventRow & {
          event_departments: { department_id: string; departments: { id: string; name: string } }[]
        },
        booths: (boothsRes.data ?? []) as unknown as BoothWithDetails[],
        participants: (participantsRes.data ?? []) as unknown as ParticipantWithDetails[],
        sponsors: sponsorsRes.data ?? [],
        guests: guestsRes.data ?? [],
        evaluations: (evalsRes.data ?? []) as unknown as EventEvalWithDetails[],
        tasks: (tasksRes.data ?? []) as unknown as {
          id: string
          title: string
          status: string
          priority: string
          due_date: string | null
          profiles: { full_name: string } | null
        }[],
      }
    },
    enabled: !!id,
  })
}

function useInvalidateEvent() {
  const queryClient = useQueryClient()
  return (eventId?: string) => {
    queryClient.invalidateQueries({ queryKey: ["events"] })
    if (eventId) queryClient.invalidateQueries({ queryKey: ["events", eventId] })
    queryClient.invalidateQueries({ queryKey: ["dashboard"] })
  }
}

export function useSaveEvent() {
  const invalidate = useInvalidateEvent()
  return useMutation({
    mutationFn: async ({
      event,
      departmentIds,
    }: {
      event: EventInsert | (EventUpdate & { id: string })
      departmentIds?: string[]
    }) => {
      let eventId: string
      if ("id" in event && event.id) {
        const { id, ...updates } = event
        const { error } = await supabase.from("events").update(updates).eq("id", id)
        if (error) throw error
        eventId = id
      } else {
        const { data, error } = await supabase
          .from("events")
          .insert(event as EventInsert)
          .select("id")
          .single()
        if (error) throw error
        eventId = data.id
      }

      if (departmentIds) {
        const { error: delError } = await supabase
          .from("event_departments")
          .delete()
          .eq("event_id", eventId)
        if (delError) throw delError
        if (departmentIds.length) {
          const { error: insError } = await supabase
            .from("event_departments")
            .insert(departmentIds.map((deptId) => ({ event_id: eventId, department_id: deptId })))
          if (insError) throw insError
        }
      }
      return eventId
    },
    onSuccess: (eventId) => invalidate(eventId),
  })
}

export function useSaveBooth() {
  const invalidate = useInvalidateEvent()
  return useMutation({
    mutationFn: async ({
      booth,
      eventId,
    }: {
      booth: { id?: string; name: string; description?: string | null; location_in_event?: string | null; notes?: string | null }
      eventId: string
    }) => {
      if (booth.id) {
        const { id, ...updates } = booth
        const { error } = await supabase.from("event_booths").update(updates).eq("id", id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from("event_booths")
          .insert({ ...booth, event_id: eventId })
        if (error) throw error
      }
    },
    onSuccess: (_, { eventId }) => invalidate(eventId),
  })
}

export function useDeleteBooth() {
  const invalidate = useInvalidateEvent()
  return useMutation({
    mutationFn: async ({ boothId }: { boothId: string; eventId: string }) => {
      const { error } = await supabase.from("event_booths").delete().eq("id", boothId)
      if (error) throw error
    },
    onSuccess: (_, { eventId }) => invalidate(eventId),
  })
}

export function useSetBoothLeaders() {
  const invalidate = useInvalidateEvent()
  return useMutation({
    mutationFn: async ({
      boothId,
      userIds,
    }: {
      boothId: string
      userIds: string[]
      eventId: string
    }) => {
      const { error: delError } = await supabase
        .from("booth_leaders")
        .delete()
        .eq("booth_id", boothId)
      if (delError) throw delError
      if (userIds.length) {
        const { error } = await supabase
          .from("booth_leaders")
          .insert(userIds.map((userId) => ({ booth_id: boothId, user_id: userId })))
        if (error) throw error
      }
    },
    onSuccess: (_, { eventId }) => invalidate(eventId),
  })
}

export function useSaveParticipant() {
  const invalidate = useInvalidateEvent()
  return useMutation({
    mutationFn: async ({
      participant,
      eventId,
    }: {
      participant: {
        id?: string
        volunteer_id: string
        booth_id?: string | null
        department_id?: string | null
        role_description?: string | null
        participation_status?: ParticipationStatus
        start_time?: string | null
        end_time?: string | null
        notes?: string | null
      }
      eventId: string
    }) => {
      if (participant.id) {
        const { id, ...updates } = participant
        const { error } = await supabase.from("event_participants").update(updates).eq("id", id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from("event_participants")
          .insert({ ...participant, event_id: eventId })
        if (error) throw error
      }
    },
    onSuccess: (_, { eventId }) => invalidate(eventId),
  })
}

export function useRemoveParticipant() {
  const invalidate = useInvalidateEvent()
  return useMutation({
    mutationFn: async ({ participantId }: { participantId: string; eventId: string }) => {
      const { error } = await supabase.from("event_participants").delete().eq("id", participantId)
      if (error) throw error
    },
    onSuccess: (_, { eventId }) => invalidate(eventId),
  })
}

export function useSaveSponsor() {
  const invalidate = useInvalidateEvent()
  return useMutation({
    mutationFn: async ({
      sponsor,
      eventId,
    }: {
      sponsor: { id?: string; sponsor_name: string; contribution_amount?: number | null; notes?: string | null }
      eventId: string
    }) => {
      if (sponsor.id) {
        const { id, ...updates } = sponsor
        const { error } = await supabase.from("event_sponsors").update(updates).eq("id", id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from("event_sponsors")
          .insert({ ...sponsor, event_id: eventId })
        if (error) throw error
      }
    },
    onSuccess: (_, { eventId }) => invalidate(eventId),
  })
}

export function useDeleteSponsor() {
  const invalidate = useInvalidateEvent()
  return useMutation({
    mutationFn: async ({ sponsorId }: { sponsorId: string; eventId: string }) => {
      const { error } = await supabase.from("event_sponsors").delete().eq("id", sponsorId)
      if (error) throw error
    },
    onSuccess: (_, { eventId }) => invalidate(eventId),
  })
}

export function useSaveGuest() {
  const invalidate = useInvalidateEvent()
  return useMutation({
    mutationFn: async ({
      guest,
      eventId,
    }: {
      guest: { id?: string; guest_name: string; role_or_title?: string | null; notes?: string | null }
      eventId: string
    }) => {
      if (guest.id) {
        const { id, ...updates } = guest
        const { error } = await supabase.from("event_guests").update(updates).eq("id", id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("event_guests").insert({ ...guest, event_id: eventId })
        if (error) throw error
      }
    },
    onSuccess: (_, { eventId }) => invalidate(eventId),
  })
}

export function useDeleteGuest() {
  const invalidate = useInvalidateEvent()
  return useMutation({
    mutationFn: async ({ guestId }: { guestId: string; eventId: string }) => {
      const { error } = await supabase.from("event_guests").delete().eq("id", guestId)
      if (error) throw error
    },
    onSuccess: (_, { eventId }) => invalidate(eventId),
  })
}

export function useSaveEventEvaluation() {
  const invalidate = useInvalidateEvent()
  return useMutation({
    mutationFn: async ({
      evaluation,
      eventId,
    }: {
      evaluation: {
        id?: string
        volunteer_id: string
        booth_id?: string | null
        evaluated_by: string
        performance_rating?: number | null
        commitment_rating?: number | null
        teamwork_rating?: number | null
        communication_rating?: number | null
        notes?: string | null
        recommend_for_future_events?: boolean | null
        potential_future_booth_leader?: boolean | null
      }
      eventId: string
    }) => {
      if (evaluation.id) {
        const { id, ...updates } = evaluation
        const { error } = await supabase.from("event_evaluations").update(updates).eq("id", id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from("event_evaluations")
          .insert({ ...evaluation, event_id: eventId })
        if (error) throw error
      }
    },
    onSuccess: (_, { eventId }) => invalidate(eventId),
  })
}

// leaders connected to an event: department leaders of participating
// departments + booth leaders of the event's booths
export interface EventLeader {
  user_id: string
  full_name: string
  role_label: string
}

export function useEventLeaders(eventId: string | undefined) {
  return useQuery({
    queryKey: ["event-leaders", eventId],
    queryFn: async (): Promise<EventLeader[]> => {
      const { data: eventDepts, error: deptError } = await supabase
        .from("event_departments")
        .select("department_id, departments (name)")
        .eq("event_id", eventId!)
      if (deptError) throw deptError

      const eventDeptRows = (eventDepts ?? []) as unknown as {
        department_id: string
        departments: { name: string } | null
      }[]
      const deptIds = eventDeptRows.map((ed) => ed.department_id)
      const deptNames = new Map(
        eventDeptRows.map((ed) => [ed.department_id, ed.departments?.name ?? "Department"])
      )

      const [deptLeadersRes, boothLeadersRes] = await Promise.all([
        deptIds.length
          ? supabase
              .from("department_leaders")
              .select("user_id, department_id, profiles:user_id (id, full_name)")
              .in("department_id", deptIds)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("booth_leaders")
          .select("user_id, profiles:user_id (id, full_name), event_booths!inner (id, name, event_id)")
          .eq("event_booths.event_id", eventId!),
      ])
      if (deptLeadersRes.error) throw deptLeadersRes.error
      if (boothLeadersRes.error) throw boothLeadersRes.error

      const leaders = new Map<string, EventLeader>()
      for (const dl of (deptLeadersRes.data ?? []) as unknown as {
        user_id: string
        department_id: string
        profiles: { full_name: string } | null
      }[]) {
        if (!dl.profiles) continue
        leaders.set(dl.user_id, {
          user_id: dl.user_id,
          full_name: dl.profiles.full_name,
          role_label: `Leader — ${deptNames.get(dl.department_id) ?? "Department"}`,
        })
      }
      for (const bl of (boothLeadersRes.data ?? []) as unknown as {
        user_id: string
        profiles: { full_name: string } | null
        event_booths: { name: string } | null
      }[]) {
        if (!bl.profiles) continue
        // booth role wins in the label if the person is both
        leaders.set(bl.user_id, {
          user_id: bl.user_id,
          full_name: bl.profiles.full_name,
          role_label: `Booth Leader — ${bl.event_booths?.name ?? "Booth"}`,
        })
      }
      return Array.from(leaders.values())
    },
    enabled: !!eventId,
  })
}

export interface LeaderEvalWithDetails {
  id: string
  event_id: string
  leader_user_id: string
  evaluated_by: string
  leadership_rating: number | null
  organization_rating: number | null
  communication_rating: number | null
  overall_rating: number | null
  notes: string | null
  leader: { id: string; full_name: string } | null
  evaluator: { id: string; full_name: string } | null
}

export function useLeaderEvaluations(eventId: string | undefined) {
  return useQuery({
    queryKey: ["leader-evaluations", eventId],
    queryFn: async (): Promise<LeaderEvalWithDetails[]> => {
      const { data, error } = await supabase
        .from("leader_evaluations")
        .select(
          "*, leader:leader_user_id (id, full_name), evaluator:evaluated_by (id, full_name)"
        )
        .eq("event_id", eventId!)
      if (error) throw error
      return data as unknown as LeaderEvalWithDetails[]
    },
    enabled: !!eventId,
  })
}

export function useSaveLeaderEvaluation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      evaluation,
    }: {
      evaluation: {
        id?: string
        event_id: string
        leader_user_id: string
        evaluated_by: string
        leadership_rating?: number | null
        organization_rating?: number | null
        communication_rating?: number | null
        overall_rating?: number | null
        notes?: string | null
      }
    }) => {
      if (evaluation.id) {
        const { id, ...updates } = evaluation
        const { error } = await supabase.from("leader_evaluations").update(updates).eq("id", id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("leader_evaluations").insert(evaluation)
        if (error) throw error
      }
    },
    onSuccess: (_, { evaluation }) => {
      queryClient.invalidateQueries({ queryKey: ["leader-evaluations", evaluation.event_id] })
    },
  })
}

export function useDeleteEvent() {
  const invalidate = useInvalidateEvent()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => invalidate(),
  })
}
