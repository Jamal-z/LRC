import { useEffect, useState } from "react"
import { Star } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  useSaveInterview,
  type InterviewWithRelations,
} from "./use-interviews"

function StarPicker({
  value,
  onChange,
}: {
  value: number | null
  onChange: (value: number) => void
}) {
  return (
    <div className="flex gap-0.5">
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
              "size-6",
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

interface DraftState {
  full_name: string
  university_id: string
  major: string
  phone: string
  email: string
  city: string
  department_id: string
  status: InterviewStatus
  interviewed_at: string
  ratings: Record<string, number>
  strengths: string
  concerns: string
  notes: string
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
    status: "maybe",
    interviewed_at: new Date().toISOString().slice(0, 10),
    ratings: {},
    strengths: "",
    concerns: "",
    notes: "",
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
    status: interview.status,
    interviewed_at: interview.interviewed_at,
    ratings: interview.ratings ?? {},
    strengths: interview.strengths ?? "",
    concerns: interview.concerns ?? "",
    notes: interview.notes ?? "",
  }
}

export function InterviewFormDialog({
  open,
  onOpenChange,
  interview,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  interview: InterviewWithRelations | null
}) {
  const { profile } = useAuth()
  const { data: departments } = useDepartments()
  const saveInterview = useSaveInterview()
  const [draft, setDraft] = useState<DraftState>(emptyDraft)
  const [nameError, setNameError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setDraft(interview ? draftFrom(interview) : emptyDraft())
    setNameError(null)
  }, [open, interview])

  async function handleSave() {
    if (!draft.full_name.trim()) {
      setNameError("The candidate's name is required.")
      return
    }

    try {
      await saveInterview.mutateAsync({
        id: interview?.id,
        full_name: draft.full_name.trim(),
        university_id: draft.university_id.trim() || null,
        major: draft.major.trim() || null,
        phone: draft.phone.trim() || null,
        email: draft.email.trim() || null,
        city: draft.city.trim() || null,
        department_id: draft.department_id || null,
        ratings: draft.ratings,
        strengths: draft.strengths.trim() || null,
        concerns: draft.concerns.trim() || null,
        notes: draft.notes.trim() || null,
        status: draft.status,
        // the original interviewer stays on record when someone else edits later
        interviewed_by: interview?.interviewed_by ?? profile?.id ?? null,
        interviewed_at: draft.interviewed_at,
      })
      toast.success(interview ? "Interview updated" : `${draft.full_name.trim()} recorded`)
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save the interview")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{interview ? "Edit interview" : "New interview"}</DialogTitle>
          <DialogDescription>
            Record the candidate's details and how they scored, then file them under accepted,
            maybe, or rejected.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          {/* candidate details */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field className="sm:col-span-2" data-invalid={!!nameError}>
              <FieldLabel htmlFor="i-name">Full name *</FieldLabel>
              <Input
                id="i-name"
                value={draft.full_name}
                onChange={(e) => {
                  setDraft((prev) => ({ ...prev, full_name: e.target.value }))
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
                value={draft.phone}
                onChange={(e) => setDraft((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="i-email">Email</FieldLabel>
              <Input
                id="i-email"
                type="email"
                value={draft.email}
                onChange={(e) => setDraft((prev) => ({ ...prev, email: e.target.value }))}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="i-university-id">University ID</FieldLabel>
              <Input
                id="i-university-id"
                value={draft.university_id}
                onChange={(e) => setDraft((prev) => ({ ...prev, university_id: e.target.value }))}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="i-major">Major</FieldLabel>
              <Input
                id="i-major"
                value={draft.major}
                onChange={(e) => setDraft((prev) => ({ ...prev, major: e.target.value }))}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="i-city">City</FieldLabel>
              <Input
                id="i-city"
                value={draft.city}
                onChange={(e) => setDraft((prev) => ({ ...prev, city: e.target.value }))}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="i-date">Interview date</FieldLabel>
              <Input
                id="i-date"
                type="date"
                value={draft.interviewed_at}
                onChange={(e) => setDraft((prev) => ({ ...prev, interviewed_at: e.target.value }))}
              />
            </Field>

            <Field>
              <FieldLabel>Team they'd join</FieldLabel>
              <Select
                value={draft.department_id || null}
                onValueChange={(value) =>
                  setDraft((prev) => ({ ...prev, department_id: (value as string) ?? "" }))
                }
              >
                <SelectTrigger className="w-full">
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

            <Field>
              <FieldLabel>Decision</FieldLabel>
              <Select
                value={draft.status}
                onValueChange={(value) =>
                  setDraft((prev) => ({
                    ...prev,
                    status: ((value as InterviewStatus) ?? "maybe") as InterviewStatus,
                  }))
                }
              >
                <SelectTrigger className="w-full">
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
          </div>

          {/* scoring */}
          <div>
            <p className="text-sm font-medium text-foreground">Scoring</p>
            <p className="text-xs text-muted-foreground">
              Tap the stars — leave anything you didn't ask about blank.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {INTERVIEW_CRITERIA.map((criterion) => (
                <div
                  key={criterion.key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {criterion.label}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{criterion.hint}</p>
                  </div>
                  <StarPicker
                    value={draft.ratings[criterion.key] ?? null}
                    onChange={(value) =>
                      setDraft((prev) => ({
                        ...prev,
                        ratings: { ...prev.ratings, [criterion.key]: value },
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          {/* impressions */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="i-strengths">Strengths</FieldLabel>
              <Textarea
                id="i-strengths"
                rows={3}
                placeholder="What stood out about them…"
                value={draft.strengths}
                onChange={(e) => setDraft((prev) => ({ ...prev, strengths: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="i-concerns">Concerns</FieldLabel>
              <Textarea
                id="i-concerns"
                rows={3}
                placeholder="Anything that gave you pause…"
                value={draft.concerns}
                onChange={(e) => setDraft((prev) => ({ ...prev, concerns: e.target.value }))}
              />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="i-notes">Notes</FieldLabel>
              <Textarea
                id="i-notes"
                rows={3}
                value={draft.notes}
                onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
              />
              <FieldDescription>
                Carried over to the volunteer's internal notes if they're accepted.
              </FieldDescription>
            </Field>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saveInterview.isPending}>
            {saveInterview.isPending ? "Saving…" : interview ? "Save changes" : "Save interview"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
