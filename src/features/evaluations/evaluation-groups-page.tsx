import { Link, useParams } from "react-router-dom"
import { ArrowLeft, Building2, ClipboardCheck, Store, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { useAuth } from "@/features/auth/auth-context"
import { useEvaluationGroups, type EvaluationGroup } from "./use-evaluations"

function GroupCard({
  eventId,
  group,
  icon: Icon,
}: {
  eventId: string
  group: EvaluationGroup
  icon: typeof Store
}) {
  const percent =
    group.participantCount > 0
      ? Math.min(100, Math.round((group.evaluatedCount / group.participantCount) * 100))
      : 0
  const done = group.participantCount > 0 && group.evaluatedCount >= group.participantCount

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Icon className="size-5" />
          </div>
          {done && (
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              Done
            </Badge>
          )}
        </div>

        <div>
          <h3 className="font-semibold text-foreground">{group.name}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {group.leaderNames.length ? `Led by ${group.leaderNames.join(", ")}` : "No leader yet"}
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="size-3.5" />
          {group.participantCount} volunteers
        </div>

        <div className="mt-auto">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>You evaluated</span>
            <span>
              {group.evaluatedCount}/{group.participantCount}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <Button
          size="sm"
          className="w-full"
          disabled={group.participantCount === 0}
          render={<Link to={`/evaluations/${eventId}/${group.type}/${group.id}`} />}
        >
          <ClipboardCheck className="size-4" />
          {group.participantCount === 0 ? "No volunteers" : "Evaluate"}
        </Button>
      </CardContent>
    </Card>
  )
}

export function EvaluationGroupsPage() {
  const { eventId } = useParams()
  const { profile } = useAuth()
  const { data, isLoading } = useEvaluationGroups(eventId, profile?.id)

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const isAdmin = profile?.role === "super_admin" || profile?.role === "admin"

  // Booth leaders only see the booths they lead; department leaders only see
  // their own team (they evaluate the team as a whole, not booth by booth).
  const visibleBooths = isAdmin
    ? data.booths
    : data.booths.filter((booth) => booth.leaderIds.includes(profile?.id ?? ""))
  const visibleDepartments = isAdmin
    ? data.departments
    : data.departments.filter((dept) => dept.leaderIds.includes(profile?.id ?? ""))

  const nothingToEvaluate = visibleBooths.length === 0 && visibleDepartments.length === 0

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" render={<Link to="/evaluations" />}>
          <ArrowLeft className="size-4" />
          Back to events
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{data.event.name}</h1>
        <p className="text-sm text-muted-foreground">
          {new Date(data.event.date).toLocaleDateString(undefined, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {nothingToEvaluate ? (
        <Card>
          <CardContent>
            <EmptyState
              title="Nothing assigned to you in this event"
              description="You'll see your booth or your team here once an admin assigns you."
              icon={ClipboardCheck}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {visibleBooths.length > 0 && (
            <>
              <h2 className="mt-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Booths
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleBooths.map((booth) => (
                  <GroupCard key={booth.id} eventId={eventId!} group={booth} icon={Store} />
                ))}
              </div>
            </>
          )}

          {visibleDepartments.length > 0 && (
            <>
              <h2 className="mt-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Teams
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleDepartments.map((dept) => (
                  <GroupCard key={dept.id} eventId={eventId!} group={dept} icon={Building2} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
