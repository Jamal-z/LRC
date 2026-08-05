import { Link } from "react-router-dom"
import { CalendarDays, ClipboardCheck, Store, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { EVENT_STATUS_LABELS } from "@/lib/constants"
import { useEvaluationEvents } from "./use-evaluations"

export function EvaluationsPage() {
  const { data: events, isLoading } = useEvaluationEvents()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Evaluations</h1>
        <p className="text-sm text-muted-foreground">
          Pick an event, then evaluate the volunteers in your booth or team.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : !events?.length ? (
        <Card>
          <CardContent>
            <EmptyState
              title="No events yet"
              description="Once an event exists and has participants, evaluations start here."
              icon={ClipboardCheck}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => {
            const percent =
              event.participantCount > 0
                ? Math.min(100, Math.round((event.evaluationCount / event.participantCount) * 100))
                : 0

            return (
              <Link key={event.id} to={`/evaluations/${event.id}`}>
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
                      <Badge variant="secondary">{EVENT_STATUS_LABELS[event.status]}</Badge>
                    </div>

                    <h2 className="font-semibold text-foreground">{event.name}</h2>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="size-3" />
                        {new Date(event.date).toLocaleDateString()}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Store className="size-3" />
                        {event.boothCount} booths
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3" />
                        {event.participantCount} volunteers
                      </span>
                    </div>

                    <div className="mt-auto">
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                        <span>Evaluated</span>
                        <span>
                          {event.evaluationCount}/{event.participantCount}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    <Button size="sm" className="w-full">
                      <ClipboardCheck className="size-4" />
                      Open evaluations
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
