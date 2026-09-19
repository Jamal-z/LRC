import { Link } from "react-router-dom"
import { format } from "date-fns"
import { CalendarClock, CheckSquare, Clock, MapPin, Users, Video } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { MEETING_MODE_LABELS, MEETING_STATUS_BADGE, MEETING_STATUS_LABELS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { needsMinutes, type MeetingListItem } from "./use-meetings"

export function MeetingList({
  meetings,
  showBooth = true,
}: {
  meetings: MeetingListItem[]
  showBooth?: boolean
}) {
  return (
    <ul className="flex flex-col gap-2">
      {meetings.map((meeting) => {
        const when = new Date(meeting.scheduled_at)
        const attended = meeting.booth_meeting_attendance.filter((a) => a.attended).length
        const openTasks = meeting.tasks.filter(
          (t) => t.status !== "done" && t.status !== "cancelled"
        ).length
        const overdue = needsMinutes(meeting)

        return (
          <li key={meeting.id}>
            <Link
              to={`/meetings/${meeting.id}`}
              className={cn(
                "flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-accent/50",
                meeting.status === "cancelled" && "opacity-60"
              )}
            >
              <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-muted py-1.5 text-center">
                <span className="text-[0.65rem] font-medium uppercase text-muted-foreground">
                  {format(when, "MMM")}
                </span>
                <span className="text-lg font-semibold leading-none text-foreground">
                  {format(when, "d")}
                </span>
                <span className="mt-0.5 text-[0.65rem] text-muted-foreground">
                  {format(when, "HH:mm")}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{meeting.title}</p>
                  {overdue ? (
                    <Badge className="bg-amber-100 text-[0.65rem] text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                      Needs minutes
                    </Badge>
                  ) : (
                    <Badge className={cn("text-[0.65rem]", MEETING_STATUS_BADGE[meeting.status])}>
                      {MEETING_STATUS_LABELS[meeting.status]}
                    </Badge>
                  )}
                </div>
                {showBooth && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {meeting.event_booths?.name ?? "Booth"}
                    {meeting.events && ` — ${meeting.events.name}`}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    {meeting.mode === "online" ? (
                      <Video className="size-3" />
                    ) : (
                      <MapPin className="size-3" />
                    )}
                    {MEETING_MODE_LABELS[meeting.mode]}
                    {meeting.mode === "in_person" && meeting.location && ` · ${meeting.location}`}
                  </span>
                  {(meeting.actual_duration_minutes ?? meeting.planned_duration_minutes) && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" />
                      {meeting.actual_duration_minutes ?? meeting.planned_duration_minutes} min
                    </span>
                  )}
                  {meeting.status === "completed" && (
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3" />
                      {attended}/{meeting.booth_meeting_attendance.length} attended
                    </span>
                  )}
                  {meeting.tasks.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <CheckSquare className="size-3" />
                      {openTasks} open / {meeting.tasks.length} tasks
                    </span>
                  )}
                </div>
              </div>

              {meeting.status === "scheduled" && !overdue && (
                <CalendarClock className="mt-1 size-4 shrink-0 text-muted-foreground" />
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
