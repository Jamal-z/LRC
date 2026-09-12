import { useState } from "react"
import { useParams } from "react-router-dom"
import { FileWarning } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useForm, useFormFields, useSubmitFormResponse } from "./use-forms"
import { FIELD_INDEX_ATTR } from "./form-design"
import { FormRenderer, validateAnswers, type AnswerMap } from "./form-renderer"

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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitError(null)
    if (!form) return

    const nextErrors = validateAnswers(fields, answers)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      // an uploaded layout has no .lrc-question blocks — its controls are
      // tagged by position instead, so the first unanswered one is found there
      const missing = fields.findIndex((field) => nextErrors[field.id])
      const target =
        document.querySelector(`[${FIELD_INDEX_ATTR}="${missing}"]`) ??
        document.querySelector(".lrc-question")
      target?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }

    try {
      await submitResponse.mutateAsync({ formId: form.id, answers })
      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch {
      setSubmitError("تعذر الإرسال، حاول مرة أخرى / Couldn't submit, please try again.")
    }
  }

  if (isLoading || fieldsLoading) {
    return (
      <div className="min-h-svh bg-white px-4 py-12 dark:bg-background">
        <div className="mx-auto max-w-3xl">
          <Skeleton className="h-[32rem] w-full rounded-3xl" />
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
          {/* the form's own name, so somebody who filled it in knows which
              round this is talking about and not that they mistyped the link */}
          {form && <p className="text-sm font-medium text-muted-foreground">{form.title}</p>}
          <h1 className="text-xl font-semibold text-foreground">
            {form ? "هذا النموذج مغلق حالياً" : "النموذج غير موجود"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {form
              ? "انتهى استقبال الردود على هذا النموذج. شكراً لاهتمامك. / This form is closed and is no longer accepting responses."
              : "This form link is not valid."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <FormRenderer
      form={form}
      fields={fields}
      answers={answers}
      errors={errors}
      onAnswer={setAnswer}
      onSubmit={handleSubmit}
      submitting={submitResponse.isPending}
      submitError={submitError}
      submitted={submitted}
    />
  )
}
