import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

export interface DepartmentCount {
  id: string
  department: string
  count: number
  active: number
}

export interface UpcomingEvent {
  id: string
  name: string
  date: string
  location: string | null
  status: string
}

export interface OverdueTask {
  id: string
  title: string
  due_date: string | null
  priority: string
}

export interface TopVolunteer {
  id: string
  full_name: string
  photo_url: string | null
  department: string | null
  average: number
  shifts: number
  evaluations: number
}

export interface MemoryPhoto {
  id: string
  url: string
  eventName: string | null
  eventDate: string | null
}

export interface DashboardData {
  totalVolunteers: number
  activeVolunteers: number
  newVolunteers: number
  needsFollowUp: number
  terminatedCount: number
  volunteersByDepartment: DepartmentCount[]
  upcomingEvents: UpcomingEvent[]
  openTasksCount: number
  overdueTasks: OverdueTask[]
  totalShifts: number
  eventsThisYear: number
  topVolunteers: TopVolunteer[]
  /** best-rated volunteer per team, so every team gets a spotlight */
  topByTeam: { department: string; volunteer: TopVolunteer }[]
  memories: MemoryPhoto[]
}

function shuffle<T>(items: T[]) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async (): Promise<DashboardData> => {
      const today = new Date().toISOString().slice(0, 10)
      const yearStart = `${new Date().getFullYear()}-01-01`

      const [
        volunteersRes,
        departmentsRes,
        volunteerDepartmentsRes,
        upcomingEventsRes,
        eventsThisYearRes,
        openTasksRes,
        overdueTasksRes,
        evaluationsRes,
        photosRes,
      ] = await Promise.all([
        supabase.from("volunteers").select("id, full_name, photo_url, status, primary_department_id"),
        supabase.from("departments").select("id, name").eq("is_active", true).order("name"),
        supabase.from("volunteer_departments").select("department_id, volunteer_id"),
        supabase
          .from("events")
          .select("id, name, date, location, status")
          .gte("date", today)
          .in("status", ["planned", "in_progress"])
          .order("date", { ascending: true })
          .limit(5),
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
          .gte("date", yearStart),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .not("status", "in", "(done,cancelled)"),
        supabase
          .from("tasks")
          .select("id, title, due_date, priority")
          .lt("due_date", today)
          .not("status", "in", "(done,cancelled)")
          .order("due_date", { ascending: true })
          .limit(5),
        supabase
          .from("event_evaluations")
          .select(
            "volunteer_id, shifts_count, meeting_attendance_rating, performance_rating, teamwork_rating, communication_rating"
          ),
        supabase
          .from("event_photos")
          .select("id, url, events (name, date)")
          .order("created_at", { ascending: false })
          .limit(40),
      ])

      const allVolunteers = (volunteersRes.data ?? []) as {
        id: string
        full_name: string
        photo_url: string | null
        status: string
        primary_department_id: string | null
      }[]

      // terminated volunteers never count towards the roster totals
      const roster = allVolunteers.filter((v) => v.status !== "archived")
      const rosterIds = new Set(roster.map((v) => v.id))
      const statusById = new Map(roster.map((v) => [v.id, v.status]))

      const departments = (departmentsRes.data ?? []) as { id: string; name: string }[]
      const links = (volunteerDepartmentsRes.data ?? []) as {
        department_id: string
        volunteer_id: string
      }[]

      const volunteersByDepartment: DepartmentCount[] = departments.map((dept) => {
        const members = links.filter(
          (link) => link.department_id === dept.id && rosterIds.has(link.volunteer_id)
        )
        return {
          id: dept.id,
          department: dept.name,
          count: members.length,
          active: members.filter((m) => statusById.get(m.volunteer_id) === "active").length,
        }
      })

      // aggregate every evaluation per volunteer for the leaderboard
      const evaluations = (evaluationsRes.data ?? []) as {
        volunteer_id: string
        shifts_count: number | null
        meeting_attendance_rating: number | null
        performance_rating: number | null
        teamwork_rating: number | null
        communication_rating: number | null
      }[]

      const statsByVolunteer = new Map<
        string,
        { ratingSum: number; ratingCount: number; shifts: number; evaluations: number }
      >()
      for (const evaluation of evaluations) {
        const scores = [
          evaluation.meeting_attendance_rating,
          evaluation.performance_rating,
          evaluation.teamwork_rating,
          evaluation.communication_rating,
        ].filter((v): v is number => v != null)

        const entry =
          statsByVolunteer.get(evaluation.volunteer_id) ??
          { ratingSum: 0, ratingCount: 0, shifts: 0, evaluations: 0 }
        if (scores.length) {
          entry.ratingSum += scores.reduce((a, b) => a + b, 0) / scores.length
          entry.ratingCount++
        }
        entry.shifts += evaluation.shifts_count ?? 0
        entry.evaluations++
        statsByVolunteer.set(evaluation.volunteer_id, entry)
      }

      const departmentNameById = new Map(departments.map((d) => [d.id, d.name]))
      const rated: TopVolunteer[] = roster
        .map((volunteer) => {
          const stats = statsByVolunteer.get(volunteer.id)
          if (!stats?.ratingCount) return null
          return {
            id: volunteer.id,
            full_name: volunteer.full_name,
            photo_url: volunteer.photo_url,
            department: volunteer.primary_department_id
              ? (departmentNameById.get(volunteer.primary_department_id) ?? null)
              : null,
            average: stats.ratingSum / stats.ratingCount,
            shifts: stats.shifts,
            evaluations: stats.evaluations,
          }
        })
        .filter((v): v is TopVolunteer => v != null)
        .sort((a, b) => b.average - a.average || b.shifts - a.shifts)

      const topVolunteers = rated.slice(0, 6)

      // one standout per team — `rated` is already sorted, so the first hit wins
      const seenTeams = new Set<string>()
      const topByTeam: { department: string; volunteer: TopVolunteer }[] = []
      for (const volunteer of rated) {
        if (!volunteer.department || seenTeams.has(volunteer.department)) continue
        seenTeams.add(volunteer.department)
        topByTeam.push({ department: volunteer.department, volunteer })
      }

      const memories: MemoryPhoto[] = shuffle(
        ((photosRes.data ?? []) as unknown as {
          id: string
          url: string
          events: { name: string; date: string } | null
        }[]).map((photo) => ({
          id: photo.id,
          url: photo.url,
          eventName: photo.events?.name ?? null,
          eventDate: photo.events?.date ?? null,
        }))
      ).slice(0, 18)

      return {
        totalVolunteers: roster.length,
        activeVolunteers: roster.filter((v) => v.status === "active").length,
        newVolunteers: roster.filter((v) => v.status === "new").length,
        needsFollowUp: roster.filter((v) => v.status === "needs_follow_up").length,
        terminatedCount: allVolunteers.length - roster.length,
        volunteersByDepartment,
        upcomingEvents: upcomingEventsRes.data ?? [],
        openTasksCount: openTasksRes.count ?? 0,
        overdueTasks: overdueTasksRes.data ?? [],
        totalShifts: evaluations.reduce((sum, e) => sum + (e.shifts_count ?? 0), 0),
        eventsThisYear: eventsThisYearRes.count ?? 0,
        topVolunteers,
        topByTeam,
        memories,
      }
    },
  })
}
