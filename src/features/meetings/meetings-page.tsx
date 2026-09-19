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
import { needsMinutes, useManageableBooths, useMeetings } from "./use-meetings"
import { MeetingList } from "./meeting-list"
import { MeetingFormDialog } from "./meeting-form-dialog"

type View = "upcoming" | "minutes" | "completed" | "cancelled"

const ALL = "__all__"

const EMPTY_TEXT: Record<View, string> = {
  upcoming: "No upcoming meetings. Schedule one with your booth team.",
  minutes: "Nothing waiting — every past meeting has its minutes.",
  completed: "No completed meetings yet.",
  cancelled: "No cancelled meetings.",
}

export function MeetingsPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isAdmin = profile?.role === "super_admin" || profile?.role === "admin"
  const { data: meetings = [], isLoading } = useMeetings()
  const { data: myBooths = [] } = useManageableBooths(profile?.id, isAdmin)

  const [view, setView] = useState<View>("upcoming")
  const [boothFilter, setBoothFilter] = useState(ALL)
  const [scheduleOpen, setScheduleOpen] = useState(false)

  const booths = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of meetings) {
      if (m.event_booths) {
        map.set(m.event_booths.id, `${m.event_booths.name}${m.events ? ` — ${m.events.name}` : ""}`)
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [meetings])

  const grouped = useMemo(() => {
    const filtered =
      boothFilter === ALL ? meetings : meetings.filter((m) => m.booth_id === boothFilter)
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
  }, [meetings, boothFilter])

  const canSchedule = isAdmin || myBooths.length > 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Meetings</h1>
          <p className="text-sm text-muted-foreground">
            Booth team meetings — schedule them, then record who came and what was decided.
          </p>
        </div>
        {canSchedule && (
          <Button onClick={() => setScheduleOpen(true)}>
            <CalendarPlus className="size-4" />
            Schedule meeting
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming ({grouped.upcoming.length})</TabsTrigger>
            <TabsTrigger value="minutes">Needs minutes ({grouped.minutes.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({grouped.completed.length})</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>

        {booths.length > 1 && (
          <Select value={boothFilter} onValueChange={(v) => setBoothFilter(v ?? ALL)}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All booths</SelectItem>
              {booths.map(([id, label]) => (
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
        onSaved={(id) => navigate(`/meetings/${id}`)}
      />
    </div>
  )
}
