import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Copy, ExternalLink, FileText, X } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { normalizeName } from "@/lib/names"
import { useAuth } from "@/features/auth/auth-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyState } from "@/components/shared/empty-state"
import type { FormSubmissionRow } from "@/types/database.types"

interface SubmissionWithDept extends FormSubmissionRow {
  departments: { id: string; name: string } | null
}

export function FormsPage() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  const { data: submissions, isLoading } = useQuery({
    queryKey: ["form-submissions"],
    queryFn: async (): Promise<SubmissionWithDept[]> => {
      const { data, error } = await supabase
        .from("form_submissions")
        .select("*, departments (id, name)")
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as unknown as SubmissionWithDept[]
    },
  })

  const approve = useMutation({
    mutationFn: async (submission: SubmissionWithDept) => {
      // duplicate check against existing volunteers before creating one
      const { data: existing } = await supabase.from("volunteers").select("id, full_name, phone, university_id")
      const isDuplicate = (existing ?? []).some(
        (v) =>
          (submission.university_id && v.university_id === submission.university_id) ||
          (submission.phone && v.phone === submission.phone) ||
          normalizeName(v.full_name) === normalizeName(submission.full_name)
      )
      if (isDuplicate) {
        throw new Error("A volunteer with the same name / university ID / phone already exists.")
      }

      const { error: insertError } = await supabase.from("volunteers").insert({
        full_name: submission.full_name,
        university_id: submission.university_id,
        major: submission.major,
        phone: submission.phone,
        email: submission.email,
        city: submission.city,
        primary_department_id: submission.department_id,
        languages: submission.languages,
        skills: submission.skills,
        availability: submission.availability,
        internal_notes: submission.notes,
        status: "new",
        birth_date: null,
        photo_url: null,
        emergency_contact_name: null,
        emergency_contact_phone: null,
      })
      if (insertError) throw insertError

      const { error: updateError } = await supabase
        .from("form_submissions")
        .update({ status: "approved", reviewed_by: profile?.id ?? null })
        .eq("id", submission.id)
      if (updateError) throw updateError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form-submissions"] })
      queryClient.invalidateQueries({ queryKey: ["volunteers"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success("Approved — volunteer created")
    },
    onError: (error) => toast.error(error.message),
  })

  const reject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("form_submissions")
        .update({ status: "rejected", reviewed_by: profile?.id ?? null })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["form-submissions"] })
      toast.success("Submission rejected")
    },
    onError: (error) => toast.error(error.message),
  })

  const joinUrl = `${window.location.origin}/join`
  const pending = submissions?.filter((s) => s.status === "pending") ?? []
  const reviewed = submissions?.filter((s) => s.status !== "pending") ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Forms</h1>
          <p className="text-sm text-muted-foreground">
            The volunteer registration form — data lands here instead of Google Sheets.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" />
            Volunteer registration form
          </CardTitle>
          <CardDescription>
            Share this link with anyone who wants to join. Submissions appear below for your review
            — approving one creates the volunteer automatically (with duplicate checking).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <code className="rounded-lg bg-muted px-3 py-2 text-sm" dir="ltr">
            {joinUrl}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(joinUrl)
              toast.success("Link copied")
            }}
          >
            <Copy className="size-3.5" />
            Copy link
          </Button>
          <Button variant="outline" size="sm" render={<a href="/join" target="_blank" rel="noreferrer" />}>
            <ExternalLink className="size-3.5" />
            Preview form
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending review ({pending.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-3 p-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : pending.length === 0 ? (
            <EmptyState
              title="No pending submissions"
              description="New registrations from the form will appear here."
              icon={FileText}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>University ID</TableHead>
                  <TableHead>Major</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="w-44" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell className="font-medium">{submission.full_name}</TableCell>
                    <TableCell>{submission.university_id ?? "—"}</TableCell>
                    <TableCell>{submission.major ?? "—"}</TableCell>
                    <TableCell>{submission.departments?.name ?? "—"}</TableCell>
                    <TableCell dir="ltr">{submission.phone ?? "—"}</TableCell>
                    <TableCell>{new Date(submission.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          disabled={approve.isPending}
                          onClick={() => approve.mutate(submission)}
                        >
                          <Check className="size-3.5" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={reject.isPending}
                          onClick={() => reject.mutate(submission.id)}
                        >
                          <X className="size-3.5" />
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {reviewed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reviewed ({reviewed.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviewed.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell className="font-medium">{submission.full_name}</TableCell>
                    <TableCell>{submission.departments?.name ?? "—"}</TableCell>
                    <TableCell>{new Date(submission.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          submission.status === "approved"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                            : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                        }
                      >
                        {submission.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
