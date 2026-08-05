import { Link } from "react-router-dom"
import {
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { useDeleteForm, useForms } from "./use-forms"

const DESTINATION_LABELS: Record<string, string> = {
  volunteers: "Accepted → Volunteers",
  event_participants: "Accepted → Event participants",
  none: "Records only",
}

export function FormsPage() {
  const { data: forms, isLoading } = useForms()
  const deleteForm = useDeleteForm()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Forms</h1>
          <p className="text-sm text-muted-foreground">
            Build your own forms, share the link, and review who applies — no spreadsheets needed.
          </p>
        </div>
        <Button render={<Link to="/forms/new" />}>
          <Plus className="size-4" />
          Create Form
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full" />
          ))}
        </div>
      ) : !forms?.length ? (
        <Card>
          <CardContent>
            <EmptyState
              title="No forms yet"
              description="Create your first form — for volunteer sign-ups, an event, or anything else."
              icon={FileText}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {forms.map((form) => {
            const pending = form.form_responses.filter((r) => r.status === "pending").length
            const approved = form.form_responses.filter((r) => r.status === "approved").length
            const publicUrl = `${window.location.origin}/f/${form.slug}`

            return (
              <Card key={form.id} className="overflow-hidden pt-0">
                <div
                  className="h-2 w-full"
                  style={{ backgroundColor: form.accent_color }}
                  aria-hidden
                />
                <CardContent className="flex h-full flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link
                        to={`/forms/${form.id}/responses`}
                        className="font-semibold text-foreground hover:underline"
                      >
                        {form.title}
                      </Link>
                      {form.description && (
                        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                          {form.description}
                        </p>
                      )}
                    </div>
                    <Badge variant={form.is_active ? "secondary" : "outline"}>
                      {form.is_active ? "Live" : "Closed"}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-3 text-sm">
                    <span className="inline-flex items-center gap-1.5 text-amber-600">
                      <Clock className="size-3.5" />
                      {pending} pending
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-emerald-600">
                      <CheckCircle2 className="size-3.5" />
                      {approved} accepted
                    </span>
                    <span className="text-muted-foreground">
                      {form.form_responses.length} total
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {DESTINATION_LABELS[form.destination] ?? form.destination}
                  </p>

                  <div className="mt-auto flex flex-wrap gap-2">
                    <Button size="sm" render={<Link to={`/forms/${form.id}/responses`} />}>
                      Responses
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      render={<Link to={`/forms/${form.id}/edit`} />}
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(publicUrl)
                        toast.success("Form link copied")
                      }}
                    >
                      <Copy className="size-3.5" />
                      Link
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Open form"
                      render={<a href={`/f/${form.slug}`} target="_blank" rel="noreferrer" />}
                    >
                      <ExternalLink className="size-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Delete form"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete "${form.title}" and all of its responses? This cannot be undone.`
                          )
                        ) {
                          deleteForm.mutate(form.id, {
                            onSuccess: () => toast.success("Form deleted"),
                            onError: (error) => toast.error(error.message),
                          })
                        }
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
