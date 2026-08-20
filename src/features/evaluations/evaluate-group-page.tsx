import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft, CheckCircle2, Sparkles, Star, UserRoundCheck, LifeBuoy } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { EmptyState } from "@/components/shared/empty-state"
import { useAuth } from "@/features/auth/auth-context"
import {
  EVALUATION_FLAGS,
  PHASES,
  criteriaFor,
  evaluationAverage,
  useEvaluationTargets,
  useSaveEvaluation,
  type FlagKey,
  type PhaseEntry,
  type RatingKey,
} from "./use-evaluations"
import type { EvaluationPhase } from "@/types/database.types"
import { cn } from "@/lib/utils"

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
}

function StarPicker({
  value,
  onChange,
}: {
  value: number | null
  onChange: (value: number) => void
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          aria-label={`${star} out of 5`}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={cn(
              "size-7",
              value != null && star <= value
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/35 hover:text-amber-300"
            )}
          />
        </button>
      ))}
    </div>
  )
}

const FLAG_ICONS: Record<FlagKey, typeof Sparkles> = {
  potential_future_booth_leader: UserRoundCheck,
  is_talented: Sparkles,
  needs_follow_up: LifeBuoy,
}

interface DraftState {
  /** only the keys belonging to the active phase are ever populated */
  ratings: Partial<Record<RatingKey, number | null>>
  shifts: string
  notes: string
  flags: Record<FlagKey, boolean>
}

const EMPTY_DRAFT: DraftState = {
  ratings: {},
  shifts: "0",
  notes: "",
  flags: {
    potential_future_booth_leader: false,
    is_talented: false,
    needs_follow_up: false,
  },
}

function draftFrom(
  entry: PhaseEntry | null,
  phase: EvaluationPhase,
  isDepartment: boolean
): DraftState {
  const evaluation = entry?.evaluation
  if (!evaluation) return EMPTY_DRAFT

  const ratings: Partial<Record<RatingKey, number | null>> = {}
  for (const criterion of criteriaFor(phase, isDepartment)) {
    ratings[criterion.key] = evaluation[criterion.key] ?? null
  }

  return {
    ratings,
    shifts: String(evaluation.shifts_count ?? 0),
    notes: evaluation.notes ?? "",
    flags: {
      potential_future_booth_leader: evaluation.potential_future_booth_leader ?? false,
      is_talented: evaluation.is_talented ?? false,
      needs_follow_up: evaluation.needs_follow_up ?? false,
    },
  }
}

export function EvaluateGroupPage() {
  const { eventId, groupType, groupId } = useParams()
  const { profile } = useAuth()
  const type = groupType === "department" ? "department" : "booth"
  // The committee reviews (and may correct) what leaders submitted rather than
  // filling in blank forms of their own.
  const isReviewer = profile?.role === "super_admin" || profile?.role === "admin"
  const { data, isLoading } = useEvaluationTargets(eventId, type, groupId, profile?.id, isReviewer)
  const saveEvaluation = useSaveEvaluation()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  // teams are evaluated once, after the event — only booths run two phases
  const [phase, setPhase] = useState<EvaluationPhase>("preparation")
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT)
  const [notesError, setNotesError] = useState<string | null>(null)

  const isPhased = type === "booth"
  const isDepartment = type === "department"
  const activePhase: EvaluationPhase = isPhased ? phase : "post_event"
  const phaseConfig = PHASES.find((p) => p.key === activePhase)!
  const activeCriteria = criteriaFor(activePhase, isDepartment)

  const targets = useMemo(() => data?.targets ?? [], [data?.targets])
  const selected = targets.find((t) => t.volunteerId === selectedId) ?? null
  const selectedEntry = selected?.phases[activePhase] ?? null

  // leaders jump to the first unscored volunteer; reviewers start at the top
  useEffect(() => {
    if (selectedId || !targets.length) return
    const next = isReviewer
      ? targets[0]
      : (targets.find((t) => !t.phases[activePhase].evaluation) ?? targets[0])
    setSelectedId(next.volunteerId)
  }, [targets, selectedId, isReviewer, activePhase])

  // reload the form whenever the volunteer OR the phase changes
  useEffect(() => {
    setDraft(draftFrom(selectedEntry, activePhase, isDepartment))
    setNotesError(null)
  }, [selectedEntry, activePhase, isDepartment])

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  async function handleSave() {
    if (!selected || !profile || !eventId) return

    if (!draft.notes.trim()) {
      setNotesError("A note is required — write a short comment about this volunteer.")
      return
    }

    // Only send the columns this phase owns; the other phase's columns stay
    // untouched on their own row instead of being overwritten with nulls.
    const ratings = activeCriteria.reduce<Record<string, number | null>>(
      (acc, criterion) => {
        acc[criterion.key] = draft.ratings[criterion.key] ?? null
        return acc
      },
      {}
    )

    try {
      await saveEvaluation.mutateAsync({
        id: selectedEntry?.evaluation?.id,
        event_id: eventId,
        booth_id: type === "booth" ? groupId! : null,
        department_id: type === "department" ? groupId! : null,
        volunteer_id: selected.volunteerId,
        evaluated_by: profile.id,
        phase: activePhase,
        meeting_attendance_rating: null,
        task_completion_rating: null,
        performance_rating: null,
        teamwork_rating: null,
        communication_rating: null,
        attitude_rating: null,
        commitment_rating: null,
        ...ratings,
        shifts_count: phaseConfig.hasShifts ? Number(draft.shifts) || 0 : 0,
        notes: draft.notes.trim(),
        potential_future_booth_leader: phaseConfig.hasFlags
          ? draft.flags.potential_future_booth_leader
          : false,
        is_talented: phaseConfig.hasFlags ? draft.flags.is_talented : false,
        needs_follow_up: phaseConfig.hasFlags ? draft.flags.needs_follow_up : false,
      })
      toast.success(
        isPhased
          ? `Saved ${phaseConfig.label.toLowerCase()} evaluation for ${selected.fullName}`
          : `Saved evaluation for ${selected.fullName}`
      )

      // jump to the next volunteer missing THIS phase to keep the flow going
      const remaining = targets.filter(
        (t) => t.volunteerId !== selected.volunteerId && !t.phases[activePhase].evaluation
      )
      if (remaining.length) setSelectedId(remaining[0].volunteerId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save evaluation")
    }
  }

  const doneCount = targets.filter((t) => t.phases[activePhase].evaluation).length

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" render={<Link to={`/evaluations/${eventId}`} />}>
          <ArrowLeft className="size-4" />
          Back to booths & teams
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {data.group.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {doneCount} of {targets.length} volunteers evaluated
            {isPhased && ` in ${phaseConfig.label.toLowerCase()}`}
            {isReviewer && " · you're reviewing what the leaders submitted"}
          </p>
        </div>
      </div>

      {isPhased && (
        <div className="flex w-full gap-1 rounded-xl border border-border bg-muted/40 p-1 sm:w-fit">
          {PHASES.map((option) => {
            const active = option.key === activePhase
            const filled = targets.filter((t) => t.phases[option.key].evaluation).length
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setPhase(option.key)}
                className={cn(
                  "flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-none",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {option.label}{" "}
                <span className="text-xs font-normal opacity-70">({option.parenthetical})</span>
                <span
                  className={cn(
                    "ml-2 rounded-full px-1.5 py-0.5 text-xs tabular-nums",
                    active ? "bg-accent text-accent-foreground" : "bg-transparent"
                  )}
                >
                  {filled}/{targets.length}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {targets.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              title="No volunteers here yet"
              description="Add volunteers to this booth or team first."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr]">
          {/* volunteer list */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">Volunteers</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 p-2">
              {targets.map((target) => {
                const entry = target.phases[activePhase]
                const average = entry.evaluation ? evaluationAverage(entry.evaluation) : null
                const active = target.volunteerId === selectedId

                return (
                  <button
                    key={target.volunteerId}
                    type="button"
                    onClick={() => setSelectedId(target.volunteerId)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors",
                      active ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                    )}
                  >
                    <Avatar className="size-9">
                      {target.photoUrl && <AvatarImage src={target.photoUrl} />}
                      <AvatarFallback
                        className={cn(
                          "text-xs",
                          active
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-accent text-accent-foreground"
                        )}
                      >
                        {initials(target.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{target.fullName}</p>
                      {isPhased ? (
                        // both phases at a glance, so a leader can see what is still missing
                        <div className="mt-0.5 flex items-center gap-1">
                          {PHASES.map((option) => {
                            const filled = !!target.phases[option.key].evaluation
                            return (
                              <span
                                key={option.key}
                                className={cn(
                                  "rounded px-1 py-0.5 text-[10px] font-medium leading-none",
                                  active
                                    ? filled
                                      ? "bg-primary-foreground/25 text-primary-foreground"
                                      : "text-primary-foreground/60"
                                    : filled
                                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                                      : "text-muted-foreground"
                                )}
                              >
                                {option.shortLabel} {filled ? "✓" : "—"}
                              </span>
                            )
                          })}
                        </div>
                      ) : (
                        <p
                          className={cn(
                            "truncate text-xs",
                            active ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}
                        >
                          {entry.evaluation
                            ? `${entry.evaluation.shifts_count} shifts${
                                entry.evaluatedByName ? ` · by ${entry.evaluatedByName}` : ""
                              }`
                            : "Not evaluated"}
                        </p>
                      )}
                    </div>
                    {average != null ? (
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center gap-0.5 text-xs font-medium",
                          active ? "text-primary-foreground" : "text-foreground"
                        )}
                      >
                        <Star className="size-3 fill-amber-400 text-amber-400" />
                        {average.toFixed(1)}
                      </span>
                    ) : (
                      <span className="size-2 shrink-0 rounded-full bg-amber-400" />
                    )}
                  </button>
                )
              })}
            </CardContent>
          </Card>

          {/* evaluation form */}
          {selected && (
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar className="size-12">
                    {selected.photoUrl && <AvatarImage src={selected.photoUrl} />}
                    <AvatarFallback className="bg-accent text-accent-foreground">
                      {initials(selected.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">
                      <Link
                        to={`/volunteers/${selected.volunteerId}`}
                        className="hover:underline"
                        title="Open profile"
                      >
                        {selected.fullName}
                      </Link>
                    </CardTitle>
                    {selected.roleDescription && (
                      <p className="text-sm text-muted-foreground">{selected.roleDescription}</p>
                    )}
                  </div>
                </div>
                {selectedEntry?.evaluation ? (
                  selectedEntry.evaluatedByName ? (
                    <Badge className="gap-1 bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                      <CheckCircle2 className="size-3" />
                      Evaluated by {selectedEntry.evaluatedByName}
                    </Badge>
                  ) : (
                    <Badge className="gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                      <CheckCircle2 className="size-3" />
                      Already evaluated
                    </Badge>
                  )
                ) : (
                  isReviewer && (
                    <Badge className="gap-1 bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                      Not evaluated yet
                    </Badge>
                  )
                )}
              </CardHeader>

              <CardContent className="flex flex-col gap-6">
                {/* shifts — post-event only, there is nothing to count beforehand */}
                {phaseConfig.hasShifts && (
                <Field>
                  <FieldLabel htmlFor="ev-shifts">Shifts covered in this event</FieldLabel>
                  <Input
                    id="ev-shifts"
                    type="number"
                    min={0}
                    className="h-11 w-32 text-lg font-semibold"
                    value={draft.shifts}
                    onChange={(e) => setDraft((prev) => ({ ...prev, shifts: e.target.value }))}
                  />
                  <FieldDescription>
                    How many shifts they actually covered — counted, not rated.
                  </FieldDescription>
                </Field>
                )}

                {/* ratings */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  {activeCriteria.map((criterion) => (
                    <Field key={criterion.key}>
                      <FieldLabel>{criterion.label}</FieldLabel>
                      <StarPicker
                        value={draft.ratings[criterion.key] ?? null}
                        onChange={(value) =>
                          setDraft((prev) => ({
                            ...prev,
                            ratings: { ...prev.ratings, [criterion.key]: value },
                          }))
                        }
                      />
                      <FieldDescription>{criterion.hint}</FieldDescription>
                    </Field>
                  ))}
                </div>

                {/* flags — post-event only, these are judgements about the day */}
                {phaseConfig.hasFlags && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {EVALUATION_FLAGS.map((flag) => {
                    const Icon = FLAG_ICONS[flag.key]
                    const checked = draft.flags[flag.key]
                    return (
                      <label
                        key={flag.key}
                        className={cn(
                          "flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors",
                          checked
                            ? flag.tone === "attention"
                              ? "border-amber-400/60 bg-amber-50 dark:bg-amber-500/10"
                              : "border-primary/50 bg-primary/5"
                            : "border-border hover:bg-accent/40"
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            setDraft((prev) => ({
                              ...prev,
                              flags: { ...prev.flags, [flag.key]: !!value },
                            }))
                          }
                        />
                        <div>
                          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                            <Icon className="size-3.5" />
                            {flag.label}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{flag.hint}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
                )}

                {/* notes */}
                <Field data-invalid={!!notesError}>
                  <FieldLabel htmlFor="ev-notes">Note *</FieldLabel>
                  <Textarea
                    id="ev-notes"
                    rows={4}
                    placeholder="What went well, what could be better…"
                    value={draft.notes}
                    onChange={(e) => {
                      setDraft((prev) => ({ ...prev, notes: e.target.value }))
                      if (notesError) setNotesError(null)
                    }}
                  />
                  {notesError ? (
                    <FieldError>{notesError}</FieldError>
                  ) : (
                    <FieldDescription>Required — a short comment for the record.</FieldDescription>
                  )}
                </Field>

                <div className="flex justify-end">
                  <Button size="lg" onClick={handleSave} disabled={saveEvaluation.isPending}>
                    {saveEvaluation.isPending
                      ? "Saving…"
                      : selectedEntry?.evaluatedByName
                        ? "Save correction"
                        : selectedEntry?.evaluation
                          ? `Update ${isPhased ? phaseConfig.label.toLowerCase() : ""} evaluation`.replace(
                              "  ",
                              " "
                            )
                          : `Save ${isPhased ? phaseConfig.label.toLowerCase() : ""} evaluation`.replace(
                              "  ",
                              " "
                            )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
