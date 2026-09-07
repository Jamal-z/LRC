import { useEffect, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import {
  ArrowLeft,
  Award,
  ClipboardList,
  FileText,
  Gauge,
  History,
  NotebookPen,
  Save,
  Sparkles,
  Star,
  UserRound,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { useDepartments } from "@/features/departments/use-departments"
import { useAuth } from "@/features/auth/auth-context"
import { cn } from "@/lib/utils"
import type { InterviewStatus } from "@/types/database.types"
import {
  INTERVIEW_CRITERIA,
  INTERVIEW_STATUS_LABELS,
  interviewAverage,
  useFormApplicant,
  useInterview,
  useSaveInterview,
  type FormApplicant,
  type InterviewWithRelations,
} from "./use-interviews"

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

/** A titled card with a tinted icon chip, so sections are scannable. */
function SectionCard({
  icon: Icon,
  tint,
  title,
  description,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>
  tint: string
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-base">
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", tint)}>
            <Icon className="size-4" />
          </span>
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function StarPicker({
  value,
  onChange,
  count = 5,
  size = "md",
}: {
  value: number | null
  onChange: (value: number | null) => void
  count?: number
  size?: "md" | "lg"
}) {
  const box = size === "lg" ? "size-7" : "size-5.5"
  return (
    <div className="flex flex-wrap items-center gap-0.5">
      {Array.from({ length: count }, (_, i) => i + 1).map((star) => (
        <button
          key={star}
          type="button"
          // clicking the current value again clears it — "we didn't ask this"
          onClick={() => onChange(value === star ? null : star)}
          aria-label={`${star} out of ${count}`}
          className="transition-transform hover:scale-115"
        >
          <Star
            className={cn(
              box,
              value != null && star <= value
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/25 hover:text-amber-300"
            )}
          />
        </button>
      ))}
      {value != null && (
        <span className="ms-2 text-xs font-semibold tabular-nums text-amber-600 dark:text-amber-400">
          {value}/{count}
        </span>
      )}
    </div>
  )
}

function YesNoPicker({
  value,
  onChange,
  yesLabel = "Yes",
  noLabel = "No",
}: {
  value: boolean | null
  onChange: (value: boolean | null) => void
  yesLabel?: string
  noLabel?: string
}) {
  const options: { key: string; label: string; state: boolean | null }[] = [
    { key: "yes", label: yesLabel, state: true },
    { key: "no", label: noLabel, state: false },
    { key: "unknown", label: "Didn't ask", state: null },
  ]
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.state)}
          className={cn(
            "rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-colors",
            value === option.state
              ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400/50 dark:bg-blue-500/15 dark:text-blue-300"
              : "border-border text-muted-foreground hover:bg-accent/50"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Draft state                                                         */
/* ------------------------------------------------------------------ */

interface DraftState {
  full_name: string
  university_id: string
  major: string
  phone: string
  email: string
  city: string
  department_id: string
  applied_for: string
  status: InterviewStatus
  interviewed_at: string
  ratings: Record<string, number>
  criteria_notes: Record<string, string>
  languages: string
  volunteered_before: boolean | null
  previous_volunteering: string
  other_skills: string
  applied_before: boolean | null
  overall_rating: number | null
  strengths: string
  concerns: string
  notes: string
  form_response_id: string | null
}

function emptyDraft(): DraftState {
  return {
    full_name: "",
    university_id: "",
    major: "",
    phone: "",
    email: "",
    city: "",
    department_id: "",
    applied_for: "",
    status: "maybe",
    interviewed_at: new Date().toISOString().slice(0, 10),
    ratings: {},
    criteria_notes: {},
    languages: "",
    volunteered_before: null,
    previous_volunteering: "",
    other_skills: "",
    applied_before: null,
    overall_rating: null,
    strengths: "",
    concerns: "",
    notes: "",
    form_response_id: null,
  }
}

function draftFrom(interview: InterviewWithRelations): DraftState {
  return {
    full_name: interview.full_name,
    university_id: interview.university_id ?? "",
    major: interview.major ?? "",
    phone: interview.phone ?? "",
    email: interview.email ?? "",
    city: interview.city ?? "",
    department_id: interview.department_id ?? "",
    applied_for: interview.applied_for ?? "",
    status: interview.status,
    interviewed_at: interview.interviewed_at,
    ratings: interview.ratings ?? {},
    criteria_notes: interview.criteria_notes ?? {},
    languages: interview.languages ?? "",
    volunteered_before: interview.volunteered_before,
    previous_volunteering: interview.previous_volunteering ?? "",
    other_skills: interview.other_skills ?? "",
    applied_before: interview.applied_before,
    overall_rating: interview.overall_rating,
    strengths: interview.strengths ?? "",
    concerns: interview.concerns ?? "",
    notes: interview.notes ?? "",
    form_response_id: interview.form_response_id,
  }
}

/** Pre-fills a brand-new interview from what the applicant already told us. */
function draftFromApplicant(applicant: FormApplicant): DraftState {
  const m = applicant.mapped
  return {
    ...emptyDraft(),
    full_name: m.full_name ?? "",
    university_id: m.university_id ?? "",
    major: m.major ?? "",
    phone: m.phone ?? "",
    email: m.email ?? "",
    city: m.city ?? "",
    applied_for: applicant.formTitle,
    languages: m.languages ?? "",
    other_skills: m.skills ?? "",
    notes: m.internal_notes ?? "",
    form_response_id: applicant.responseId,
  }
}

const STATUS_DOT: Record<InterviewStatus, string> = {
  accepted: "bg-emerald-500",
  maybe: "bg-amber-500",
  rejected: "bg-red-500",
}

/* ------------------------------------------------------------------ */

export function InterviewPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const fromResponseId = searchParams.get("from") ?? undefined
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { data: departments } = useDepartments()
  const { data: interview, isLoading } = useInterview(id)
  const { data: applicant, isLoading: applicantLoading } = useFormApplicant(
    id ? undefined : fromResponseId
  )
  const saveInterview = useSaveInterview()

  const [draft, setDraft] = useState<DraftState>(emptyDraft)
  const [nameError, setNameError] = useState<string | null>(null)

  useEffect(() => {
    if (interview) setDraft(draftFrom(interview))
  }, [interview])

  useEffect(() => {
    if (!id && applicant) setDraft(draftFromApplicant(applicant))
  }, [id, applicant])

  function set<K extends keyof DraftState>(key: K, value: DraftState[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const average = interviewAverage(draft.ratings)
  const scored = Object.keys(draft.ratings).length

  async function handleSave(closeAfter: boolean) {
    if (!draft.full_name.trim()) {
      setNameError("The candidate's name is required.")
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }

    try {
      const savedId = await saveInterview.mutateAsync({
        id: interview?.id,
        full_name: draft.full_name.trim(),
        university_id: draft.university_id.trim() || null,
        major: draft.major.trim() || null,
        phone: draft.phone.trim() || null,
        email: draft.email.trim() || null,
        city: draft.city.trim() || null,
        department_id: draft.department_id || null,
        applied_for: draft.applied_for.trim() || null,
        ratings: draft.ratings,
        criteria_notes: Object.fromEntries(
          Object.entries(draft.criteria_notes).filter(([, note]) => note.trim())
        ),
        languages: draft.languages.trim() || null,
        volunteered_before: draft.volunteered_before,
        previous_volunteering: draft.previous_volunteering.trim() || null,
        other_skills: draft.other_skills.trim() || null,
        applied_before: draft.applied_before,
        overall_rating: draft.overall_rating,
        form_response_id: draft.form_response_id,
        strengths: draft.strengths.trim() || null,
        concerns: draft.concerns.trim() || null,
        notes: draft.notes.trim() || null,
        status: draft.status,
        // the original interviewer stays on record when someone else edits later
        interviewed_by: interview?.interviewed_by ?? profile?.id ?? null,
        interviewed_at: draft.interviewed_at,
      })
      toast.success(interview ? "Interview updated" : `${draft.full_name.trim()} recorded`)
      if (closeAfter) navigate("/interviews")
      else if (!interview) navigate(`/interviews/${savedId}`, { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save the interview")
    }
  }

  if ((id && isLoading) || (!id && fromResponseId && applicantLoading)) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-[32rem] w-full rounded-2xl" />
      </div>
    )
  }

  const initial = draft.full_name.trim().charAt(0).toUpperCase() || "?"

  return (
    // roomier type than the rest of the app: this page is filled in live while
    // talking to someone, so it has to be easy to scan and type into
    <div className="mx-auto flex max-w-5xl flex-col gap-4 text-[15px] leading-relaxed">
      {/* ---------------- header ---------------- */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-slate-900 shadow-lg shadow-blue-900/20">
        <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/15 text-xl font-semibold text-white ring-1 ring-white/25 backdrop-blur">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-blue-200/80">
                {interview ? "Interview record" : "New interview"}
              </p>
              <h1 className="truncate text-2xl font-semibold tracking-tight text-white">
                {draft.full_name.trim() || "Untitled candidate"}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white ring-1 ring-white/20">
                  <span className={cn("size-1.5 rounded-full", STATUS_DOT[draft.status])} />
                  {INTERVIEW_STATUS_LABELS[draft.status]}
                </span>
                {draft.applied_for && (
                  <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white ring-1 ring-white/20">
                    {draft.applied_for}
                  </span>
                )}
                {draft.overall_rating != null && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/90 px-2.5 py-1 text-xs font-semibold text-amber-950">
                    <Star className="size-3 fill-amber-950" />
                    {draft.overall_rating}/10
                  </span>
                )}
                {interview?.form_response_id && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white ring-1 ring-white/20">
                    <FileText className="size-3" />
                    From a form
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/15 hover:text-white"
              render={<Link to="/interviews" />}
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleSave(false)}
              disabled={saveInterview.isPending}
            >
              <Save className="size-4" />
              Save
            </Button>
            <Button
              className="bg-amber-400 text-amber-950 hover:bg-amber-300"
              onClick={() => handleSave(true)}
              disabled={saveInterview.isPending}
            >
              {saveInterview.isPending ? "Saving…" : "Save & close"}
            </Button>
          </div>
        </div>

        {/* live summary strip */}
        <div className="flex flex-wrap gap-x-8 gap-y-2 border-t border-white/10 bg-slate-950/25 px-5 py-3 sm:px-6">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-blue-200/70">Star average</p>
            <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
              <Star className="size-3.5 fill-amber-400 text-amber-400" />
              {average != null ? `${average.toFixed(1)}/5` : "—"}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-blue-200/70">Criteria scored</p>
            <p className="text-sm font-semibold text-white">
              {scored}/{INTERVIEW_CRITERIA.length}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-blue-200/70">Our verdict</p>
            <p className="text-sm font-semibold text-white">
              {draft.overall_rating != null ? `${draft.overall_rating}/10` : "—"}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-blue-200/70">Interview date</p>
            <p className="text-sm font-semibold text-white">
              {new Date(draft.interviewed_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* ---------------- what they wrote in the form ---------------- */}
      {applicant && !id && (
        <Card className="border-blue-200 bg-blue-50/60 dark:border-blue-500/25 dark:bg-blue-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5 text-base">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                <Sparkles className="size-4" />
              </span>
              Pre-filled from “{applicant.formTitle}”
            </CardTitle>
            <CardDescription>
              Submitted {new Date(applicant.submittedAt).toLocaleDateString()} — their answers are
              below, and the fields are already filled in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {applicant.answers
                .filter((answer) => answer.value)
                .map((answer) => (
                  <div
                    key={answer.label}
                    className="min-w-0 rounded-lg bg-white/70 px-3 py-2 dark:bg-white/5"
                  >
                    <dt className="text-xs font-medium text-muted-foreground">{answer.label}</dt>
                    <dd className="truncate text-sm text-foreground">{answer.value}</dd>
                  </div>
                ))}
            </dl>
          </CardContent>
        </Card>
      )}

      {/* ---------------- candidate details ---------------- */}
      <SectionCard
        icon={UserRound}
        tint="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
        title="Candidate details"
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field className="sm:col-span-2" data-invalid={!!nameError}>
            <FieldLabel htmlFor="i-name">Full name *</FieldLabel>
            <Input
              id="i-name"
              className="h-11 text-base"
              value={draft.full_name}
              onChange={(e) => {
                set("full_name", e.target.value)
                if (nameError) setNameError(null)
              }}
            />
            {nameError && <FieldError>{nameError}</FieldError>}
          </Field>

          <Field>
            <FieldLabel htmlFor="i-phone">WhatsApp number</FieldLabel>
            <Input
              id="i-phone"
              dir="ltr"
              className="h-11"
              value={draft.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="i-email">Email</FieldLabel>
            <Input
              id="i-email"
              type="email"
              dir="ltr"
              className="h-11"
              value={draft.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="i-university-id">University ID</FieldLabel>
            <Input
              id="i-university-id"
              className="h-11"
              value={draft.university_id}
              onChange={(e) => set("university_id", e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="i-major">Major</FieldLabel>
            <Input
              id="i-major"
              className="h-11"
              value={draft.major}
              onChange={(e) => set("major", e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="i-city">City / residence</FieldLabel>
            <Input
              id="i-city"
              className="h-11"
              value={draft.city}
              onChange={(e) => set("city", e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="i-applied-for">Applied for</FieldLabel>
            <Input
              id="i-applied-for"
              className="h-11"
              placeholder="e.g. Arabic teaching"
              value={draft.applied_for}
              onChange={(e) => set("applied_for", e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="i-date">Interview date</FieldLabel>
            <Input
              id="i-date"
              type="date"
              className="h-11"
              value={draft.interviewed_at}
              onChange={(e) => set("interviewed_at", e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel>Team they'd join</FieldLabel>
            <Select
              value={draft.department_id || null}
              onValueChange={(value) => set("department_id", (value as string) ?? "")}
            >
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="Not decided yet" />
              </SelectTrigger>
              <SelectContent>
                {(departments ?? []).map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </SectionCard>

      {/* ---------------- background ---------------- */}
      <SectionCard
        icon={History}
        tint="bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300"
        title="Background & experience"
        description="Languages, past volunteering and extra talents — written down, not scored."
      >
        <div className="flex flex-col gap-6">
          <Field>
            <FieldLabel htmlFor="i-languages">Languages they speak</FieldLabel>
            <Input
              id="i-languages"
              className="h-11"
              placeholder="e.g. Arabic (native), English (good), Turkish (basic)"
              value={draft.languages}
              onChange={(e) => set("languages", e.target.value)}
            />
            <FieldDescription>Write each language and their level in it.</FieldDescription>
          </Field>

          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <Field>
              <FieldLabel>Have they volunteered before?</FieldLabel>
              <YesNoPicker
                value={draft.volunteered_before}
                onChange={(value) => set("volunteered_before", value)}
              />
            </Field>

            {draft.volunteered_before !== false && (
              <Field className="mt-4">
                <FieldLabel htmlFor="i-prev-vol">Where, and what did they do?</FieldLabel>
                <Textarea
                  id="i-prev-vol"
                  rows={3}
                  className="bg-background text-[15px] leading-relaxed"
                  placeholder="Organisation, period, and what their role actually was…"
                  value={draft.previous_volunteering}
                  onChange={(e) => set("previous_volunteering", e.target.value)}
                />
              </Field>
            )}
          </div>

          <Field>
            <FieldLabel htmlFor="i-other-skills">Other talents & skills</FieldLabel>
            <Textarea
              id="i-other-skills"
              rows={3}
              className="text-[15px] leading-relaxed"
              placeholder="e.g. applied for Arabic teaching, but also knows social media and video editing…"
              value={draft.other_skills}
              onChange={(e) => set("other_skills", e.target.value)}
            />
            <FieldDescription>
              Anything beyond what they applied for — useful when we assign teams.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Have they applied to us before?</FieldLabel>
            <YesNoPicker
              value={draft.applied_before}
              onChange={(value) => set("applied_before", value)}
              yesLabel="Applied before"
              noLabel="First time"
            />
          </Field>
        </div>
      </SectionCard>

      {/* ---------------- scoring ---------------- */}
      <SectionCard
        icon={Gauge}
        tint="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
        title="Scoring"
        description="Tap the stars and jot a note beside each one. Tap the same star again to clear it."
      >
        <div className="flex flex-col gap-2.5">
          {INTERVIEW_CRITERIA.map((criterion) => {
            const rated = draft.ratings[criterion.key] != null
            return (
              <div
                key={criterion.key}
                className={cn(
                  "grid grid-cols-1 gap-3 rounded-xl border p-3.5 transition-colors sm:grid-cols-[minmax(0,16rem)_1fr] sm:items-center",
                  rated
                    ? "border-blue-200 bg-blue-50/50 dark:border-blue-500/25 dark:bg-blue-500/5"
                    : "border-border hover:bg-accent/30"
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{criterion.label}</p>
                  <p className="text-xs text-muted-foreground">{criterion.hint}</p>
                  <div className="mt-2">
                    <StarPicker
                      value={draft.ratings[criterion.key] ?? null}
                      onChange={(value) =>
                        setDraft((prev) => {
                          const ratings = { ...prev.ratings }
                          if (value == null) delete ratings[criterion.key]
                          else ratings[criterion.key] = value
                          return { ...prev, ratings }
                        })
                      }
                    />
                  </div>
                </div>
                <Input
                  className="h-11 bg-background"
                  placeholder="Note on this point…"
                  value={draft.criteria_notes[criterion.key] ?? ""}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      criteria_notes: { ...prev.criteria_notes, [criterion.key]: e.target.value },
                    }))
                  }
                />
              </div>
            )
          })}
        </div>
      </SectionCard>

      {/* ---------------- general notes ---------------- */}
      <SectionCard
        icon={NotebookPen}
        tint="bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300"
        title="General notes"
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="i-strengths">Strengths</FieldLabel>
            <Textarea
              id="i-strengths"
              rows={4}
              className="text-[15px] leading-relaxed"
              placeholder="What stood out about them…"
              value={draft.strengths}
              onChange={(e) => set("strengths", e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="i-concerns">Concerns</FieldLabel>
            <Textarea
              id="i-concerns"
              rows={4}
              className="text-[15px] leading-relaxed"
              placeholder="Anything that gave you pause…"
              value={draft.concerns}
              onChange={(e) => set("concerns", e.target.value)}
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="i-notes">Notes</FieldLabel>
            <Textarea
              id="i-notes"
              rows={5}
              className="text-[15px] leading-relaxed"
              placeholder="Anything else worth remembering about them…"
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
            <FieldDescription>
              Carried over to the volunteer's internal notes if they're accepted.
            </FieldDescription>
          </Field>
        </div>
      </SectionCard>

      {/* ---------------- verdict ---------------- */}
      <Card className="overflow-hidden border-blue-200 pt-0 dark:border-blue-500/30">
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-blue-500 to-amber-400" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
              <Award className="size-4" />
            </span>
            Final decision
          </CardTitle>
          <CardDescription>Our own score out of 10, then the call.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/25 dark:bg-amber-500/10">
            <Field>
              <FieldLabel className="text-amber-900 dark:text-amber-200">
                Our overall rating — out of 10
              </FieldLabel>
              <StarPicker
                count={10}
                size="lg"
                value={draft.overall_rating}
                onChange={(value) => set("overall_rating", value)}
              />
              <FieldDescription className="text-amber-800/80 dark:text-amber-200/70">
                This is our view of them as a whole — it doesn't have to match the star average
                above.
              </FieldDescription>
            </Field>
          </div>

          <Field className="max-w-sm">
            <FieldLabel>Decision</FieldLabel>
            <Select
              value={draft.status}
              onValueChange={(value) => set("status", (value as InterviewStatus) ?? "maybe")}
            >
              <SelectTrigger className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(INTERVIEW_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 -mx-2 flex flex-wrap justify-end gap-2 border-t border-border bg-background/85 px-2 py-3 backdrop-blur">
        <Button variant="ghost" render={<Link to="/interviews" />}>
          Cancel
        </Button>
        <Button
          variant="outline"
          onClick={() => handleSave(false)}
          disabled={saveInterview.isPending}
        >
          <Save className="size-4" />
          Save
        </Button>
        <Button onClick={() => handleSave(true)} disabled={saveInterview.isPending}>
          <ClipboardList className="size-4" />
          {saveInterview.isPending ? "Saving…" : "Save & close"}
        </Button>
      </div>
    </div>
  )
}
