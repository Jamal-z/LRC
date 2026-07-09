import { useState } from "react"
import { Star } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
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
  useSaveEventEvaluation,
  useSaveLeaderEvaluation,
  type EventEvalWithDetails,
  type ParticipantWithDetails,
} from "./use-events"
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
              "size-5 transition-colors",
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

function ReadRating({ label, value }: { label: string; value: number | null }) {
  return (
    <span className="text-sm">
      {label}:{" "}
      {value != null ? (
        <span className="inline-flex items-center gap-0.5 font-medium">
          <Star className="size-3 fill-amber-400 text-amber-400" />
          {value}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </span>
  )
}

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
  const saveEvaluation = useSaveEventEvaluation()
  const isAdmin = profile?.role === "super_admin" || profile?.role === "admin"

  // leaders section (admin committee evaluates the leaders themselves)
  const { data: eventLeaders = [] } = useEventLeaders(isAdmin ? eventId : undefined)
  const { data: leaderEvaluations = [] } = useLeaderEvaluations(isAdmin ? eventId : undefined)
  const saveLeaderEvaluation = useSaveLeaderEvaluation()

  const [leaderDialogOpen, setLeaderDialogOpen] = useState(false)
  const [leaderTarget, setLeaderTarget] = useState<{ user_id: string; full_name: string; role_label: string } | null>(null)
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

  const [dialogOpen, setDialogOpen] = useState(false)
  const [target, setTarget] = useState<ParticipantWithDetails | null>(null)
  const [existingId, setExistingId] = useState<string | undefined>()
  const [performance, setPerformance] = useState<number | null>(null)
  const [commitment, setCommitment] = useState<number | null>(null)
  const [teamwork, setTeamwork] = useState<number | null>(null)
  const [communication, setCommunication] = useState<number | null>(null)
  const [notes, setNotes] = useState("")
  const [recommend, setRecommend] = useState(false)
  const [futureLeader, setFutureLeader] = useState(false)

  function openEvaluate(participant: ParticipantWithDetails) {
    const existing = evaluations.find(
      (ev) => ev.volunteer_id === participant.volunteer_id && ev.evaluated_by === profile?.id
    )
    setTarget(participant)
    setExistingId(existing?.id)
    setPerformance(existing?.performance_rating ?? null)
    setCommitment(existing?.commitment_rating ?? null)
    setTeamwork(existing?.teamwork_rating ?? null)
    setCommunication(existing?.communication_rating ?? null)
    setNotes(existing?.notes ?? "")
    setRecommend(existing?.recommend_for_future_events ?? false)
    setFutureLeader(existing?.potential_future_booth_leader ?? false)
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!target || !profile) return
    try {
      await saveEvaluation.mutateAsync({
        evaluation: {
          id: existingId,
          volunteer_id: target.volunteer_id,
          booth_id: target.booth_id,
          evaluated_by: profile.id,
          performance_rating: performance,
          commitment_rating: commitment,
          teamwork_rating: teamwork,
          communication_rating: communication,
          notes: notes || null,
          recommend_for_future_events: recommend,
          potential_future_booth_leader: futureLeader,
        },
        eventId,
      })
      toast.success("Evaluation saved")
      setDialogOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save evaluation")
    }
  }

  const avgOf = (values: (number | null)[]) => {
    const nums = values.filter((v): v is number => v != null)
    return nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : "—"
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">Evaluate participants</h3>
            <p className="text-xs text-muted-foreground">
              Average performance: {avgOf(evaluations.map((e) => e.performance_rating))} / 5
            </p>
          </div>
          {participants.length === 0 ? (
            <EmptyState
              title="No participants to evaluate"
              description="Add participants first from the Participants tab."
            />
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {participants.map((participant) => {
                const myEval = evaluations.find(
                  (ev) =>
                    ev.volunteer_id === participant.volunteer_id && ev.evaluated_by === profile?.id
                )
                return (
                  <div
                    key={participant.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {participant.volunteers?.full_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {participant.event_booths?.name ?? "No booth"}
                        {participant.departments ? ` · ${participant.departments.name}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {myEval && (
                        <Badge variant="secondary" className="gap-1">
                          <Star className="size-3 fill-amber-400 text-amber-400" />
                          {myEval.performance_rating ?? "—"}
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant={myEval ? "outline" : "default"}
                        onClick={() => openEvaluate(participant)}
                      >
                        {myEval ? "Edit evaluation" : "Evaluate"}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardContent>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Evaluate leaders (admin committee)
              </h3>
              <p className="text-xs text-muted-foreground">
                Department leaders of participating teams + booth leaders of this event
              </p>
            </div>
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
        <CardContent>
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            All evaluations ({evaluations.length})
          </h3>
          {evaluations.length === 0 ? (
            <EmptyState
              title="No evaluations yet"
              description="Evaluations submitted by booth/department leaders and admins appear here."
              icon={Star}
            />
          ) : (
            <ul className="divide-y divide-border">
              {evaluations.map((evaluation) => (
                <li key={evaluation.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {evaluation.volunteers?.full_name}
                      {evaluation.event_booths && (
                        <span className="text-muted-foreground"> · {evaluation.event_booths.name}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      by {evaluation.profiles?.full_name ?? "—"}
                    </p>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <ReadRating label="Performance" value={evaluation.performance_rating} />
                    <ReadRating label="Commitment" value={evaluation.commitment_rating} />
                    <ReadRating label="Teamwork" value={evaluation.teamwork_rating} />
                    <ReadRating label="Communication" value={evaluation.communication_rating} />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {evaluation.recommend_for_future_events && (
                      <Badge variant="secondary" className="text-xs">Recommend for future events</Badge>
                    )}
                    {evaluation.potential_future_booth_leader && (
                      <Badge variant="secondary" className="text-xs">Potential booth leader</Badge>
                    )}
                  </div>
                  {evaluation.notes && (
                    <p className="mt-1 text-sm text-muted-foreground">{evaluation.notes}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Evaluate {target?.volunteers?.full_name}</DialogTitle>
            <DialogDescription>
              {target?.event_booths?.name ?? "No booth"} · rate from 1 to 5 stars.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3">
              <Field>
                <FieldLabel>Performance</FieldLabel>
                <StarRating value={performance} onChange={setPerformance} />
              </Field>
              <Field>
                <FieldLabel>Commitment</FieldLabel>
                <StarRating value={commitment} onChange={setCommitment} />
              </Field>
              <Field>
                <FieldLabel>Teamwork</FieldLabel>
                <StarRating value={teamwork} onChange={setTeamwork} />
              </Field>
              <Field>
                <FieldLabel>Communication</FieldLabel>
                <StarRating value={communication} onChange={setCommunication} />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="ev-notes">Notes</FieldLabel>
              <Textarea id="ev-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={recommend} onCheckedChange={(c) => setRecommend(!!c)} />
              Would recommend for future events
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={futureLeader} onCheckedChange={(c) => setFutureLeader(!!c)} />
              Potential future booth leader
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saveEvaluation.isPending}>
              {saveEvaluation.isPending ? "Saving…" : "Save evaluation"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Leader evaluation dialog (admin committee) */}
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
