import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { CalendarDays, MapPin, Plus, Search, Store, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { useAuth } from "@/features/auth/auth-context"
import { useEvents, type EventListItem } from "./use-events"
import { EventFormDialog } from "./event-form-dialog"
import { EVENT_STATUS_LABELS } from "@/lib/constants"
import type { EventStatus } from "@/types/database.types"

const ALL = "__all__"

const STATUS_BADGE: Record<EventStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  planned: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  archived: "bg-neutral-200 text-neutral-600 dark:bg-neutral-500/15 dark:text-neutral-400",
}

export function EventsPage() {
  const { profile } = useAuth()
  const { data: events, isLoading } = useEvents()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState(ALL)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<EventListItem | null>(null)

  const isAdmin = profile?.role === "super_admin" || profile?.role === "admin"

  const filtered = useMemo(() => {
    if (!events) return []
    const term = search.trim().toLowerCase()
    return events.filter((event) => {
      if (term && !`${event.name} ${event.location ?? ""}`.toLowerCase().includes(term)) return false
      if (statusFilter !== ALL && event.status !== statusFilter) return false
      return true
    })
  }, [events, search, statusFilter])

  const upcoming = filtered.filter((e) => new Date(e.date) >= new Date(new Date().toDateString()))
  const past = filtered.filter((e) => new Date(e.date) < new Date(new Date().toDateString()))

  function EventCard({ event }: { event: EventListItem }) {
    return (
      <Link to={`/events/${event.id}`}>
        <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
          <CardContent className="flex h-full flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex size-11 flex-col items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <span className="text-[0.6rem] font-semibold uppercase leading-none">
                  {new Date(event.date).toLocaleDateString(undefined, { month: "short" })}
                </span>
                <span className="text-lg font-bold leading-tight">
                  {new Date(event.date).getDate()}
                </span>
              </div>
              <Badge className={STATUS_BADGE[event.status]}>
                {EVENT_STATUS_LABELS[event.status]}
              </Badge>
            </div>

            <div>
              <h3 className="font-semibold text-foreground">{event.name}</h3>
              {event.short_description && (
                <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                  {event.short_description}
                </p>
              )}
            </div>

            <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {event.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3" />
                  {event.location}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Store className="size-3" />
                {event.event_booths.length} booths
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="size-3" />
                {event.event_participants.length} volunteers
              </span>
            </div>

            {event.event_departments.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {event.event_departments.slice(0, 3).map((ed) => (
                  <Badge key={ed.department_id} variant="outline" className="text-xs">
                    {ed.departments.name}
                  </Badge>
                ))}
                {event.event_departments.length > 3 && (
                  <span className="text-xs text-muted-foreground">
                    +{event.event_departments.length - 3}
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </Link>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Events</h1>
          <p className="text-sm text-muted-foreground">
            Plan events, booths and volunteer participation.
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus className="size-4" />
            Create Event
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search events…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? ALL)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {Object.entries(EVENT_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : !filtered.length ? (
        <Card>
          <CardContent>
            <EmptyState
              title={events?.length ? "No events match your filters" : "No events yet"}
              description={
                events?.length
                  ? "Try a different search or status."
                  : "Create your first event to start planning booths and volunteers."
              }
              icon={CalendarDays}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {upcoming.length > 0 && (
            <>
              <h2 className="mt-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Upcoming
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </>
          )}
          {past.length > 0 && (
            <>
              <h2 className="mt-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Past
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {past.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <EventFormDialog open={formOpen} onOpenChange={setFormOpen} event={editing} />
    </div>
  )
}
