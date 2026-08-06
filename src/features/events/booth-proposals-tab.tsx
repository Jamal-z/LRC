import { useRef, useState } from "react"
import { Check, FileUp, Package, Paperclip, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { EmptyState } from "@/components/shared/empty-state"
import { useAuth } from "@/features/auth/auth-context"
import {
  useBoothProposals,
  useDeleteBoothProposal,
  useReviewBoothProposal,
  useSaveBoothProposal,
} from "./use-booth-proposals"

const STATUS_BADGE: Record<string, string> = {
  submitted: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
}

/**
 * Where a booth leader submits their plan and asks for what they need.
 * Submitting notifies the committee.
 */
export function BoothProposalsTab({
  boothId,
  eventId,
  boothName,
  canSubmit,
}: {
  boothId: string
  eventId: string
  boothName: string
  canSubmit: boolean
}) {
  const { profile } = useAuth()
  const isAdmin = profile?.role === "super_admin" || profile?.role === "admin"
  const { data: proposals = [], isLoading } = useBoothProposals(boothId)
  const saveProposal = useSaveBoothProposal()
  const reviewProposal = useReviewBoothProposal()
  const deleteProposal = useDeleteBoothProposal()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [notes, setNotes] = useState("")
  const [requestedItems, setRequestedItems] = useState("")
  const [file, setFile] = useState<File | null>(null)

  async function handleSubmit() {
    if (title.trim().length < 2) {
      toast.error("Give the proposal a title")
      return
    }
    try {
      await saveProposal.mutateAsync({
        boothId,
        eventId,
        title: title.trim(),
        notes: notes || null,
        requestedItems: requestedItems || null,
        file,
        createdBy: profile?.id ?? null,
      })
      toast.success("Proposal submitted — the committee has been notified")
      setTitle("")
      setNotes("")
      setRequestedItems("")
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      setDialogOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit proposal")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Proposals & supply requests</CardTitle>
            <CardDescription>
              Upload the booth plan (PDF or Word) and list what you need — the committee is notified
              straight away.
            </CardDescription>
          </div>
          {canSubmit && (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" />
              New proposal
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : proposals.length === 0 ? (
            <EmptyState
              title="No proposals yet"
              description={
                canSubmit
                  ? "Submit your booth plan and the supplies you need."
                  : "The booth leader hasn't submitted anything yet."
              }
              icon={Package}
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {proposals.map((proposal) => (
                <li key={proposal.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{proposal.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        by {proposal.profiles?.full_name ?? "—"} ·{" "}
                        {new Date(proposal.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge className={STATUS_BADGE[proposal.status]}>{proposal.status}</Badge>
                  </div>

                  {proposal.notes && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {proposal.notes}
                    </p>
                  )}

                  {proposal.requested_items && (
                    <div className="mt-3 rounded-lg bg-muted/60 p-3">
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <Package className="size-3.5" />
                        Requested supplies
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                        {proposal.requested_items}
                      </p>
                    </div>
                  )}

                  {proposal.file_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      render={
                        <a href={proposal.file_url} target="_blank" rel="noreferrer" />
                      }
                    >
                      <Paperclip className="size-3.5" />
                      {proposal.file_name ?? "Attachment"}
                    </Button>
                  )}

                  {proposal.review_notes && (
                    <p className="mt-3 rounded-lg border border-border px-3 py-2 text-sm">
                      <span className="font-medium text-foreground">Committee note:</span>{" "}
                      <span className="text-muted-foreground">{proposal.review_notes}</span>
                    </p>
                  )}

                  {(isAdmin || proposal.created_by === profile?.id) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {isAdmin && proposal.status === "submitted" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() =>
                              reviewProposal.mutate(
                                {
                                  id: proposal.id,
                                  status: "approved",
                                  reviewNotes: null,
                                  reviewerId: profile?.id ?? null,
                                },
                                { onSuccess: () => toast.success("Proposal approved") }
                              )
                            }
                          >
                            <Check className="size-3.5" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const note = window.prompt("Why is it rejected? (optional)") ?? null
                              reviewProposal.mutate(
                                {
                                  id: proposal.id,
                                  status: "rejected",
                                  reviewNotes: note,
                                  reviewerId: profile?.id ?? null,
                                },
                                { onSuccess: () => toast.success("Proposal rejected") }
                              )
                            }}
                          >
                            <X className="size-3.5" />
                            Reject
                          </Button>
                        </>
                      )}
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Delete proposal"
                        onClick={() =>
                          deleteProposal.mutate(proposal, {
                            onSuccess: () => toast.success("Proposal deleted"),
                            onError: (error) => toast.error(error.message),
                          })
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New proposal — {boothName}</DialogTitle>
            <DialogDescription>
              The committee gets a notification as soon as you submit.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <Field>
              <FieldLabel htmlFor="bp-title">Title *</FieldLabel>
              <Input
                id="bp-title"
                placeholder="e.g. Culture booth plan"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="bp-notes">Notes / description</FieldLabel>
              <Textarea
                id="bp-notes"
                rows={4}
                placeholder="What the booth will do, how it will run…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="bp-items">Supplies you need</FieldLabel>
              <Textarea
                id="bp-items"
                rows={4}
                placeholder={"One per line, e.g.\n2 tables\n10 chairs\nProjector"}
                value={requestedItems}
                onChange={(e) => setRequestedItems(e.target.value)}
              />
              <FieldDescription>The committee will see this as a request list.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Attachment (PDF or Word)</FieldLabel>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border py-6 transition-colors hover:border-primary/50 hover:bg-accent/30">
                <FileUp className="size-5 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {file ? file.name : "Click to choose a file"}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </Field>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saveProposal.isPending}>
              {saveProposal.isPending ? "Submitting…" : "Submit proposal"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
