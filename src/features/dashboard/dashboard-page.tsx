import { Link } from "react-router-dom"
import {
  AlertTriangle,
  CalendarDays,
  Images,
  Sparkles,
  Star,
  Trophy,
  Users,
} from "lucide-react"
import { useDashboardData } from "./use-dashboard-data"
import { DepartmentCarousel } from "./department-carousel"
import { EmptyState } from "@/components/shared/empty-state"
import { LrcLogoPlate } from "@/components/shared/lrc-logo"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/features/auth/auth-context"
import { ROLE_LABELS } from "@/lib/constants"

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
}

const MEDAL_STYLES = [
  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
]

export function DashboardPage() {
  const { profile } = useAuth()
  const { data, isError } = useDashboardData()

  const maxDeptCount = Math.max(1, ...(data?.volunteersByDepartment.map((d) => d.count) ?? [1]))

  const HERO_STATS = [
    { label: "Volunteers", value: data?.totalVolunteers ?? 0 },
    { label: "Active now", value: data?.activeVolunteers ?? 0 },
    { label: "Teams", value: data?.volunteersByDepartment.length ?? 0 },
    { label: "Shifts covered", value: data?.totalShifts ?? 0 },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* welcome + a word about the centre on the left, the looping clip kept
          small on the right so it never takes over the screen */}
      <Card className="overflow-hidden">
        <CardContent className="grid grid-cols-1 items-center gap-6 py-2 lg:grid-cols-[minmax(0,1fr)_48rem]">
          <div className="flex flex-col items-start gap-6 py-4">
            {/* the wordmark's lettering is black, so it keeps its white plate —
                invisible on the light card, readable at night */}
            <LrcLogoPlate className="-ml-3 px-3 py-2 shadow-none" logoClassName="h-20 xl:h-24" />

            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                Welcome back{profile ? `, ${profile.full_name}` : ""}
              </h1>
              {profile && (
                <p className="mt-1.5 text-sm text-muted-foreground">{ROLE_LABELS[profile.role]}</p>
              )}
            </div>

            {/* hairline grid — gap-px over the border colour draws the dividers */}
            <div className="grid w-full grid-cols-2 gap-px overflow-hidden rounded-xl bg-border xl:grid-cols-4">
              {HERO_STATS.map((stat) => (
                <div key={stat.label} className="bg-card px-4 py-3">
                  <p className="text-2xl font-semibold tabular-nums text-foreground">
                    {stat.value}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <video
            src="/media/dashboard-hero.mp4"
            autoPlay
            loop
            muted
            playsInline
            // decorative footage, kept at its own aspect ratio so nothing is cropped
            aria-hidden
            className="mx-auto block max-h-[36rem] w-auto max-w-full rounded-xl bg-black shadow-md lg:w-full"
          />
        </CardContent>
      </Card>

      <DepartmentCarousel />

      {isError && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-4 text-sm text-destructive">
            Couldn't load live data — check your connection and refresh.
          </CardContent>
        </Card>
      )}

      {/* memories — the centre's own photos take the lead */}
      {data?.memories.length ? (
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Images className="size-4 text-primary" />
              Memories
            </CardTitle>
            <p className="text-xs text-muted-foreground">Moments from our events</p>
          </CardHeader>
          <CardContent>
            <div className="grid auto-rows-[7rem] grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {data.memories.map((photo, index) => (
                <div
                  key={photo.id}
                  className={cn(
                    "group relative overflow-hidden rounded-xl",
                    // a couple of hero tiles keep the grid from looking flat
                    index === 0 && "col-span-2 row-span-2",
                    index === 5 && "col-span-2"
                  )}
                >
                  <img
                    src={photo.url}
                    alt={photo.eventName ?? "Event memory"}
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  {photo.eventName && (
                    <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-2 pt-8 pb-2 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {photo.eventName}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* per-team breakdown — magnitude comparison, so one hue throughout */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Volunteers by team</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.volunteersByDepartment.length ? (
            <div className="flex flex-col gap-2.5">
              {data.volunteersByDepartment.map((dept) => (
                <Link
                  key={dept.id}
                  to={`/departments/${dept.id}`}
                  className="group flex items-center gap-3"
                >
                  <span className="w-48 shrink-0 truncate text-sm text-foreground group-hover:underline">
                    {dept.department}
                  </span>
                  <div className="h-5 flex-1 rounded-md bg-muted/70">
                    <div
                      className="h-full rounded-md bg-primary transition-all group-hover:bg-primary/85"
                      style={{ width: `${Math.max(3, (dept.count / maxDeptCount) * 100)}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
                    {dept.count}
                  </span>
                  <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                    {dept.active} active
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No volunteers yet"
              description="Import volunteers or add one to see the breakdown here."
              icon={Users}
            />
          )}
        </CardContent>
      </Card>

      {/* top rated + upcoming events */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-amber-500" />
              Top rated volunteers
            </CardTitle>
            <Button size="xs" variant="ghost" render={<Link to="/reports" />}>
              All reports
            </Button>
          </CardHeader>
          <CardContent>
            {data?.topVolunteers.length ? (
              <ul className="flex flex-col divide-y divide-border">
                {data.topVolunteers.map((volunteer, index) => (
                  <li key={volunteer.id} className="flex items-center gap-3 py-2.5">
                    <span
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        MEDAL_STYLES[index] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <Avatar className="size-9">
                      {volunteer.photo_url && <AvatarImage src={volunteer.photo_url} />}
                      <AvatarFallback className="bg-accent text-xs text-accent-foreground">
                        {initials(volunteer.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/volunteers/${volunteer.id}`}
                        className="truncate text-sm font-medium text-foreground hover:underline"
                      >
                        {volunteer.full_name}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {volunteer.department ?? "—"} · {volunteer.shifts} shifts
                      </p>
                    </div>
                    <Badge variant="secondary" className="gap-1">
                      <Star className="size-3 fill-amber-400 text-amber-400" />
                      {volunteer.average.toFixed(1)}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No evaluations yet"
                description="Once leaders evaluate volunteers after an event, the top performers show up here."
                icon={Star}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming events</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.upcomingEvents.length ? (
              <ul className="flex flex-col divide-y divide-border">
                {data.upcomingEvents.map((event) => (
                  <li key={event.id} className="flex items-center gap-3 py-2.5">
                    <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl bg-accent text-accent-foreground">
                      <span className="text-[0.6rem] font-semibold uppercase leading-none">
                        {new Date(event.date).toLocaleDateString(undefined, { month: "short" })}
                      </span>
                      <span className="text-lg font-bold leading-tight">
                        {new Date(event.date).getDate()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/events/${event.id}`}
                        className="truncate text-sm font-medium text-foreground hover:underline"
                      >
                        {event.name}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {event.location ?? "—"}
                      </p>
                    </div>
                    <Badge variant="secondary">{event.status}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No upcoming events"
                description="Planned events will show up here."
                icon={CalendarDays}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* star of every team */}
      {data?.topByTeam.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4 text-amber-500" />
              Star of each team
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.topByTeam.map(({ department, volunteer }) => (
                <Link
                  key={department}
                  to={`/volunteers/${volunteer.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border p-3 transition-shadow hover:shadow-md"
                >
                  <Avatar className="size-12">
                    {volunteer.photo_url && <AvatarImage src={volunteer.photo_url} />}
                    <AvatarFallback className="bg-accent text-accent-foreground">
                      {initials(volunteer.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {department}
                    </p>
                    <p className="truncate text-sm font-semibold text-foreground">
                      {volunteer.full_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {volunteer.shifts} shifts · {volunteer.evaluations} evaluations
                    </p>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <Star className="size-3 fill-amber-400 text-amber-400" />
                    {volunteer.average.toFixed(1)}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* overdue tasks */}
      {data?.overdueTasks.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-destructive" />
              Overdue tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-border">
              {data.overdueTasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-foreground">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Due {task.due_date ? new Date(task.due_date).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <Badge variant="destructive">{task.priority}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
