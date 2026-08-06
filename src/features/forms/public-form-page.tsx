import { useState } from "react"
import { useParams } from "react-router-dom"
import { CheckCircle2, FileWarning, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { LrcLogoPlate } from "@/components/shared/lrc-logo"
import { useForm, useFormFields, useSubmitFormResponse } from "./use-forms"
import { formThemeStyle } from "./form-theme"
import { cn } from "@/lib/utils"
import type { FormFieldRow } from "@/types/database.types"

type AnswerMap = Record<string, string | string[] | null>

export function PublicFormPage() {
  const { slug } = useParams()
  const { data: form, isLoading } = useForm(slug, true)
  const { data: fields = [], isLoading: fieldsLoading } = useFormFields(form?.id)
  const submitResponse = useSubmitFormResponse()

  const [answers, setAnswers] = useState<AnswerMap>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function setAnswer(fieldId: string, value: string | string[] | null) {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }))
    setErrors((prev) => {
      if (!prev[fieldId]) return prev
      const next = { ...prev }
      delete next[fieldId]
      return next
    })
  }

  function validate() {
    const nextErrors: Record<string, string> = {}
    for (const field of fields) {
      const value = answers[field.id]
      const empty =
        value == null || (Array.isArray(value) ? value.length === 0 : String(value).trim() === "")
      if (field.is_required && empty) {
        nextErrors[field.id] = "هذا الحقل مطلوب / This field is required"
        continue
      }
      if (!empty && field.field_type === "email") {
        const email = String(value)
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          nextErrors[field.id] = "بريد غير صالح / Invalid email"
        }
      }
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitError(null)
    if (!form || !validate()) return

    try {
      await submitResponse.mutateAsync({ formId: form.id, answers })
      setSubmitted(true)
    } catch {
      setSubmitError("تعذر الإرسال، حاول مرة أخرى / Couldn't submit, please try again.")
    }
  }

  if (isLoading || fieldsLoading) {
    return (
      <div className="min-h-svh bg-white px-4 py-12 dark:bg-background">
        <div className="mx-auto max-w-xl">
          <Skeleton className="h-96 w-full rounded-3xl" />
        </div>
      </div>
    )
  }

  if (!form || !form.is_active) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-sky-50 px-4 dark:bg-background">
        <div className="flex max-w-md flex-col items-center gap-3 rounded-3xl bg-white p-10 text-center shadow-xl dark:bg-card">
          <div className="flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <FileWarning className="size-7" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">
            {form ? "هذا النموذج مغلق حالياً" : "النموذج غير موجود"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {form
              ? "This form is closed and is no longer accepting responses."
              : "This form link is not valid."}
          </p>
        </div>
      </div>
    )
  }

  const accent = form.accent_color

  function renderField(field: FormFieldRow) {
    const value = answers[field.id]
    const invalid = !!errors[field.id]

    switch (field.field_type) {
      case "textarea":
        return (
          <Textarea
            rows={3}
            className="rounded-xl"
            value={(value as string) ?? ""}
            onChange={(e) => setAnswer(field.id, e.target.value)}
          />
        )
      case "select":
        return (
          <Select
            value={(value as string) || null}
            onValueChange={(v) => setAnswer(field.id, v ?? null)}
          >
            <SelectTrigger className="h-11 w-full rounded-xl">
              <SelectValue placeholder="اختر / Choose" />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      case "radio":
        return (
          <div className="flex flex-col gap-2">
            {field.options.map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border p-3 text-sm transition-colors hover:bg-accent/40"
              >
                <input
                  type="radio"
                  name={field.id}
                  className="size-4 accent-current"
                  style={{ accentColor: accent }}
                  checked={value === option}
                  onChange={() => setAnswer(field.id, option)}
                />
                {option}
              </label>
            ))}
          </div>
        )
      case "checkbox": {
        const selected = Array.isArray(value) ? value : []
        return (
          <div className="flex flex-col gap-2">
            {field.options.map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border p-3 text-sm transition-colors hover:bg-accent/40"
              >
                <Checkbox
                  checked={selected.includes(option)}
                  onCheckedChange={(checked) =>
                    setAnswer(
                      field.id,
                      checked ? [...selected, option] : selected.filter((o) => o !== option)
                    )
                  }
                />
                {option}
              </label>
            ))}
          </div>
        )
      }
      default:
        return (
          <Input
            type={
              field.field_type === "email"
                ? "email"
                : field.field_type === "number"
                  ? "number"
                  : field.field_type === "date"
                    ? "date"
                    : "text"
            }
            dir={field.field_type === "phone" || field.field_type === "email" ? "ltr" : undefined}
            className="h-11 rounded-xl"
            aria-invalid={invalid}
            value={(value as string) ?? ""}
            onChange={(e) => setAnswer(field.id, e.target.value)}
          />
        )
    }
  }

  const style = formThemeStyle(form.theme ?? "light")

  return (
    <div className={cn("min-h-svh px-4 py-10", style.page)}>
      {style.blobs && (
        <>
          <div
            className="pointer-events-none fixed -top-40 -left-40 size-[30rem] rounded-full opacity-20 blur-3xl"
            style={{ backgroundColor: accent }}
          />
          <div
            className="pointer-events-none fixed -bottom-48 -right-40 size-[28rem] rounded-full opacity-15 blur-3xl"
            style={{ backgroundColor: accent }}
          />
        </>
      )}

      <div className="relative mx-auto max-w-xl">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <LrcLogoPlate className="rounded-2xl px-3 py-2 shadow-md" logoClassName="h-9" />
          <p
            className={cn(
              "text-xs font-medium uppercase tracking-[0.28em]",
              style.pageSubText
            )}
          >
            Volunteer System
          </p>
        </div>

        {submitted ? (
          <div
            className={cn(
              "flex flex-col items-center gap-3 rounded-3xl p-10 text-center",
              style.card
            )}
          >
            <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="size-8" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">تم استلام طلبك! 🎉</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              {form.success_message ||
                "شكرًا لتسجيلك. فريق المركز سيراجع طلبك ويتواصل معك قريبًا."}
            </p>
          </div>
        ) : (
          <div className={cn("overflow-hidden rounded-3xl", style.card)}>
            {form.cover_image_url ? (
              <div className="h-40 w-full overflow-hidden sm:h-48">
                <img
                  src={form.cover_image_url}
                  alt={form.title}
                  className="size-full object-cover"
                />
              </div>
            ) : null}
            <div className="h-2.5 w-full" style={{ backgroundColor: accent }} aria-hidden />
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 p-6 sm:p-8" dir="rtl">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  {form.title}
                </h1>
                {form.description && (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {form.description}
                  </p>
                )}
              </div>

              {fields.map((field) => (
                <Field key={field.id} data-invalid={!!errors[field.id]}>
                  <FieldLabel>
                    {field.label}
                    {field.is_required && <span style={{ color: accent }}> *</span>}
                  </FieldLabel>
                  {renderField(field)}
                  {field.help_text && <FieldDescription>{field.help_text}</FieldDescription>}
                  {errors[field.id] && <FieldError>{errors[field.id]}</FieldError>}
                </Field>
              ))}

              {submitError && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {submitError}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                disabled={submitResponse.isPending}
                className="h-12 rounded-xl text-base text-white shadow-lg"
                style={{ backgroundColor: accent }}
              >
                <Send className="size-5" />
                {submitResponse.isPending ? "جارٍ الإرسال…" : "إرسال / Submit"}
              </Button>
            </form>
          </div>
        )}

        <p className={cn("mt-6 text-center text-xs", style.footer)}>
          Designed by Jamal Ilaiwi · LRC {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
