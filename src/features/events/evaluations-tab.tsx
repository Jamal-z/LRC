import { useState } from "react"
import { Link } from "react-router-dom"
import { ClipboardCheck, Sparkles, Star, LifeBuoy, UserRoundCheck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { EmptyState } from "@/components/shared/empty-state"
import { useAuth } from "@/features/auth/auth-context"
import {
  useEventLeaders,
  useLeaderEvaluations,
  useSaveLeaderEvaluation,
  type EventEvalWithDetails,
  type ParticipantWithDetails,
} from "./use-events"
import { PHASES, evaluationAverage } from "@/features/evaluations/use-evaluations"
import { cn } from "@/lib/utils"

function StarRating({
  value,
  onChange,
}: {
  value: number | null
  onChange: (value: number) => void
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button" onClick={() => onChange(star)} aria-label={`${star} stars`}>
          <Star
            className={cn(
              "size-6 transition-colors",
              value != null && star <= value
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/40 hover:text-amber-300"
            )}
          />
        </button>
      ))}
    </div>
  )
}

/** Only averages the criteria the row's own phase actually fills in. */
function volunteerAverage(evaluation: EventEvalWithDetails) {
  const average = evaluationAverage(evaluation)
  return average == null ? null : average.toFixed(1)
}

/**
 * Read-only overview of an event's evaluations, plus the committee's own
 * evaluation of the leaders. Scoring volunteers happens on the dedicated
 * Evaluations pages so it gets a full screen.
 */
export function EvaluationsTab({
  eventId,
  participants,
  evaluations,
}: {
  eventId: string
  participants: ParticipantWithDetails[]
  evaluations: EventEvalWithDetails[]
}) {
  const { profile } = useAuth()
  const isAdmin = profile?.role === "super_admin" || profile?.role === "admin"

  const { data: eventLeaders = [] } = useEventLeaders(isAdmin ? eventId : undefined)
  const { data: leaderEvaluations = [] } = useLeaderEvaluations(isAdmin ? eventId : undefined)
  const saveLeaderEvaluation = useSaveLeaderEvaluation()

  const [leaderDialogOpen, setLeaderDialogOpen] = useState(false)
  const [leaderTarget, setLeaderTarget] = useState<{
    user_id: string
    full_name: string
    role_label: string
  } | null>(null)
  const [leaderExistingId, setLeaderExistingId] = useState<string | undefined>()
  const [leadership, setLeadership] = useState<number | null>(null)
  const [organization, setOrganization] = useState<number | null>(null)
  const [leaderCommunication, setLeaderCommunication] = useState<number | null>(null)
  const [leaderOverall, setLeaderOverall] = useState<number | null>(null)
  const [leaderNotes, setLeaderNotes] = useState("")

  function openEvaluateLeader(leader: { user_id: string; full_name: string; role_label: string }) {
    const existing = leaderEvaluations.find(
      (ev) => ev.leader_user_id === leader.user_id && ev.evaluated_by === profile?.id
    )
    setLeaderTarget(leader)
    setLeaderExistingId(existing?.id)
    setLeadership(existing?.leadership_rating ?? null)
    setOrganization(existing?.organization_rating ?? null)
    setLeaderCommunication(existing?.communication_rating ?? null)
    setLeaderOverall(existing?.overall_rating ?? null)
    setLeaderNotes(existing?.notes ?? "")
    setLeaderDialogOpen(true)
  }

  async function handleSaveLeaderEvaluation() {
    if (!leaderTarget || !profile) return
    try {
      await saveLeaderEvaluation.mutateAsync({
        evaluation: {
          id: leaderExistingId,
          event_id: eventId,
          leader_user_id: leaderTarget.user_id,
          evaluated_by: profile.id,
          leadership_rating: leadership,
          organization_rating: organization,
          communication_rating: leaderCommunication,
          overall_rating: leaderOverall,
          notes: leaderNotes || null,
        },
      })
      toast.success("Leader evaluation saved")
      setLeaderDialogOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save evaluation")
    }
  }

  const totalShifts = evaluations.reduce((sum, ev) => sum + (ev.shifts_count ?? 0), 0)
  // booths file one row per phase, so counting rows would overstate the progress
  const evaluatedVolunteers = new Set(evaluations.map((ev) => ev.volunteer_id)).size

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Volunteer evaluations</p>
            <p className="text-sm text-muted-foreground">
              {evaluatedVolunteers} of {participants.length} evaluated · {totalShifts} shifts
              recorded
            </p>
          </div>
          <Button render={<Link to={`/evaluations/${eventId}`} />}>
            <ClipboardCheck className="size-4" />
            Open evaluation page
          </Button>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Evaluate leaders (committee)</CardTitle>
            <p className="text-xs text-muted-foreground">
              Department leaders of participating teams + booth leaders of this event
            </p>
          </CardHeader>
          <CardContent>
            {eventLeaders.length === 0 ? (
              <EmptyState
                title="No leaders linked to this event yet"
                description="Assign booth leaders or add participating departments that have leaders."
              />
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {eventLeaders.map((leader) => {
                  const myEval = leaderEvaluations.find(
                    (ev) => ev.leader_user_id === leader.user_id && ev.evaluated_by === profile?.id
                  )
                  return (
                    <div
                      key={leader.user_id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{leader.full_name}</p>
                        <p className="text-xs text-muted-foreground">{leader.role_label}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {myEval && (
                          <Badge variant="secondary" className="gap-1">
                            <Star className="size-3 fill-amber-400 text-amber-400" />
                            {myEval.overall_rating ?? "—"}
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant={myEval ? "outline" : "default"}
                          onClick={() => openEvaluateLeader(leader)}
                        >
                          {myEval ? "Edit evaluation" : "Evaluate leader"}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            All volunteer evaluations ({evaluations.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {evaluations.length === 0 ? (
            <EmptyState
              title="No evaluations yet"
              description="Evaluations submitted by booth and team leaders appear here."
              icon={Star}
            />
          ) : (
            <ul className="divide-y divide-border">
              {evaluations.map((evaluation) => (
                <li key={evaluation.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      <Link
                        to={`/volunteers/${evaluation.volunteer_id}`}
                        className="hover:underline"
                      >
                        {evaluation.volunteers?.full_name}
                      </Link>
                      {evaluation.event_booths && (
                        <span className="text-muted-foreground">
                          {" "}
                          · {evaluation.event_booths.name}
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-2">
                      {evaluation.booth_id && (
                        <Badge variant="outline" className="text-xs">
                          {PHASES.find((p) => p.key === evaluation.phase)?.label ?? evaluation.phase}
                        </Badge>
                      )}
                      {evaluation.phase !== "preparation" && (
                        <Badge variant="outline" className="text-xs">
                          {evaluation.shifts_count ?? 0} shifts
                        </Badge>
                      )}
                      {volunteerAverage(evaluation) && (
                        <Badge variant="secondary" className="gap-1">
                          <Star className="size-3 fill-amber-400 text-amber-400" />
                          {volunteerAverage(evaluation)}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        by {evaluation.profiles?.full_name ?? "—"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {evaluation.potential_future_booth_leader && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <UserRoundCheck className="size-3" />
                        Potential booth leader
                      </Badge>
                    )}
                    {evaluation.is_talented && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Sparkles className="size-3" />
                        Talented
                      </Badge>
                    )}
                    {evaluation.needs_follow_up && (
                      <Badge className="gap-1 bg-amber-100 text-xs text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                        <LifeBuoy className="size-3" />
                        Needs follow-up
                      </Badge>
                    )}
                  </div>

                  {evaluation.notes && (
                    <p className="mt-1.5 text-sm text-muted-foreground">{evaluation.notes}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Leader evaluation dialog (committee) */}
      <Dialog open={leaderDialogOpen} onOpenChange={setLeaderDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Evaluate {leaderTarget?.full_name}</DialogTitle>
            <DialogDescription>{leaderTarget?.role_label} · rate from 1 to 5 stars.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <Field>
              <FieldLabel>Leadership</FieldLabel>
              <StarRating value={leadership} onChange={setLeadership} />
            </Field>
            <Field>
              <FieldLabel>Organization</FieldLabel>
              <StarRating value={organization} onChange={setOrganization} />
            </Field>
            <Field>
              <FieldLabel>Communication</FieldLabel>
              <StarRating value={leaderCommunication} onChange={setLeaderCommunication} />
            </Field>
            <Field>
              <FieldLabel>Overall</FieldLabel>
              <StarRating value={leaderOverall} onChange={setLeaderOverall} />
            </Field>
            <Field>
              <FieldLabel htmlFor="lev-notes">Notes</FieldLabel>
              <Textarea
                id="lev-notes"
                rows={3}
                value={leaderNotes}
                onChange={(e) => setLeaderNotes(e.target.value)}
              />
            </Field>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setLeaderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveLeaderEvaluation} disabled={saveLeaderEvaluation.isPending}>
              {saveLeaderEvaluation.isPending ? "Saving…" : "Save evaluation"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
