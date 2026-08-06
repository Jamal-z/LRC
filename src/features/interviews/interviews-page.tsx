import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Download, MessageSquareText, Plus, Star, Trash2, UserRoundPlus } from "lucide-react"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { exportToCsv, exportToExcel, type ExportColumn } from "@/lib/export"
import { cn } from "@/lib/utils"
import type { InterviewStatus } from "@/types/database.types"
import { InterviewFormDialog } from "./interview-form-dialog"
import {
  INTERVIEW_CRITERIA,
  INTERVIEW_STATUS_BADGE,
  INTERVIEW_STATUS_LABELS,
  interviewAverage,
  useConvertInterview,
  useDeleteInterview,
  useInterviews,
  useSetInterviewStatus,
  type InterviewWithRelations,
} from "./use-interviews"

const STATUS_ORDER: InterviewStatus[] = ["accepted", "maybe", "rejected"]

const EXPORT_COLUMNS: ExportColumn<InterviewWithRelations>[] = [
  { header: "Full Name", value: (i) => i.full_name },
  { header: "WhatsApp", value: (i) => i.phone },
  { header: "Email", value: (i) => i.email },
  { header: "University ID", value: (i) => i.university_id },
  { header: "Major", value: (i) => i.major },
  { header: "City", value: (i) => i.city },
  { header: "Team", value: (i) => i.departments?.name },
  { header: "Decision", value: (i) => INTERVIEW_STATUS_LABELS[i.status] },
  { header: "Average", value: (i) => interviewAverage(i.ratings)?.toFixed(2) },
  ...INTERVIEW_CRITERIA.map<ExportColumn<InterviewWithRelations>>((criterion) => ({
    header: criterion.label,
    value: (i) => i.ratings?.[criterion.key],
  })),
  { header: "Strengths", value: (i) => i.strengths },
  { header: "Concerns", value: (i) => i.concerns },
  { header: "Notes", value: (i) => i.notes },
  { header: "Interviewed By", value: (i) => i.profiles?.full_name },
  { header: "Interviewed On", value: (i) => i.interviewed_at },
  { header: "Became a volunteer", value: (i) => (i.converted_volunteer_id ? "Yes" : "") },
]

export function InterviewsPage() {
  const { data: interviews, isLoading } = useInterviews()
  const setStatus = useSetInterviewStatus()
  const convertInterview = useConvertInterview()
  const deleteInterview = useDeleteInterview()

  const [editing, setEditing] = useState<InterviewWithRelations | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState<InterviewWithRelations | null>(null)

  const byStatus = useMemo(() => {
    const groups: Record<InterviewStatus, InterviewWithRelations[]> = {
      accepted: [],
      maybe: [],
      rejected: [],
    }
    for (const interview of interviews ?? []) groups[interview.status].push(interview)
    return groups
  }, [interviews])

  function openNew() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(interview: InterviewWithRelations) {
    setEditing(interview)
    setDialogOpen(true)
  }

  async function handleStatus(interview: InterviewWithRelations, status: InterviewStatus) {
    try {
      await setStatus.mutateAsync({ id: interview.id, status })
      toast.success(`${interview.full_name} moved to ${INTERVIEW_STATUS_LABELS[status]}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update the decision")
    }
  }

  async function handleConvert(interview: InterviewWithRelations) {
    try {
      await convertInterview.mutateAsync(interview)
      toast.success(`${interview.full_name} is now an official volunteer`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add them as a volunteer")
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await deleteInterview.mutateAsync(deleting.id)
      toast.success(`${deleting.full_name}'s interview deleted`)
      setDeleting(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Interviews</h1>
          <p className="text-sm text-muted-foreground">
            Everyone we've interviewed for volunteering, sorted by decision. Accepted candidates
            can join the roster in one click.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" disabled={!interviews?.length} />}
            >
              <Download className="size-4" />
              Export
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => exportToExcel(interviews ?? [], EXPORT_COLUMNS, "interviews")}
              >
                Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => exportToCsv(interviews ?? [], EXPORT_COLUMNS, "interviews")}
              >
                CSV (.csv)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={openNew}>
            <Plus className="size-4" />
            New interview
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="accepted">
          <TabsList>
            {STATUS_ORDER.map((status) => (
              <TabsTrigger key={status} value={status}>
                {INTERVIEW_STATUS_LABELS[status]} ({byStatus[status].length})
              </TabsTrigger>
            ))}
          </TabsList>

          {STATUS_ORDER.map((status) => (
            <TabsContent key={status} value={status}>
              <Card>
                <CardContent className="p-0">
                  {byStatus[status].length === 0 ? (
                    <EmptyState
                      title={`Nothing under ${INTERVIEW_STATUS_LABELS[status].toLowerCase()}`}
                      description="Record an interview and file it here."
                      icon={MessageSquareText}
                    />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Candidate</TableHead>
                          <TableHead>WhatsApp</TableHead>
                          <TableHead>Team</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Interviewed</TableHead>
                          <TableHead className="w-56" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {byStatus[status].map((interview) => {
                          const average = interviewAverage(interview.ratings)
                          return (
                            <TableRow key={interview.id}>
                              <TableCell>
                                <button
                                  type="button"
                                  onClick={() => openEdit(interview)}
                                  className="text-left font-medium text-foreground hover:underline"
                                >
                                  {interview.full_name}
                                </button>
                                <p className="text-xs text-muted-foreground">
                                  {[interview.major, interview.city].filter(Boolean).join(" · ") ||
                                    "—"}
                                </p>
                              </TableCell>
                              <TableCell className="text-sm" dir="ltr">
                                {interview.phone ?? "—"}
                              </TableCell>
                              <TableCell className="text-sm">
                                {interview.departments?.name ?? "—"}
                              </TableCell>
                              <TableCell>
                                {average != null ? (
                                  <span className="inline-flex items-center gap-1 text-sm font-medium tabular-nums text-foreground">
                                    <Star className="size-3.5 fill-amber-400 text-amber-400" />
                                    {average.toFixed(1)}
                                  </span>
                                ) : (
                                  <span className="text-sm text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">
                                {new Date(interview.interviewed_at).toLocaleDateString()}
                                {interview.profiles?.full_name && (
                                  <p className="text-xs text-muted-foreground">
                                    by {interview.profiles.full_name}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-end gap-2">
                                  {interview.converted_volunteer_id ? (
                                    <Badge
                                      variant="secondary"
                                      render={
                                        <Link
                                          to={`/volunteers/${interview.converted_volunteer_id}`}
                                        />
                                      }
                                    >
                                      Volunteer
                                    </Badge>
                                  ) : (
                                    status === "accepted" && (
                                      <Button
                                        size="sm"
                                        onClick={() => handleConvert(interview)}
                                        disabled={convertInterview.isPending}
                                      >
                                        <UserRoundPlus className="size-3.5" />
                                        Add to volunteers
                                      </Button>
                                    )
                                  )}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger
                                      render={<Button size="sm" variant="outline" />}
                                    >
                                      Move
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {STATUS_ORDER.filter((s) => s !== status).map((s) => (
                                        <DropdownMenuItem
                                          key={s}
                                          onClick={() => handleStatus(interview, s)}
                                        >
                                          <span
                                            className={cn(
                                              "rounded px-1.5 py-0.5 text-xs font-medium",
                                              INTERVIEW_STATUS_BADGE[s]
                                            )}
                                          >
                                            {INTERVIEW_STATUS_LABELS[s]}
                                          </span>
                                        </DropdownMenuItem>
                                      ))}
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => openEdit(interview)}>
                                        Edit interview
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={() => setDeleting(interview)}
                                      >
                                        <Trash2 className="size-3.5" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}

      <InterviewFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        interview={editing}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.full_name}'s interview?</AlertDialogTitle>
            <AlertDialogDescription>
              The interview record and its scores are erased. If they already became a volunteer,
              that volunteer stays.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
