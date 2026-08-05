import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft, CalendarRange, CheckCircle2, LifeBuoy, Star, UserRoundCheck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { EmptyState } from "@/components/shared/empty-state"
import { useAuth } from "@/features/auth/auth-context"
import { useDepartmentDetail } from "@/features/departments/use-department-details"
import {
  MONTHLY_CRITERIA,
  MONTH_NAMES,
  monthlyAverage,
  useMonthlyTargets,
  useSaveMonthlyEvaluation,
  type MonthlyCriterionKey,
  type MonthlyTarget,
} from "./use-monthly-evaluations"
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

interface Draft {
  ratings: Record<MonthlyCriterionKey, number | null>
  strengths: string
  areasToImprove: string
  notes: string
  futureLeader: boolean
  needsFollowUp: boolean
}

const EMPTY_DRAFT: Draft = {
  ratings: {
    commitment_rating: null,
    quality_rating: null,
    communication_rating: null,
    teamwork_rating: null,
    initiative_rating: null,
  },
  strengths: "",
  areasToImprove: "",
  notes: "",
  futureLeader: false,
  needsFollowUp: false,
}

function draftFrom(target: MonthlyTarget | null): Draft {
  const evaluation = target?.evaluation
  if (!evaluation) return EMPTY_DRAFT
  return {
    ratings: {
      commitment_rating: evaluation.commitment_rating,
      quality_rating: evaluation.quality_rating,
      communication_rating: evaluation.communication_rating,
      teamwork_rating: evaluation.teamwork_rating,
      initiative_rating: evaluation.initiative_rating,
    },
    strengths: evaluation.strengths ?? "",
    areasToImprove: evaluation.areas_to_improve ?? "",
    notes: evaluation.leader_notes ?? "",
    futureLeader: evaluation.future_leader_potential ?? false,
    needsFollowUp: evaluation.needs_follow_up ?? false,
  }
}

export function MonthlyEvaluationPage() {
  const { id: departmentId } = useParams()
  const { profile } = useAuth()
  const isReviewer = profile?.role === "super_admin" || profile?.role === "admin"

  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const { data: department } = useDepartmentDetail(departmentId)
  const { data: targets = [], isLoading } = useMonthlyTargets(
    departmentId,
    month,
    year,
    profile?.id,
    isReviewer
  )
  const saveEvaluation = useSaveMonthlyEvaluation()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [notesError, setNotesError] = useState<string | null>(null)

  const selected = targets.find((t) => t.volunteerId === selectedId) ?? null

  useEffect(() => {
    if (!targets.length) return
    if (selectedId && targets.some((t) => t.volunteerId === selectedId)) return
    const next = isReviewer ? targets[0] : (targets.find((t) => !t.evaluation) ?? targets[0])
    setSelectedId(next.volunteerId)
  }, [targets, selectedId, isReviewer])

  useEffect(() => {
    setDraft(draftFrom(selected))
    setNotesError(null)
  }, [selected])

  const years = useMemo(() => {
    const current = now.getFullYear()
    return [current - 2, current - 1, current, current + 1]
  }, [now])

  const doneCount = targets.filter((t) => t.evaluation).length

  async function handleSave() {
    if (!selected || !profile || !departmentId) return
    if (!draft.notes.trim()) {
      setNotesError("A note is required — write a short comment about this volunteer.")
      return
    }

    const average = monthlyAverage(draft.ratings)

    try {
      await saveEvaluation.mutateAsync({
        id: selected.evaluation?.id,
        volunteer_id: selected.volunteerId,
        department_id: departmentId,
        month,
        year,
        evaluated_by: profile.id,
        commitment_rating: draft.ratings.commitment_rating,
        quality_rating: draft.ratings.quality_rating,
        communication_rating: draft.ratings.communication_rating,
        teamwork_rating: draft.ratings.teamwork_rating,
        initiative_rating: draft.ratings.initiative_rating,
        overall_rating: average != null ? Math.round(average) : null,
        strengths: draft.strengths || null,
        areas_to_improve: draft.areasToImprove || null,
        leader_notes: draft.notes.trim(),
        future_leader_potential: draft.futureLeader,
        needs_follow_up: draft.needsFollowUp,
      })
      toast.success(`Saved ${MONTH_NAMES[month - 1]} evaluation for ${selected.fullName}`)

      const remaining = targets.filter(
        (t) => t.volunteerId !== selected.volunteerId && !t.evaluation
      )
      if (remaining.length && !isReviewer) setSelectedId(remaining[0].volunteerId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save evaluation")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" render={<Link to={`/departments/${departmentId}`} />}>
          <ArrowLeft className="size-4" />
          Back to team
        </Button>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Monthly evaluation
          </h1>
          <p className="text-sm text-muted-foreground">
            {department?.department.name ?? "Team"} · {doneCount} of {targets.length} evaluated
            {isReviewer && " · you're reviewing what the leaders submitted"}
          </p>
        </div>

        <div className="flex gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v ?? month))}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((name, index) => (
                <SelectItem key={name} value={String(index + 1)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(year)} onValueChange={(v) => setYear(Number(v ?? year))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : targets.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              title="No volunteers in this team"
              description="Add volunteers to the team first."
              icon={CalendarRange}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">
                {MONTH_NAMES[month - 1]} {year}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex max-h-[32rem] flex-col gap-1 overflow-y-auto p-2">
              {targets.map((target) => {
                const average = target.evaluation ? monthlyAverage(target.evaluation) : null
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
                      <p
                        className={cn(
                          "truncate text-xs",
                          active ? "text-primary-foreground/70" : "text-muted-foreground"
                        )}
                      >
                        {target.evaluation
                          ? target.evaluatedByName
                            ? `by ${target.evaluatedByName}`
                            : "Evaluated"
                          : "Not evaluated"}
                      </p>
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
                    <CardTitle className="text-lg">{selected.fullName}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {MONTH_NAMES[month - 1]} {year}
                    </p>
                  </div>
                </div>
                {selected.evaluation && (
                  <Badge
                    className={
                      selected.evaluatedByName
                        ? "gap-1 bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
                        : "gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                    }
                  >
                    <CheckCircle2 className="size-3" />
                    {selected.evaluatedByName
                      ? `Evaluated by ${selected.evaluatedByName}`
                      : "Already evaluated"}
                  </Badge>
                )}
              </CardHeader>

              <CardContent className="flex flex-col gap-6">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  {MONTHLY_CRITERIA.map((criterion) => (
                    <Field key={criterion.key}>
                      <FieldLabel>{criterion.label}</FieldLabel>
                      <StarPicker
                        value={draft.ratings[criterion.key]}
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

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="me-strengths">Strengths</FieldLabel>
                    <Textarea
                      id="me-strengths"
                      rows={3}
                      value={draft.strengths}
                      onChange={(e) => setDraft((prev) => ({ ...prev, strengths: e.target.value }))}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="me-improve">Areas to improve</FieldLabel>
                    <Textarea
                      id="me-improve"
                      rows={3}
                      value={draft.areasToImprove}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, areasToImprove: e.target.value }))
                      }
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors",
                      draft.futureLeader
                        ? "border-primary/50 bg-primary/5"
                        : "border-border hover:bg-accent/40"
                    )}
                  >
                    <Checkbox
                      checked={draft.futureLeader}
                      onCheckedChange={(value) =>
                        setDraft((prev) => ({ ...prev, futureLeader: !!value }))
                      }
                    />
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        <UserRoundCheck className="size-3.5" />
                        Future leader potential
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Ready to take on more responsibility
                      </p>
                    </div>
                  </label>

                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors",
                      draft.needsFollowUp
                        ? "border-amber-400/60 bg-amber-50 dark:bg-amber-500/10"
                        : "border-border hover:bg-accent/40"
                    )}
                  >
                    <Checkbox
                      checked={draft.needsFollowUp}
                      onCheckedChange={(value) =>
                        setDraft((prev) => ({ ...prev, needsFollowUp: !!value }))
                      }
                    />
                    <div>
                      <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        <LifeBuoy className="size-3.5" />
                        Needs follow-up
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Would benefit from extra guidance and support
                      </p>
                    </div>
                  </label>
                </div>

                <Field data-invalid={!!notesError}>
                  <FieldLabel htmlFor="me-notes">Note *</FieldLabel>
                  <Textarea
                    id="me-notes"
                    rows={4}
                    placeholder="How was this month for them…"
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
                      : selected.evaluatedByName
                        ? "Save correction"
                        : selected.evaluation
                          ? "Update evaluation"
                          : "Save evaluation"}
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
