import { useState } from "react"
import { Link } from "react-router-dom"
import { Download, RotateCcw, Trash2, UserX } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EmptyState } from "@/components/shared/empty-state"
import { exportToCsv, exportToExcel, type ExportColumn } from "@/lib/export"
import { useAuth } from "@/features/auth/auth-context"
import {
  useDeleteVolunteer,
  useRestoreVolunteer,
  useTerminatedVolunteers,
  type VolunteerWithRelations,
} from "./use-volunteers"

const EXPORT_COLUMNS: ExportColumn<VolunteerWithRelations>[] = [
  { header: "Full Name", value: (v) => v.full_name },
  { header: "University ID", value: (v) => v.volunteer_private?.university_id },
  { header: "WhatsApp", value: (v) => v.volunteer_private?.phone },
  { header: "Email", value: (v) => v.volunteer_private?.email },
  { header: "Team (was)", value: (v) => v.departments?.name },
  {
    header: "Terminated On",
    value: (v) => (v.archived_at ? new Date(v.archived_at).toLocaleDateString() : ""),
  },
]

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function TerminationsPage() {
  const { profile } = useAuth()
  const { data: volunteers, isLoading } = useTerminatedVolunteers()
  const restoreVolunteer = useRestoreVolunteer()
  const deleteVolunteer = useDeleteVolunteer()
  const [deleting, setDeleting] = useState<VolunteerWithRelations | null>(null)

  const isAdmin = profile?.role === "super_admin" || profile?.role === "admin"

  async function handleRestore(volunteer: VolunteerWithRelations) {
    try {
      await restoreVolunteer.mutateAsync(volunteer.id)
      toast.success(`${volunteer.full_name} restored to volunteers`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to restore")
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await deleteVolunteer.mutateAsync(deleting.id)
      toast.success(`${deleting.full_name} deleted permanently`)
      setDeleting(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Terminations</h1>
          <p className="text-sm text-muted-foreground">
            Volunteers removed from the active roster. Restore them, or delete permanently.
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" disabled={!volunteers?.length} />}>
            <Download className="size-4" />
            Export
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => exportToExcel(volunteers ?? [], EXPORT_COLUMNS, "terminations")}
            >
              Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => exportToCsv(volunteers ?? [], EXPORT_COLUMNS, "terminations")}
            >
              CSV (.csv)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-3 p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !volunteers?.length ? (
            <EmptyState
              title="No terminated volunteers"
              description="Volunteers you terminate will appear here."
              icon={UserX}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>University ID</TableHead>
                  <TableHead>Major</TableHead>
                  <TableHead>Team (was)</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Terminated</TableHead>
                  <TableHead className="w-44" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {volunteers.map((volunteer) => (
                  <TableRow key={volunteer.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8 opacity-70">
                          {volunteer.photo_url && <AvatarImage src={volunteer.photo_url} />}
                          <AvatarFallback className="bg-muted text-xs text-muted-foreground">
                            {initials(volunteer.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <Link
                            to={`/volunteers/${volunteer.id}`}
                            className="font-medium text-foreground hover:underline"
                          >
                            {volunteer.full_name}
                          </Link>
                          {volunteer.volunteer_private?.email && (
                            <p className="text-xs text-muted-foreground">{volunteer.volunteer_private?.email}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{volunteer.volunteer_private?.university_id ?? "—"}</TableCell>
                    <TableCell className="text-sm">{volunteer.volunteer_private?.major ?? "—"}</TableCell>
                    <TableCell className="text-sm">{volunteer.departments?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm" dir="ltr">
                      {volunteer.volunteer_private?.phone ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {volunteer.archived_at
                        ? new Date(volunteer.archived_at).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleRestore(volunteer)}>
                          <RotateCcw className="size-3.5" />
                          Restore
                        </Button>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setDeleting(volunteer)}
                          >
                            <Trash2 className="size-3.5" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.full_name} permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This erases the volunteer and all their history (participation, hours, evaluations).
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
