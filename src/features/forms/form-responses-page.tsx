import { useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import {
  ArrowLeft,
  BarChart3,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Pencil,
  TriangleAlert,
  UserRound,
  UserRoundX,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { useAuth } from "@/features/auth/auth-context"
import { exportToExcel, type ExportColumn } from "@/lib/export"
import { FormAudienceTab } from "./form-audience-tab"
import { FormSummary } from "./form-summary"
import {
  FIELD_MAPPINGS,
  collectMappedAnswers,
  useForm,
  useFormFields,
  useFormResponses,
  useReviewResponse,
} from "./use-forms"
import type { FormFieldRow, FormResponseRow } from "@/types/database.types"

function answerText(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) return value.join("، ")
  return value ?? ""
}

/**
 * What accepting this response would put on the volunteer.
 *
 * Every question can point at a volunteer field, and a question pointing
 * nowhere is silently dropped on acceptance — which is how a language grid
 * ends up saving one language out of nine. Showing the outcome next to the
 * answers turns that from something discovered later into something visible
 * now, while it can still be fixed in the form.
 */
function WillSave({
  response,
  fields,
}: {
  response: FormResponseRow
  fields: FormFieldRow[]
}) {
  const mapped = collectMappedAnswers(fields, response.answers)
  const entries = Object.entries(mapped)
  const unmapped = fields.filter(
    (field) => !field.maps_to && answerText(response.answers[field.id]).trim()
  )

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Saved to the volunteer
      </p>
      {entries.length === 0 ? (
        <p className="mt-1.5 text-sm text-amber-700 dark:text-amber-300">
          Nothing — no question on this form is pointed at a volunteer field. Open the form and set
          "Save answer into" on the questions that matter.
        </p>
      ) : (
        <dl className="mt-1.5 flex flex-col gap-1 text-sm">
          {entries.map(([target, value]) => (
            <div key={target} className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground">
                {FIELD_MAPPINGS.find((mapping) => mapping.value === target)?.label ?? target}:
              </dt>
              <dd className="min-w-0 font-medium text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {unmapped.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {unmapped.length} answered question{unmapped.length === 1 ? "" : "s"} kept on the response
          only: {unmapped.map((field) => field.label).join("، ")}
        </p>
      )}
    </div>
  )
}

export function FormResponsesPage() {
  const { id } = useParams()
  const { profile } = useAuth()
  const { data: form, isLoading: formLoading } = useForm(id)
  const { data: fields = [] } = useFormFields(id)
  const { data: responses = [], isLoading } = useFormResponses(id)
  const reviewResponse = useReviewResponse()

  const [viewing, setViewing] = useState<FormResponseRow | null>(null)

  const pending = useMemo(() => responses.filter((r) => r.status === "pending"), [responses])
  const reviewed = useMemo(() => responses.filter((r) => r.status !== "pending"), [responses])

  if (formLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  if (!form) {
    return <EmptyState title="Form not found" icon={FileText} />
  }

  async function handleReview(response: FormResponseRow, decision: "approved" | "rejected") {
    try {
      await reviewResponse.mutateAsync({
        response,
        form: form!,
        fields,
        decision,
        reviewerId: profile?.id ?? null,
      })
      toast.success(decision === "approved" ? "Accepted" : "Rejected")
      setViewing(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong")
    }
  }

  const exportColumns: ExportColumn<FormResponseRow>[] = [
    { header: "Submitted", value: (r) => new Date(r.created_at).toLocaleString() },
    { header: "Status", value: (r) => r.status },
    ...fields.map((field) => ({
      header: field.label,
      value: (r: FormResponseRow) => answerText(r.answers[field.id]),
    })),
  ]

  const publicUrl = `${window.location.origin}/f/${encodeURIComponent(form.slug)}`

  function ResponseTable({ rows, showActions }: { rows: FormResponseRow[]; showActions: boolean }) {
    // show the first few questions as columns; the rest live in the detail dialog
    const columns = fields.slice(0, 4)
    return (
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((field) => (
              <TableHead key={field.id}>{field.label}</TableHead>
            ))}
            <TableHead>Submitted</TableHead>
            {showActions ? <TableHead className="w-52" /> : <TableHead>Status</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((response) => (
            <TableRow
              key={response.id}
              className="cursor-pointer"
              onClick={() => setViewing(response)}
            >
              {columns.map((field) => (
                <TableCell key={field.id} className="max-w-48 truncate">
                  {answerText(response.answers[field.id]) || "—"}
                </TableCell>
              ))}
              <TableCell className="text-sm text-muted-foreground">
                {new Date(response.created_at).toLocaleDateString()}
              </TableCell>
              {showActions ? (
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      disabled={reviewResponse.isPending}
                      onClick={() => handleReview(response, "approved")}
                    >
                      <Check className="size-3.5" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reviewResponse.isPending}
                      onClick={() => handleReview(response, "rejected")}
                    >
                      <X className="size-3.5" />
                      Reject
                    </Button>
                  </div>
                </TableCell>
              ) : (
                <TableCell>
                  <Badge
                    className={
                      response.status === "approved"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                    }
                  >
                    {response.status}
                  </Badge>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" size="sm" render={<Link to="/forms" />}>
          <ArrowLeft className="size-4" />
          Back to forms
        </Button>
      </div>

      <Card className="overflow-hidden pt-0">
        <div className="h-2 w-full" style={{ backgroundColor: form.accent_color }} aria-hidden />
        <CardContent className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">{form.title}</h1>
              <Badge variant={form.is_active ? "secondary" : "outline"}>
                {form.is_active ? "Live" : "Closed"}
              </Badge>
            </div>
            {form.description && (
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">{form.description}</p>
            )}
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-medium text-amber-600">{pending.length} pending</span> ·{" "}
              {responses.filter((r) => r.status === "approved").length} accepted ·{" "}
              {responses.filter((r) => r.status === "rejected").length} rejected
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" render={<Link to={`/forms/${form.id}/edit`} />}>
              <Pencil className="size-4" />
              Edit form
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(publicUrl)
                toast.success("Form link copied")
              }}
            >
              <Copy className="size-4" />
              Copy link
            </Button>
            <Button
              variant="outline"
              render={<a href={publicUrl} target="_blank" rel="noreferrer" />}
            >
              <ExternalLink className="size-4" />
              Open
            </Button>
            <Button
              variant="outline"
              disabled={!responses.length}
              onClick={() =>
                exportToExcel(responses, exportColumns, `${form.slug}-responses`)
              }
            >
              <Download className="size-4" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">
            <BarChart3 className="size-3.5" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="audience">
            <UserRoundX className="size-3.5" />
            Who's missing
          </TabsTrigger>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="reviewed">Reviewed ({reviewed.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          {isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <FormSummary form={form} fields={fields} responses={responses} />
          )}
        </TabsContent>

        <TabsContent value="audience">
          <FormAudienceTab
            form={form}
            fields={fields}
            responses={responses}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex flex-col gap-3 p-6">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : pending.length === 0 ? (
                <EmptyState
                  title="Nothing waiting for review"
                  description="New submissions from the public form land here."
                  icon={FileText}
                />
              ) : (
                <ResponseTable rows={pending} showActions />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviewed">
          <Card>
            <CardContent className="p-0">
              {reviewed.length === 0 ? (
                <EmptyState title="No reviewed responses yet" icon={FileText} />
              ) : (
                <ResponseTable rows={reviewed} showActions={false} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* full response */}
      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Response</DialogTitle>
            <DialogDescription>
              Submitted {viewing && new Date(viewing.created_at).toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          {viewing?.review_note && (
            <div
              className={
                viewing.volunteer_id
                  ? "flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300"
              }
            >
              {viewing.volunteer_id ? (
                <UserRound className="mt-0.5 size-4 shrink-0" />
              ) : (
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              )}
              <span className="min-w-0">
                {viewing.review_note}
                {viewing.volunteer_id && (
                  <Link
                    to={`/volunteers/${viewing.volunteer_id}`}
                    className="ms-1 font-medium underline"
                  >
                    Open their profile
                  </Link>
                )}
              </span>
            </div>
          )}

          {/* Accepting a response writes it into the volunteer once and never
              again, so what it is about to write is worth seeing first — an
              answer that lands nowhere is otherwise only noticed weeks later,
              on a profile with a blank field. */}
          {viewing && form.destination !== "none" && <WillSave response={viewing} fields={fields} />}

          <div className="flex flex-col gap-3">
            {fields.map((field) => (
              <div key={field.id} className="rounded-lg border border-border p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {field.label}
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {answerText(viewing?.answers[field.id]) || "—"}
                </p>
              </div>
            ))}
          </div>

          {viewing?.status === "pending" && (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={reviewResponse.isPending}
                onClick={() => handleReview(viewing, "rejected")}
              >
                <X className="size-4" />
                Reject
              </Button>
              <Button
                disabled={reviewResponse.isPending}
                onClick={() => handleReview(viewing, "approved")}
              >
                <Check className="size-4" />
                Accept
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
