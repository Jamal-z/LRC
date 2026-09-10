import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { BarChart3, Download, Search, UserRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { exportToExcel } from "@/lib/export"
import { identityFields, respondentLabel } from "@/features/comparison/use-matching"
import type { FormFieldRow, FormResponseRow, FormRow } from "@/types/database.types"

/**
 * The at-a-glance read of a form: how each question was answered, and by whom.
 *
 * Counts alone are only half of what the centre needs — "how many said yes" is
 * the start of the question and "which of them said yes" is the rest of it — so
 * every number here opens into the list of people behind it.
 */

const CHOICE_TYPES = ["select", "radio", "checkbox"]
const BLANK = "— left blank —"

function answerText(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) return value.join("، ")
  return value ?? ""
}

/** Every option a response picked; checkbox answers count once per box. */
function answerValues(value: string | string[] | null | undefined): string[] {
  if (Array.isArray(value)) return value.filter((entry) => entry?.trim())
  const text = (value ?? "").trim()
  return text ? [text] : []
}

interface Answer {
  response: FormResponseRow
  who: string
  text: string
  values: string[]
}

export function FormSummary({
  form,
  fields,
  responses,
}: {
  form: FormRow
  fields: FormFieldRow[]
  responses: FormResponseRow[]
}) {
  const [openQuestion, setOpenQuestion] = useState<{ field: FormFieldRow; option?: string } | null>(
    null
  )

  const keys = useMemo(() => identityFields(fields), [fields])

  // one pass: every answer to every question, already labelled with who gave it
  const byField = useMemo(() => {
    const map = new Map<string, Answer[]>()
    for (const field of fields) map.set(field.id, [])
    for (const response of responses) {
      const who = respondentLabel(response, keys)
      for (const field of fields) {
        const raw = response.answers[field.id]
        map.get(field.id)!.push({
          response,
          who,
          text: answerText(raw),
          values: answerValues(raw),
        })
      }
    }
    return map
  }, [fields, responses, keys])

  if (!responses.length) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            title="No responses yet"
            description="Once people start filling the form in, this is where the answers add up."
            icon={BarChart3}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {fields.map((field) => {
        const answers = byField.get(field.id) ?? []
        const answered = answers.filter((answer) => answer.values.length)

        return (
          <Card key={field.id}>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{field.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {answered.length} of {responses.length} answered
                    {answered.length < responses.length &&
                      ` · ${responses.length - answered.length} skipped`}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setOpenQuestion({ field })}>
                  <UserRound className="size-3.5" />
                  All answers
                </Button>
              </div>

              {CHOICE_TYPES.includes(field.field_type) ? (
                <ChoiceBreakdown
                  field={field}
                  answers={answers}
                  onPick={(option) => setOpenQuestion({ field, option })}
                />
              ) : field.field_type === "number" ? (
                <NumberBreakdown answers={answered} />
              ) : (
                <TextPreview
                  answers={answered}
                  // on the "what is your name" question the answer *is* the
                  // person, so naming them above it would say it twice
                  showWho={field.id !== keys.full_name?.id}
                  onSeeAll={() => setOpenQuestion({ field })}
                />
              )}
            </CardContent>
          </Card>
        )
      })}

      <QuestionDialog
        form={form}
        question={openQuestion}
        answers={openQuestion ? (byField.get(openQuestion.field.id) ?? []) : []}
        onClose={() => setOpenQuestion(null)}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Multiple choice — the "45% said yes" view
 * ------------------------------------------------------------------ */

function ChoiceBreakdown({
  field,
  answers,
  onPick,
}: {
  field: FormFieldRow
  answers: Answer[]
  onPick: (option: string) => void
}) {
  const rows = useMemo(() => {
    const counts = new Map<string, number>()
    // start from the options the form offers, so a zero shows as a zero
    for (const option of field.options ?? []) counts.set(option, 0)

    let blank = 0
    for (const answer of answers) {
      if (!answer.values.length) {
        blank++
        continue
      }
      for (const value of answer.values) counts.set(value, (counts.get(value) ?? 0) + 1)
    }
    if (blank) counts.set(BLANK, blank)

    // checkboxes let one person tick several boxes, so percentages are of
    // people who answered, not of ticks
    const base = answers.filter((answer) => answer.values.length).length || 1
    return [...counts.entries()]
      .map(([option, count]) => ({
        option,
        count,
        percent: option === BLANK ? (count / answers.length) * 100 : (count / base) * 100,
      }))
      .sort((a, b) => b.count - a.count)
  }, [field.options, answers])

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <button
          key={row.option}
          type="button"
          disabled={!row.count}
          onClick={() => onPick(row.option)}
          className="group flex flex-col gap-1 rounded-lg px-2 py-1.5 text-start transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-60"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm text-foreground">{row.option}</span>
            <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
              {row.count} · {Math.round(row.percent)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all group-hover:opacity-80"
              style={{ width: `${Math.max(row.percent, row.count ? 2 : 0)}%` }}
            />
          </div>
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Numbers
 * ------------------------------------------------------------------ */

function NumberBreakdown({ answers }: { answers: Answer[] }) {
  const stats = useMemo(() => {
    const numbers = answers
      .map((answer) => Number(answer.text.replace(/[^\d.-]/g, "")))
      .filter((value) => Number.isFinite(value))
    if (!numbers.length) return null
    const total = numbers.reduce((sum, value) => sum + value, 0)
    return {
      average: total / numbers.length,
      min: Math.min(...numbers),
      max: Math.max(...numbers),
      total,
    }
  }, [answers])

  if (!stats) return <p className="text-sm text-muted-foreground">No numbers to add up yet.</p>

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[
        { label: "Average", value: Math.round(stats.average * 100) / 100 },
        { label: "Lowest", value: stats.min },
        { label: "Highest", value: stats.max },
        { label: "Total", value: stats.total },
      ].map((stat) => (
        <div key={stat.label} className="rounded-lg border border-border p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{stat.value}</p>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Written answers
 * ------------------------------------------------------------------ */

function TextPreview({
  answers,
  showWho,
  onSeeAll,
}: {
  answers: Answer[]
  showWho: boolean
  onSeeAll: () => void
}) {
  if (!answers.length) {
    return <p className="text-sm text-muted-foreground">Nobody answered this one.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {answers.slice(0, 4).map((answer) => (
        <div key={answer.response.id} className="rounded-lg border border-border p-3">
          {showWho && (
            <p className="text-xs font-medium text-muted-foreground">{answer.who}</p>
          )}
          <p className={`whitespace-pre-wrap text-sm text-foreground ${showWho ? "mt-1" : ""}`}>
            {answer.text}
          </p>
        </div>
      ))}
      {answers.length > 4 && (
        <Button variant="ghost" size="sm" className="self-start" onClick={onSeeAll}>
          Show the other {answers.length - 4}
        </Button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * One question, every answer, with names
 * ------------------------------------------------------------------ */

function QuestionDialog({
  form,
  question,
  answers,
  onClose,
}: {
  form: FormRow
  question: { field: FormFieldRow; option?: string } | null
  answers: Answer[]
  onClose: () => void
}) {
  const [search, setSearch] = useState("")

  const rows = useMemo(() => {
    let list = answers
    if (question?.option) {
      list =
        question.option === BLANK
          ? list.filter((answer) => !answer.values.length)
          : list.filter((answer) => answer.values.includes(question.option!))
    } else {
      list = list.filter((answer) => answer.values.length)
    }
    const term = search.trim().toLowerCase()
    if (!term) return list
    return list.filter(
      (answer) =>
        answer.who.toLowerCase().includes(term) || answer.text.toLowerCase().includes(term)
    )
  }, [answers, question, search])

  return (
    <Dialog
      open={!!question}
      onOpenChange={(open) => {
        if (!open) {
          setSearch("")
          onClose()
        }
      }}
    >
      <DialogContent className="flex max-h-[90svh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="pe-6">{question?.field.label}</DialogTitle>
          <DialogDescription>
            {question?.option ? (
              <>
                {rows.length} answered <span className="font-medium">{question.option}</span>
              </>
            ) : (
              `${rows.length} answer${rows.length === 1 ? "" : "s"}`
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search a name or an answer"
              className="ps-9"
            />
          </div>
          <Button
            variant="outline"
            disabled={!rows.length}
            onClick={() =>
              exportToExcel(
                rows,
                [
                  { header: "Who", value: (row) => row.who },
                  { header: question?.field.label ?? "Answer", value: (row) => row.text },
                  {
                    header: "Submitted",
                    value: (row) => new Date(row.response.created_at).toLocaleString(),
                  },
                ],
                `${form.slug}-${(question?.field.label ?? "answers").slice(0, 24)}`
              )
            }
          >
            <Download className="size-4" />
            Export
          </Button>
        </div>

        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          {rows.length === 0 ? (
            <EmptyState title="Nothing to show" icon={Search} />
          ) : (
            <div className="flex flex-col gap-2">
              {rows.map((row) => (
                <div
                  key={row.response.id}
                  className="rounded-lg border border-border p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-foreground">
                      {row.response.volunteer_id ? (
                        <Link
                          to={`/volunteers/${row.response.volunteer_id}`}
                          className="underline underline-offset-2"
                        >
                          {row.who}
                        </Link>
                      ) : (
                        row.who
                      )}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[0.7rem]">
                        {row.response.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(row.response.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-foreground">{row.text || "—"}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
