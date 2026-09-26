import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { addDays, addWeeks, format, isSameDay, isToday, parseISO, startOfWeek } from "date-fns"
import {
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  DoorOpen,
  Hourglass,
  TriangleAlert,
  Video,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { CENTER_HALL_NAME } from "@/lib/constants"
import { useUrlState } from "@/lib/use-url-state"
import { cn } from "@/lib/utils"
import type { MeetingCalendarEntry } from "@/types/database.types"
import { meetingEnd, useMeetingCalendar } from "./use-meetings"

const HOUR_PX = 44
const DEFAULT_FIRST_HOUR = 8
const DEFAULT_LAST_HOUR = 20 // grid ends at this hour
const SLOT_MINUTES = 30

// one colour per booth; literal class names so Tailwind keeps them
const BOOTH_COLORS = [
  { block: "bg-sky-100 border-sky-400 text-sky-900 dark:bg-sky-500/20 dark:border-sky-400/60 dark:text-sky-100", dot: "bg-sky-500" },
  { block: "bg-violet-100 border-violet-400 text-violet-900 dark:bg-violet-500/20 dark:border-violet-400/60 dark:text-violet-100", dot: "bg-violet-500" },
  { block: "bg-emerald-100 border-emerald-400 text-emerald-900 dark:bg-emerald-500/20 dark:border-emerald-400/60 dark:text-emerald-100", dot: "bg-emerald-500" },
  { block: "bg-rose-100 border-rose-400 text-rose-900 dark:bg-rose-500/20 dark:border-rose-400/60 dark:text-rose-100", dot: "bg-rose-500" },
  { block: "bg-orange-100 border-orange-400 text-orange-900 dark:bg-orange-500/20 dark:border-orange-400/60 dark:text-orange-100", dot: "bg-orange-500" },
  { block: "bg-teal-100 border-teal-400 text-teal-900 dark:bg-teal-500/20 dark:border-teal-400/60 dark:text-teal-100", dot: "bg-teal-500" },
  { block: "bg-fuchsia-100 border-fuchsia-400 text-fuchsia-900 dark:bg-fuchsia-500/20 dark:border-fuchsia-400/60 dark:text-fuchsia-100", dot: "bg-fuchsia-500" },
  { block: "bg-lime-100 border-lime-500 text-lime-900 dark:bg-lime-500/20 dark:border-lime-400/60 dark:text-lime-100", dot: "bg-lime-500" },
]

function boothColor(boothId: string) {
  let hash = 0
  for (let i = 0; i < boothId.length; i++) hash = (hash * 31 + boothId.charCodeAt(i)) >>> 0
  return BOOTH_COLORS[hash % BOOTH_COLORS.length]
}

interface PlacedEntry {
  entry: MeetingCalendarEntry
  start: Date
  end: Date
  lane: number
  lanes: number
}

/** Side-by-side lanes for meetings that overlap within one day. */
function placeDay(entries: MeetingCalendarEntry[]): PlacedEntry[] {
  const items = entries
    .map((entry) => {
      const start = new Date(entry.scheduled_at)
      return { entry, start, end: meetingEnd(start, entry.duration_minutes), lane: 0, lanes: 1 }
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  let cluster: PlacedEntry[] = []
  let clusterEnd = 0
  const closeCluster = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1))
    for (const c of cluster) c.lanes = lanes
    cluster = []
  }

  for (const item of items) {
    if (cluster.length && item.start.getTime() >= clusterEnd) closeCluster()
    const taken = new Set(
      cluster.filter((c) => c.end.getTime() > item.start.getTime()).map((c) => c.lane)
    )
    let lane = 0
    while (taken.has(lane)) lane++
    item.lane = lane
    cluster.push(item)
    clusterEnd = Math.max(clusterEnd, item.end.getTime())
  }
  if (cluster.length) closeCluster()
  return items
}

/**
 * The week at a glance: every booth's meetings, coloured by team, so leaders
 * can see which days and hours are busy before picking a time. Clicking a free
 * spot starts a new meeting there.
 */
export function WeekCalendar({ onPickSlot }: { onPickSlot?: (start: Date) => void }) {
  const navigate = useNavigate()
  // the week shown is kept in the URL so coming back from a meeting lands on the same week
  const [weekParam, setWeekParam] = useUrlState("week", "")
  const weekStart = useMemo(() => {
    const parsed = weekParam ? parseISO(weekParam) : null
    return startOfWeek(parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date(), {
      weekStartsOn: 0,
    })
  }, [weekParam])
  const setWeekStart = (next: Date) =>
    setWeekParam(
      isSameDay(next, startOfWeek(new Date(), { weekStartsOn: 0 })) ? "" : format(next, "yyyy-MM-dd")
    )
  const weekEnd = addDays(weekStart, 7)
  const { data: entries = [], isLoading, isError } = useMeetingCalendar(weekStart, weekEnd)

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const { firstHour, lastHour } = useMemo(() => {
    let first = DEFAULT_FIRST_HOUR
    let last = DEFAULT_LAST_HOUR
    for (const e of entries) {
      const start = new Date(e.scheduled_at)
      const end = meetingEnd(start, e.duration_minutes)
      if (!isSameDay(start, end)) {
        last = 24
      } else {
        last = Math.max(last, end.getHours() + (end.getMinutes() > 0 ? 1 : 0))
      }
      first = Math.min(first, start.getHours())
    }
    return { firstHour: first, lastHour: Math.min(24, Math.max(last, first + 1)) }
  }, [entries])

  const byDay = useMemo(
    () =>
      days.map((day) => placeDay(entries.filter((e) => isSameDay(new Date(e.scheduled_at), day)))),
    [days, entries]
  )

  const teams = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of entries) map.set(e.booth_id, e.booth_name ?? "Booth")
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [entries])

  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i)
  const gridHeight = hours.length * HOUR_PX
  const thisWeek = isSameDay(weekStart, startOfWeek(new Date(), { weekStartsOn: 0 }))

  function handleColumnClick(day: Date, event: React.MouseEvent<HTMLDivElement>) {
    if (!onPickSlot) return
    const rect = event.currentTarget.getBoundingClientRect()
    const minutesFromTop = ((event.clientY - rect.top) / HOUR_PX) * 60
    const snapped = Math.floor(minutesFromTop / SLOT_MINUTES) * SLOT_MINUTES
    const start = new Date(day)
    start.setHours(firstHour, 0, 0, 0)
    start.setMinutes(start.getMinutes() + snapped)
    if (start < new Date()) return
    onPickSlot(start)
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {format(weekStart, "d MMM")} – {format(addDays(weekStart, 6), "d MMM yyyy")}
            </h2>
            <p className="text-xs text-muted-foreground">
              All teams' meetings this week.
              {onPickSlot && " Click a free spot to schedule one there."}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous week"
              onClick={() => setWeekStart(addWeeks(weekStart, -1))}
            >
              <ChevronLeft className="size-4 rtl:rotate-180" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={thisWeek}
              onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}
            >
              This week
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next week"
              onClick={() => setWeekStart(addWeeks(weekStart, 1))}
            >
              <ChevronRight className="size-4 rtl:rotate-180" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-80 w-full" />
        ) : isError ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Couldn't load this week's meetings.
          </p>
        ) : (
          <div className="-mx-1 overflow-x-auto px-1">
            <div className="min-w-[760px]">
              {/* day headers */}
              <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))] border-b border-border">
                <div />
                {days.map((day, i) => {
                  const count = byDay[i].length
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "flex flex-col items-center gap-0.5 py-2 text-center",
                        isToday(day) && "rounded-t-lg bg-primary/5"
                      )}
                    >
                      <span className="text-[0.7rem] font-medium uppercase text-muted-foreground">
                        {format(day, "EEE")}
                      </span>
                      <span
                        className={cn(
                          "flex size-7 items-center justify-center rounded-full text-sm font-semibold text-foreground",
                          isToday(day) && "bg-primary text-primary-foreground"
                        )}
                      >
                        {format(day, "d")}
                      </span>
                      <span
                        className={cn(
                          "text-[0.65rem]",
                          count ? "font-medium text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {count ? `${count} meeting${count > 1 ? "s" : ""}` : "Free"}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* time grid */}
              <div className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))]">
                <div className="relative" style={{ height: gridHeight }}>
                  {hours.map((h, i) => (
                    <span
                      key={h}
                      className="absolute right-2 -translate-y-1/2 text-[0.65rem] text-muted-foreground"
                      style={{ top: i * HOUR_PX }}
                    >
                      {i === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
                    </span>
                  ))}
                </div>

                {days.map((day, i) => (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "relative border-l border-border",
                      isToday(day) && "bg-primary/5",
                      onPickSlot && "cursor-pointer"
                    )}
                    style={{
                      height: gridHeight,
                      backgroundImage:
                        "linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
                      backgroundSize: `100% ${HOUR_PX}px`,
                    }}
                    onClick={(e) => handleColumnClick(day, e)}
                  >
                    {byDay[i].map((placed) => (
                      <CalendarBlock
                        key={placed.entry.id}
                        placed={placed}
                        day={day}
                        firstHour={firstHour}
                        lastHour={lastHour}
                        onOpen={() => navigate(`/meetings/${placed.entry.id}`)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {teams.map(([id, name]) => (
            <span key={id} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-full", boothColor(id).dot)} />
              {name}
            </span>
          ))}
          {teams.length > 0 && <span className="h-3 w-px bg-border" />}
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-4 rounded-sm border-l-4 border-foreground/40 bg-muted" />
            {CENTER_HALL_NAME}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Hourglass className="size-3 text-amber-600" />
            Room requested
          </span>
          <span className="inline-flex items-center gap-1.5">
            <DoorOpen className="size-3" />
            Other room
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Video className="size-3" />
            Online
          </span>
          <span className="h-3 w-px bg-border" />
          <span className="inline-flex items-center gap-1.5">
            <CircleCheck className="size-3.5 fill-emerald-500 text-white dark:text-emerald-950" />
            Minutes written
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-4 rounded-sm border-2 border-dashed border-red-500" />
            <TriangleAlert className="size-3 text-red-600 dark:text-red-400" />
            Over, no minutes yet
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function CalendarBlock({
  placed,
  day,
  firstHour,
  lastHour,
  onOpen,
}: {
  placed: PlacedEntry
  day: Date
  firstHour: number
  lastHour: number
  onOpen: () => void
}) {
  const { entry, start, end, lane, lanes } = placed
  const gridStart = new Date(day)
  gridStart.setHours(firstHour, 0, 0, 0)
  const gridMinutes = (lastHour - firstHour) * 60

  const top = Math.max(0, (start.getTime() - gridStart.getTime()) / 60_000)
  const bottom = Math.min(gridMinutes, (end.getTime() - gridStart.getTime()) / 60_000)
  const height = Math.max(((bottom - top) / 60) * HOUR_PX, 20)

  const color = boothColor(entry.booth_id)
  const timeLabel = `${format(start, "HH:mm")}–${format(end, "HH:mm")}`
  const where =
    entry.mode === "online"
      ? "Online"
      : entry.room === "booking_requested"
        ? "Room requested"
        : (entry.location ?? CENTER_HALL_NAME)
  // over and still no minutes — the thing a leader has to notice
  const noMinutes = entry.status === "scheduled" && end < new Date()
  const minutesNote =
    entry.status === "completed" ? "\nMinutes written" : noMinutes ? "\nNo minutes yet" : ""
  const tooltip = `${entry.booth_name ?? "Booth"} — ${entry.title}\n${timeLabel} · ${where}${minutesNote}`

  return (
    <button
      type="button"
      title={tooltip}
      disabled={!entry.can_open}
      onClick={(e) => {
        e.stopPropagation()
        if (entry.can_open) onOpen()
      }}
      className={cn(
        "absolute overflow-hidden rounded-md border border-l-4 px-1.5 py-1 text-start text-[0.7rem] leading-tight shadow-xs transition-shadow",
        color.block,
        entry.can_open ? "cursor-pointer hover:shadow-md" : "cursor-default",
        entry.mode === "online" && "border-dashed opacity-80",
        entry.room === "booking_requested" && "border-dashed border-amber-500 dark:border-amber-400",
        noMinutes &&
          "border-2 border-dashed border-red-500 ring-2 ring-red-500/25 dark:border-red-400"
      )}
      style={{
        top: (top / 60) * HOUR_PX + 1,
        height: height - 2,
        left: `calc(${(lane / lanes) * 100}% + 2px)`,
        width: `calc(${100 / lanes}% - 4px)`,
      }}
    >
      <span className="flex items-center gap-1 font-semibold">
        {entry.mode === "online" ? (
          <Video className="size-3 shrink-0" />
        ) : entry.room === "booking_requested" ? (
          <Hourglass className="size-3 shrink-0 text-amber-600 dark:text-amber-400" />
        ) : entry.room === "booked" ? (
          <DoorOpen className="size-3 shrink-0" />
        ) : null}
        <span className="truncate">{entry.booth_name ?? "Booth"}</span>
        {entry.status === "completed" ? (
          <CircleCheck
            className="ms-auto size-3.5 shrink-0 fill-emerald-500 text-white dark:text-emerald-950"
            aria-label="Minutes written"
          />
        ) : noMinutes ? (
          <TriangleAlert
            className="ms-auto size-3.5 shrink-0 text-red-600 dark:text-red-400"
            aria-label="No minutes yet"
          />
        ) : null}
      </span>
      <span className="block truncate opacity-80">{timeLabel}</span>
      {height > 52 && <span className="block truncate opacity-80">{entry.title}</span>}
    </button>
  )
}
