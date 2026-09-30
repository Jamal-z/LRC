import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type {
  BoothMeetingRow,
  MeetingCalendarEntry,
  MeetingMode,
  MeetingRoom,
  TaskPriority,
  TaskStatus,
} from "@/types/database.types"

export interface MeetingListItem extends BoothMeetingRow {
  event_booths: { id: string; name: string } | null
  events: { id: string; name: string } | null
  departments: { id: string; name: string } | null
  booth_meeting_attendance: { attended: boolean }[]
  tasks: { id: string; status: TaskStatus }[]
}

export interface MeetingDetail extends BoothMeetingRow {
  event_booths: { id: string; name: string } | null
  events: { id: string; name: string } | null
  departments: { id: string; name: string } | null
  creator: { id: string; full_name: string } | null
  booth_meeting_attendance: {
    id: string
    volunteer_id: string
    attended: boolean
    volunteers: { id: string; full_name: string; photo_url: string | null } | null
  }[]
  tasks: {
    id: string
    title: string
    status: TaskStatus
    priority: TaskPriority
    due_date: string | null
    assignee: { id: string; full_name: string } | null
    volunteer_assignee: { id: string; full_name: string } | null
  }[]
}

/** Whose meeting it is: "Booth — Event" or the department's name. */
export function meetingTeamLabel(meeting: Pick<MeetingListItem, "event_booths" | "events" | "departments">) {
  if (meeting.departments) return meeting.departments.name
  return `${meeting.event_booths?.name ?? "Booth"}${meeting.events ? ` — ${meeting.events.name}` : ""}`
}

/** The team a calendar slot belongs to — a booth or a department. */
export function calendarTeam(entry: MeetingCalendarEntry) {
  return {
    id: entry.booth_id ?? entry.department_id ?? entry.id,
    name: entry.booth_name ?? entry.department_name ?? "Team",
  }
}

/** A scheduled meeting whose time has passed but has no minutes yet. */
export function needsMinutes(meeting: Pick<BoothMeetingRow, "status" | "scheduled_at">) {
  return meeting.status === "scheduled" && new Date(meeting.scheduled_at) < new Date()
}

/** When a meeting ends; meetings without a planned length count as an hour. */
export function meetingEnd(start: Date, durationMinutes: number | null | undefined) {
  return new Date(start.getTime() + (durationMinutes || 60) * 60_000)
}

/**
 * Busy slots across every team between two instants, so leaders can see
 * which days and hours are taken — including teams they can't open.
 */
export function useMeetingCalendar(from: Date, to: Date) {
  return useQuery({
    queryKey: ["meetings", "calendar", from.toISOString(), to.toISOString()],
    queryFn: async (): Promise<MeetingCalendarEntry[]> => {
      const { data, error } = await supabase.rpc("meeting_calendar", {
        p_from: from.toISOString(),
        p_to: to.toISOString(),
      })
      if (error) throw error
      return (data ?? []) as MeetingCalendarEntry[]
    },
  })
}

/** The center-hall meeting that overlaps [start, end), if any — ignoring `exceptId`. */
export function findHallClash(
  entries: MeetingCalendarEntry[],
  start: Date,
  end: Date,
  exceptId?: string
) {
  return entries.find((e) => {
    if (e.id === exceptId || e.room !== "center_hall") return false
    const eStart = new Date(e.scheduled_at)
    return eStart < end && meetingEnd(eStart, e.duration_minutes) > start
  })
}

const LIST_SELECT =
  "*, event_booths:booth_id (id, name), events:event_id (id, name), departments:department_id (id, name), booth_meeting_attendance (attended), tasks (id, status)"

/** One team: a booth or a department. */
export interface MeetingTeamRef {
  boothId?: string | null
  departmentId?: string | null
}

/** Meetings the current user can see — all of them, or one team's. */
export function useMeetings(team?: MeetingTeamRef) {
  const boothId = team?.boothId ?? null
  const departmentId = team?.departmentId ?? null
  return useQuery({
    queryKey: ["meetings", "list", boothId, departmentId],
    queryFn: async (): Promise<MeetingListItem[]> => {
      let query = supabase.from("booth_meetings").select(LIST_SELECT)
      if (boothId) query = query.eq("booth_id", boothId)
      if (departmentId) query = query.eq("department_id", departmentId)
      const { data, error } = await query.order("scheduled_at", { ascending: false })
      if (error) throw error
      return data as unknown as MeetingListItem[]
    },
  })
}

export function useMeeting(id: string | undefined) {
  return useQuery({
    queryKey: ["meetings", "detail", id],
    queryFn: async (): Promise<MeetingDetail> => {
      const { data, error } = await supabase
        .from("booth_meetings")
        .select(
          "*, event_booths:booth_id (id, name), events:event_id (id, name), departments:department_id (id, name), creator:created_by (id, full_name), booth_meeting_attendance (id, volunteer_id, attended, volunteers (id, full_name, photo_url)), tasks (id, title, status, priority, due_date, assignee:assigned_to_user_id (id, full_name), volunteer_assignee:assigned_to_volunteer_id (id, full_name))"
        )
        .eq("id", id!)
        .single()
      if (error) throw error
      return data as unknown as MeetingDetail
    },
    enabled: !!id,
  })
}

export interface MeetingTeam {
  volunteers: { id: string; full_name: string; photo_url: string | null }[]
  leaders: { id: string; full_name: string }[]
}

type TeamVolunteer = MeetingTeam["volunteers"][number]
type TeamLeader = MeetingTeam["leaders"][number]

/**
 * Who belongs to a meeting's team, for attendance and action items: a booth's
 * volunteers and leaders, or every (non-archived) member of a department and
 * its leaders.
 */
export function useMeetingTeam({ boothId, departmentId }: MeetingTeamRef) {
  return useQuery({
    queryKey: ["meeting-team", boothId ?? null, departmentId ?? null],
    queryFn: async (): Promise<MeetingTeam> => {
      const [volunteersRes, leadersRes] = await Promise.all([
        boothId
          ? supabase
              .from("event_participants")
              .select("volunteers (id, full_name, photo_url)")
              .eq("booth_id", boothId)
          : supabase
              .from("volunteer_departments")
              .select("volunteers!inner (id, full_name, photo_url, status)")
              .eq("department_id", departmentId!)
              .neq("volunteers.status", "archived"),
        boothId
          ? supabase
              .from("booth_leaders")
              .select("profiles:user_id (id, full_name)")
              .eq("booth_id", boothId)
          : supabase
              .from("department_leaders")
              .select("profiles:user_id (id, full_name)")
              .eq("department_id", departmentId!),
      ])
      if (volunteersRes.error) throw volunteersRes.error
      if (leadersRes.error) throw leadersRes.error

      const byId = new Map<string, TeamVolunteer>()
      for (const row of (volunteersRes.data ?? []) as unknown as {
        volunteers: TeamVolunteer | null
      }[]) {
        if (row.volunteers) {
          const { id, full_name, photo_url } = row.volunteers
          byId.set(id, { id, full_name, photo_url })
        }
      }
      const volunteers = [...byId.values()].sort((a, b) => a.full_name.localeCompare(b.full_name))
      const leaders = ((leadersRes.data ?? []) as unknown as { profiles: TeamLeader | null }[])
        .map((row) => row.profiles)
        .filter((p): p is TeamLeader => !!p)

      return { volunteers, leaders }
    },
    enabled: !!boothId || !!departmentId,
  })
}

export interface ManageableBooth {
  id: string
  name: string
  event_id: string
  events: { id: string; name: string; date: string } | null
}

/** Booths the user may schedule meetings for: every booth for admins, otherwise the ones they lead. */
export function useManageableBooths(userId: string | undefined, isAdmin: boolean) {
  return useQuery({
    queryKey: ["manageable-booths", userId, isAdmin],
    queryFn: async (): Promise<ManageableBooth[]> => {
      const { data, error } = isAdmin
        ? await supabase.from("event_booths").select("id, name, event_id, events (id, name, date)")
        : await supabase
            .from("event_booths")
            .select("id, name, event_id, events (id, name, date), booth_leaders!inner (user_id)")
            .eq("booth_leaders.user_id", userId!)
      if (error) throw error
      return ((data ?? []) as unknown as ManageableBooth[]).sort((a, b) =>
        (b.events?.date ?? "").localeCompare(a.events?.date ?? "")
      )
    },
    enabled: !!userId,
  })
}

export interface ManageableDepartment {
  id: string
  name: string
}

/** Departments the user may schedule meetings for: every active one for admins, otherwise the ones they lead. */
export function useManageableDepartments(userId: string | undefined, isAdmin: boolean) {
  return useQuery({
    queryKey: ["manageable-departments", userId, isAdmin],
    queryFn: async (): Promise<ManageableDepartment[]> => {
      const { data, error } = isAdmin
        ? await supabase.from("departments").select("id, name").eq("is_active", true)
        : await supabase
            .from("departments")
            .select("id, name, department_leaders!inner (user_id)")
            .eq("department_leaders.user_id", userId!)
      if (error) throw error
      return ((data ?? []) as unknown as ManageableDepartment[])
        .map(({ id, name }) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },
    enabled: !!userId,
  })
}

/** Does the current user lead this meeting's team (the booth or the department)? */
export function useLeadsTeam({ boothId, departmentId }: MeetingTeamRef, userId: string | undefined) {
  return useQuery({
    queryKey: ["leads-team", boothId ?? null, departmentId ?? null, userId],
    queryFn: async () => {
      const { data, error } = boothId
        ? await supabase
            .from("booth_leaders")
            .select("id")
            .eq("booth_id", boothId)
            .eq("user_id", userId!)
        : await supabase
            .from("department_leaders")
            .select("id")
            .eq("department_id", departmentId!)
            .eq("user_id", userId!)
      if (error) throw error
      return (data ?? []).length > 0
    },
    enabled: (!!boothId || !!departmentId) && !!userId,
  })
}

export interface SaveMeetingInput {
  id?: string
  booth_id: string | null
  event_id: string | null
  department_id: string | null
  title: string
  agenda: string | null
  scheduled_at: string
  planned_duration_minutes: number | null
  mode: MeetingMode
  location: string | null
  room: MeetingRoom | null
  created_by?: string | null
}

function invalidateMeetings(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["meetings"] })
  queryClient.invalidateQueries({ queryKey: ["notifications"] })
}

export function useSaveMeeting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: SaveMeetingInput): Promise<string> => {
      if (input.id) {
        const { id, created_by: _createdBy, ...updates } = input
        const { error } = await supabase.from("booth_meetings").update(updates).eq("id", id)
        if (error) throw error
        return id
      }
      const { data, error } = await supabase
        .from("booth_meetings")
        .insert(input)
        .select("id")
        .single()
      if (error) throw error
      return data.id
    },
    onSuccess: () => invalidateMeetings(queryClient),
  })
}

export interface ActionItemInput {
  title: string
  assigned_to_user_id: string | null
  assigned_to_volunteer_id: string | null
  due_date: string | null
  priority: TaskPriority
}

export interface RecordMinutesInput {
  meeting: Pick<BoothMeetingRow, "id" | "booth_id" | "event_id" | "department_id" | "status">
  actual_duration_minutes: number | null
  mode: MeetingMode
  summary: string | null
  ideas_notes: string | null
  attendance: { volunteer_id: string; attended: boolean }[]
  actionItems: ActionItemInput[]
  userId: string | null
}

/**
 * Closes a meeting: stores who came, the summary and notes, and turns each
 * action item into a task on the board. The status flip goes last so the
 * "minutes recorded" notification only fires once everything is saved.
 * Also used to edit minutes later — then the original completion stamp stays.
 */
export function useRecordMinutes() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: RecordMinutesInput) => {
      const { meeting } = input

      if (input.attendance.length) {
        const { error } = await supabase.from("booth_meeting_attendance").upsert(
          input.attendance.map((row) => ({ meeting_id: meeting.id, ...row })),
          { onConflict: "meeting_id,volunteer_id" }
        )
        if (error) throw error
      }

      if (input.actionItems.length) {
        const { error } = await supabase.from("tasks").insert(
          input.actionItems.map((item) => ({
            ...item,
            status: "todo" as const,
            created_by: input.userId,
            // a department meeting's action items land on that department's board
            department_id: meeting.department_id,
            related_event_id: meeting.event_id,
            related_booth_id: meeting.booth_id,
            related_meeting_id: meeting.id,
          }))
        )
        if (error) throw error
      }

      const { error } = await supabase
        .from("booth_meetings")
        .update({
          status: "completed",
          actual_duration_minutes: input.actual_duration_minutes,
          mode: input.mode,
          summary: input.summary,
          ideas_notes: input.ideas_notes,
          ...(meeting.status !== "completed" && {
            completed_at: new Date().toISOString(),
            completed_by: input.userId,
          }),
        })
        .eq("id", meeting.id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidateMeetings(queryClient)
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useSetMeetingStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "scheduled" | "cancelled" }) => {
      const { error } = await supabase.from("booth_meetings").update({ status }).eq("id", id)
      if (error) throw error
    },
    onSuccess: () => invalidateMeetings(queryClient),
  })
}

/** Admins: record the room they booked for a meeting whose team asked for one. */
export function useMarkRoomBooked() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, location }: { id: string; location: string }) => {
      const { error } = await supabase
        .from("booth_meetings")
        .update({ room: "booked", location })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => invalidateMeetings(queryClient),
  })
}

export function useDeleteMeeting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("booth_meetings").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidateMeetings(queryClient)
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
  })
}
