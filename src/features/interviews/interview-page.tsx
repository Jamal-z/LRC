import { useEffect, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { ArrowLeft, FileText, Save, Sparkles, Star } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
/* Star pickers                                                        */
/* ------------------------------------------------------------------ */

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
  const box = size === "lg" ? "size-8" : "size-6"
  return (
    <div className="flex flex-wrap items-center gap-0.5">
      {Array.from({ length: count }, (_, i) => i + 1).map((star) => (
        <button
          key={star}
          type="button"
          // clicking the current value again clears it — "we didn't ask this"
          onClick={() => onChange(value === star ? null : star)}
          aria-label={`${star} out of ${count}`}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={cn(
              box,
              value != null && star <= value
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/30 hover:text-amber-300"
            )}
          />
        </button>
      ))}
      {value != null && (
        <span className="ms-1.5 text-xs font-semibold tabular-nums text-muted-foreground">
          {value}/{count}
        </span>
      )}
    </div>
  )
}

function YesNoPicker({
  value,
  onChange,
  yesLabel = "نعم / Yes",
  noLabel = "لا / No",
}: {
  value: boolean | null
  onChange: (value: boolean | null) => void
  yesLabel?: string
  noLabel?: string
}) {
  const options: { key: string; label: string; state: boolean | null }[] = [
    { key: "yes", label: yesLabel, state: true },
    { key: "no", label: noLabel, state: false },
    { key: "unknown", label: "ما سألنا", state: null },
  ]
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.state)}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
            value === option.state
              ? "border-primary bg-primary/10 text-primary"
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

  async function handleSave(closeAfter: boolean) {
    if (!draft.full_name.trim()) {
      setNameError("لازم اسم المتقدّم / The candidate's name is required.")
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
      toast.success(interview ? "تم حفظ التعديلات" : `تم تسجيل مقابلة ${draft.full_name.trim()}`)
      if (closeAfter) navigate("/interviews")
      else if (!interview) navigate(`/interviews/${savedId}`, { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر حفظ المقابلة")
    }
  }

  if ((id && isLoading) || (!id && fromResponseId && applicantLoading)) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-[32rem] w-full" />
      </div>
    )
  }

  return (
    // a roomier type scale than the rest of the app: this page gets filled in
    // live while talking to someone, so it has to be easy to scan and type into
    <div dir="rtl" className="mx-auto flex max-w-5xl flex-col gap-5 text-[15px] leading-relaxed">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" render={<Link to="/interviews" />}>
            <ArrowLeft className="size-4 rotate-180" />
            رجوع للمقابلات
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={saveInterview.isPending}
          >
            <Save className="size-4" />
            حفظ
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saveInterview.isPending}>
            {saveInterview.isPending ? "جارٍ الحفظ…" : "حفظ وإغلاق"}
          </Button>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {interview ? `مقابلة ${interview.full_name}` : "مقابلة جديدة"}
        </h1>
        <p className="text-sm text-muted-foreground">
          عبّي المعلومات وأنت بتحكي معه — كل خانة نجوم إلها خانة ملاحظة جنبها.
        </p>
      </div>

      {/* what they wrote in the form, kept beside us while we talk */}
      {applicant && !id && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" />
              معبّى من نموذج «{applicant.formTitle}»
            </CardTitle>
            <CardDescription>
              قدّم بتاريخ {new Date(applicant.submittedAt).toLocaleDateString()} — راجع جواباته
              وعدّل أي شي ناقص.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {applicant.answers
                .filter((answer) => answer.value)
                .map((answer) => (
                  <div key={answer.label} className="min-w-0">
                    <dt className="text-xs font-medium text-muted-foreground">{answer.label}</dt>
                    <dd className="truncate text-sm text-foreground">{answer.value}</dd>
                  </div>
                ))}
            </dl>
          </CardContent>
        </Card>
      )}

      {interview?.form_response_id && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileText className="size-3.5" />
          هاي المقابلة مربوطة بطلب من الفورمز.
        </p>
      )}

      {/* ---------------- candidate details ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">معلومات المتقدّم</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field className="sm:col-span-2" data-invalid={!!nameError}>
            <FieldLabel htmlFor="i-name">الاسم الرباعي *</FieldLabel>
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
            <FieldLabel htmlFor="i-phone">رقم الواتساب</FieldLabel>
            <Input
              id="i-phone"
              dir="ltr"
              className="h-11"
              value={draft.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="i-email">الإيميل</FieldLabel>
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
            <FieldLabel htmlFor="i-university-id">الرقم الجامعي</FieldLabel>
            <Input
              id="i-university-id"
              className="h-11"
              value={draft.university_id}
              onChange={(e) => set("university_id", e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="i-major">التخصص</FieldLabel>
            <Input
              id="i-major"
              className="h-11"
              value={draft.major}
              onChange={(e) => set("major", e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="i-city">مكان السكن</FieldLabel>
            <Input
              id="i-city"
              className="h-11"
              value={draft.city}
              onChange={(e) => set("city", e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="i-applied-for">قدّم على</FieldLabel>
            <Input
              id="i-applied-for"
              className="h-11"
              placeholder="مثلاً: تعليم عربي"
              value={draft.applied_for}
              onChange={(e) => set("applied_for", e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="i-date">تاريخ المقابلة</FieldLabel>
            <Input
              id="i-date"
              type="date"
              className="h-11"
              value={draft.interviewed_at}
              onChange={(e) => set("interviewed_at", e.target.value)}
            />
          </Field>

          <Field>
            <FieldLabel>الفريق الي رح ينضم إله</FieldLabel>
            <Select
              value={draft.department_id || null}
              onValueChange={(value) => set("department_id", (value as string) ?? "")}
            >
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="لسا ما تقرّر" />
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
        </CardContent>
      </Card>

      {/* ---------------- background ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">خلفيته وخبرته</CardTitle>
          <CardDescription>
            اللغات والتطوع السابق والمواهب — هاي بنكتبها، ما منعطيها نجوم.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Field>
            <FieldLabel htmlFor="i-languages">اللغات الي بيعرفها</FieldLabel>
            <Input
              id="i-languages"
              className="h-11"
              placeholder="مثلاً: عربي، إنجليزي، تركي (مستوى متوسط)"
              value={draft.languages}
              onChange={(e) => set("languages", e.target.value)}
            />
            <FieldDescription>اكتب كل لغة ومستواه فيها.</FieldDescription>
          </Field>

          <Field>
            <FieldLabel>تطوّع قبل هيك؟</FieldLabel>
            <YesNoPicker
              value={draft.volunteered_before}
              onChange={(value) => set("volunteered_before", value)}
            />
          </Field>

          {draft.volunteered_before !== false && (
            <Field>
              <FieldLabel htmlFor="i-prev-vol">وين تطوّع وشو كانت طبيعة تطوّعه؟</FieldLabel>
              <Textarea
                id="i-prev-vol"
                rows={3}
                className="text-[15px] leading-relaxed"
                placeholder="اسم الجهة، الفترة، وشو كان بيعمل بالضبط…"
                value={draft.previous_volunteering}
                onChange={(e) => set("previous_volunteering", e.target.value)}
              />
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="i-other-skills">مواهب ومهارات تانية</FieldLabel>
            <Textarea
              id="i-other-skills"
              rows={3}
              className="text-[15px] leading-relaxed"
              placeholder="مثلاً: قدّم على تعليم عربي بس كمان بيفهم بالسوشال ميديا والمونتاج…"
              value={draft.other_skills}
              onChange={(e) => set("other_skills", e.target.value)}
            />
            <FieldDescription>
              أي شي بيعرفه غير الي قدّم عليه — بيفيدنا لما نوزّع الفرق.
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel>قدّم عنا قبل هيك؟</FieldLabel>
            <YesNoPicker
              value={draft.applied_before}
              onChange={(value) => set("applied_before", value)}
              yesLabel="آه قدّم قبل"
              noLabel="أول مرة"
            />
          </Field>
        </CardContent>
      </Card>

      {/* ---------------- scoring ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
            <span>التقييم</span>
            {average != null && (
              <Badge variant="secondary" className="gap-1">
                <Star className="size-3.5 fill-amber-400 text-amber-400" />
                معدّل النجوم {average.toFixed(1)} / 5
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            اضغط على النجوم، واكتب ملاحظتك جنب كل بند. اضغط نفس النجمة مرة تانية لتفضيها.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {INTERVIEW_CRITERIA.map((criterion) => (
            <div
              key={criterion.key}
              className="grid grid-cols-1 gap-3 rounded-xl border border-border p-3.5 sm:grid-cols-[minmax(0,15rem)_1fr] sm:items-center"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{criterion.label}</p>
                <p className="text-xs text-muted-foreground">{criterion.hint}</p>
                <div className="mt-1.5">
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
                className="h-11"
                placeholder="ملاحظتك على هاي النقطة…"
                value={draft.criteria_notes[criterion.key] ?? ""}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    criteria_notes: { ...prev.criteria_notes, [criterion.key]: e.target.value },
                  }))
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ---------------- general notes ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">الملاحظات العامة</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="i-strengths">نقاط القوة</FieldLabel>
            <Textarea
              id="i-strengths"
              rows={4}
              className="text-[15px] leading-relaxed"
              placeholder="شو الي لفت نظرنا فيه…"
              value={draft.strengths}
              onChange={(e) => set("strengths", e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="i-concerns">التحفّظات</FieldLabel>
            <Textarea
              id="i-concerns"
              rows={4}
              className="text-[15px] leading-relaxed"
              placeholder="أي شي خلانا نتردّد…"
              value={draft.concerns}
              onChange={(e) => set("concerns", e.target.value)}
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="i-notes">ملاحظات عامة</FieldLabel>
            <Textarea
              id="i-notes"
              rows={5}
              className="text-[15px] leading-relaxed"
              placeholder="أي شي تاني بدنا نتذكّره عنه…"
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
            <FieldDescription>
              بتنتقل لملاحظات المتطوّع الداخلية إذا قبلناه.
            </FieldDescription>
          </Field>
        </CardContent>
      </Card>

      {/* ---------------- verdict ---------------- */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-base">القرار النهائي</CardTitle>
          <CardDescription>تقييمنا الشخصي إله من ١٠، وبعدها القرار.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Field>
            <FieldLabel>تقييمنا العام من ١٠</FieldLabel>
            <StarPicker
              count={10}
              size="lg"
              value={draft.overall_rating}
              onChange={(value) => set("overall_rating", value)}
            />
            <FieldDescription>
              هاد رأينا فيه ككل — مش لازم يطابق معدّل النجوم فوق.
            </FieldDescription>
          </Field>

          <Field className="max-w-sm">
            <FieldLabel>القرار</FieldLabel>
            <Select
              value={draft.status}
              onValueChange={(value) => set("status", ((value as InterviewStatus) ?? "maybe"))}
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

      <div className="flex flex-wrap justify-end gap-2 pb-6">
        <Button variant="outline" render={<Link to="/interviews" />}>
          إلغاء
        </Button>
        <Button
          variant="outline"
          onClick={() => handleSave(false)}
          disabled={saveInterview.isPending}
        >
          <Save className="size-4" />
          حفظ
        </Button>
        <Button onClick={() => handleSave(true)} disabled={saveInterview.isPending}>
          {saveInterview.isPending ? "جارٍ الحفظ…" : "حفظ وإغلاق"}
        </Button>
      </div>
    </div>
  )
}
