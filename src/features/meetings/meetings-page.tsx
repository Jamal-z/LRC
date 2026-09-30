import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CalendarPlus, Users2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { useAuth } from "@/features/auth/auth-context"
import { useUrlState } from "@/lib/use-url-state"
import {
  meetingTeamLabel,
  needsMinutes,
  useManageableBooths,
  useManageableDepartments,
  useMeetings,
} from "./use-meetings"
import { MeetingList } from "./meeting-list"
import { MeetingFormDialog } from "./meeting-form-dialog"
import { WeekCalendar } from "./week-calendar"

type View = "upcoming" | "minutes" | "completed" | "cancelled"

const ALL = "__all__"

const EMPTY_TEXT: Record<View, string> = {
  upcoming: "No upcoming meetings. Schedule one with your team.",
  minutes: "Nothing waiting — every past meeting has its minutes.",
  completed: "No completed meetings yet.",
  cancelled: "No cancelled meetings.",
}

function teamOf(meeting: { booth_id: string | null; department_id: string | null }) {
  return meeting.department_id ? `d:${meeting.department_id}` : `b:${meeting.booth_id}`
}

export function MeetingsPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isAdmin = profile?.role === "super_admin" || profile?.role === "admin"
  const { data: meetings = [], isLoading } = useMeetings()
  const { data: myBooths = [] } = useManageableBooths(profile?.id, isAdmin)
  const { data: myDepartments = [] } = useManageableDepartments(profile?.id, isAdmin)

  const [viewParam, setView] = useUrlState("view", "upcoming")
  const view = viewParam as View
  // "b:<booth id>" or "d:<department id>"
  const [teamFilter, setTeamFilter] = useUrlState("team", ALL)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [pickedStart, setPickedStart] = useState<Date | null>(null)

  const teams = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of meetings) map.set(teamOf(m), meetingTeamLabel(m))
    // departments first, then booths
    return [...map.entries()].sort((a, b) =>
      a[0][0] === b[0][0] ? a[1].localeCompare(b[1]) : a[0][0] === "d" ? -1 : 1
    )
  }, [meetings])

  const grouped = useMemo(() => {
    const filtered =
      teamFilter === ALL ? meetings : meetings.filter((m) => teamOf(m) === teamFilter)
    const groups: Record<View, typeof meetings> = {
      upcoming: [],
      minutes: [],
      completed: [],
      cancelled: [],
    }
    for (const m of filtered) {
      if (m.status === "completed") groups.completed.push(m)
      else if (m.status === "cancelled") groups.cancelled.push(m)
      else if (needsMinutes(m)) groups.minutes.push(m)
      else groups.upcoming.push(m)
    }
    // soonest first for what's ahead; the rest stay newest first
    groups.upcoming.reverse()
    return groups
  }, [meetings, teamFilter])

  const canSchedule = isAdmin || myBooths.length > 0 || myDepartments.length > 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Meetings</h1>
          <p className="text-sm text-muted-foreground">
            Department and booth team meetings — schedule them, then record who came and what was
            decided.
          </p>
        </div>
        {canSchedule && (
          <Button
            onClick={() => {
              setPickedStart(null)
              setScheduleOpen(true)
            }}
          >
            <CalendarPlus className="size-4" />
            Schedule meeting
          </Button>
        )}
      </div>

      <WeekCalendar
        onPickSlot={
          canSchedule
            ? (start) => {
                setPickedStart(start)
                setScheduleOpen(true)
              }
            : undefined
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming ({grouped.upcoming.length})</TabsTrigger>
            <TabsTrigger value="minutes">Needs minutes ({grouped.minutes.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({grouped.completed.length})</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>

        {teams.length > 1 && (
          <Select value={teamFilter} onValueChange={(v) => setTeamFilter(v ?? ALL)}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All teams</SelectItem>
              {teams.map(([id, label]) => (
                <SelectItem key={id} value={id}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : grouped[view].length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState title="No meetings here" description={EMPTY_TEXT[view]} icon={Users2} />
          </CardContent>
        </Card>
      ) : (
        <MeetingList meetings={grouped[view]} />
      )}

      <MeetingFormDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        initialStart={pickedStart}
        onSaved={(id) => navigate(`/meetings/${id}`)}
      />
    </div>
  )
}
