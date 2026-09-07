import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { CheckCircle2, ChevronRight, FileText, Inbox, Search, UserRoundPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { cn } from "@/lib/utils"
import { useFormApplicants, useFormsWithResponses } from "./use-interviews"

/**
 * "Where do I get people from" → pick a form, then pick a person.
 * Everything they wrote is already on file, so opening one goes straight
 * to a pre-filled interview page.
 */
export function InterviewApplicants() {
  const { data: forms, isLoading } = useFormsWithResponses()
  const [formId, setFormId] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  // land on the newest form with responses so the tab is never empty
  useEffect(() => {
    if (!formId && forms?.length) setFormId(forms[0].id)
  }, [formId, forms])

  const { data: applicants, isLoading: applicantsLoading } = useFormApplicants(formId ?? undefined)

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 p-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (!forms?.length) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            title="No applications yet"
            description="Once someone fills in one of your forms, they show up here ready to interview."
            icon={Inbox}
          />
        </CardContent>
      </Card>
    )
  }

  const filtered = (applicants ?? []).filter((applicant) => {
    if (!search.trim()) return true
    const needle = search.trim().toLowerCase()
    return (
      applicant.fullName.toLowerCase().includes(needle) ||
      applicant.answers.some((a) => a.value.toLowerCase().includes(needle))
    )
  })

  const waiting = (applicants ?? []).filter((a) => !a.interviewId).length

  return (
    <div className="flex flex-col gap-3">
      {/* which form */}
      <div className="flex flex-wrap gap-2">
        {forms.map((form) => (
          <button
            key={form.id}
            type="button"
            onClick={() => setFormId(form.id)}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
              formId === form.id
                ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400/50 dark:bg-blue-500/15 dark:text-blue-300"
                : "border-border text-muted-foreground hover:bg-accent/50"
            )}
          >
            <FileText className="size-4 shrink-0" />
            <span className="font-medium">{form.title}</span>
            <Badge variant="secondary" className="tabular-nums">
              {form.form_responses.length}
            </Badge>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-10 ps-9"
            placeholder="Search a name or any answer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {!applicantsLoading && (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{waiting}</span> still to
            interview out of {applicants?.length ?? 0}
          </p>
        )}
      </div>

      <Card className="overflow-hidden pt-0">
        <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-blue-500 to-amber-400" />
        <CardContent className="p-0">
          {applicantsLoading ? (
            <div className="flex flex-col gap-3 p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No matches"
              description="Try another form or a different search term."
              icon={Inbox}
            />
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((applicant) => {
                const subtitle = applicant.answers
                  .filter((a) => a.value)
                  .slice(1, 4)
                  .map((a) => a.value)
                  .join(" · ")

                return (
                  <li key={applicant.responseId}>
                    <Link
                      to={
                        applicant.interviewId
                          ? `/interviews/${applicant.interviewId}`
                          : `/interviews/new?from=${applicant.responseId}`
                      }
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-blue-50/60 dark:hover:bg-blue-500/10"
                    >
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold",
                          applicant.interviewId
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                        )}
                      >
                        {applicant.interviewId ? (
                          <CheckCircle2 className="size-4.5" />
                        ) : (
                          applicant.fullName.trim().charAt(0).toUpperCase() || "?"
                        )}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">
                          {applicant.fullName}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {subtitle || "—"}
                        </span>
                      </span>

                      <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                        {new Date(applicant.submittedAt).toLocaleDateString()}
                      </span>

                      {applicant.interviewId ? (
                        <Badge variant="secondary" className="shrink-0">
                          Interviewed
                        </Badge>
                      ) : (
                        <Button size="sm" className="pointer-events-none shrink-0">
                          <UserRoundPlus className="size-3.5" />
                          Start interview
                        </Button>
                      )}

                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
