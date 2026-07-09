import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { CalendarDays, ClipboardCheck, Star, Store, Users } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { EVENT_STATUS_LABELS } from "@/lib/constants"
import type { EventStatus } from "@/types/database.types"

interface EventEvalSummary {
  id: string
  name: string
  date: string
  status: EventStatus
  boothCount: number
  participantCount: number
  evaluationCount: number
  avgPerformance: number | null
}

function useEventEvaluationSummaries() {
  return useQuery({
    queryKey: ["event-eval-summaries"],
    queryFn: async (): Promise<EventEvalSummary[]> => {
      const { data, error } = await supabase
        .from("events")
        .select(
          "id, name, date, status, event_booths (id), event_participants (id), event_evaluations (id, performance_rating)"
        )
        .order("date", { ascending: false })
      if (error) throw error

      return ((data ?? []) as unknown as {
        id: string
        name: string
        date: string
        status: EventStatus
        event_booths: { id: string }[]
        event_participants: { id: string }[]
        event_evaluations: { id: string; performance_rating: number | null }[]
      }[]).map((event) => {
        const ratings = event.event_evaluations
          .map((ev) => ev.performance_rating)
          .filter((r): r is number => r != null)
        return {
          id: event.id,
          name: event.name,
          date: event.date,
          status: event.status,
          boothCount: event.event_booths.length,
          participantCount: event.event_participants.length,
          evaluationCount: event.event_evaluations.length,
          avgPerformance: ratings.length
            ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1))
            : null,
        }
      })
    },
  })
}

export function EvaluationsPage() {
  const { data: events, isLoading } = useEventEvaluationSummaries()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Evaluations</h1>
        <p className="text-sm text-muted-foreground">
          Every event gets evaluated: team leaders rate their volunteers, and booth leaders rate the
          volunteers in their booth.
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
              title="No events to evaluate yet"
              description="Create an event and add participants — then evaluations happen here."
              icon={ClipboardCheck}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map((event) => {
            const coverage =
              event.participantCount > 0
                ? Math.min(100, Math.round((event.evaluationCount / event.participantCount) * 100))
                : 0
            return (
              <Card key={event.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-52">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{event.name}</p>
                      <Badge variant="secondary">{EVENT_STATUS_LABELS[event.status]}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
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
                      {event.avgPerformance != null && (
                        <span className="inline-flex items-center gap-1">
                          <Star className="size-3 fill-amber-400 text-amber-400" />
                          {event.avgPerformance}/5 avg
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-40">
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                        <span>Evaluated</span>
                        <span>
                          {event.evaluationCount}/{event.participantCount}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${coverage}%` }}
                        />
                      </div>
                    </div>
                    <Button render={<Link to={`/events/${event.id}`} />}>
                      <ClipboardCheck className="size-4" />
                      Evaluate
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
