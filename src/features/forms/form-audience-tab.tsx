import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { CheckCheck, Download, TriangleAlert, UserRoundX, Users } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { exportToExcel } from "@/lib/export"
import { VOLUNTEER_STATUS_LABELS } from "@/lib/constants"
import { MatchReviewList } from "@/features/comparison/match-review"
import {
  comparePeople,
  identityFields,
  responsePerson,
  useConfirmMatch,
  useDismissMatch,
  useVolunteerRoster,
  type ComparisonRow,
  type RosterEntry,
} from "@/features/comparison/use-matching"
import { useDepartments } from "@/features/departments/use-departments"
import type { FormFieldRow, FormResponseRow, FormRow, VolunteerStatus } from "@/types/database.types"

/**
 * "110 filled it in and I have 140 volunteers — who are the other 30?"
 *
 * Answering that means deciding, for every response, which volunteer wrote it.
 * The certain ones (university ID, phone, a spelling somebody already
 * confirmed) are settled without asking; the rest are proposed here and
 * confirmed once, after which they are remembered for every future form.
 */

const ALL = "all"

export function FormAudienceTab({
  form,
  fields,
  responses,
  isLoading,
}: {
  form: FormRow
  fields: FormFieldRow[]
  responses: FormResponseRow[]
  isLoading?: boolean
}) {
  const { roster, isLoading: rosterLoading } = useVolunteerRoster()
  const { data: departments = [] } = useDepartments()
  const confirmMatch = useConfirmMatch()
  const dismissMatch = useDismissMatch()

  const [department, setDepartment] = useState(ALL)
  const [status, setStatus] = useState(ALL)

  // who was *expected* to fill it in — the whole roster, or one team of it
  const audience = useMemo(
    () =>
      roster.filter(
        (entry) =>
          (department === ALL || entry.department === department) &&
          (status === ALL || entry.status === status)
      ),
    [roster, department, status]
  )

  const keys = useMemo(() => identityFields(fields), [fields])

  const comparison = useMemo(() => {
    const people = responses.map((response) => responsePerson(response, keys))
    const confirmed = new Map(
      responses
        .filter((response) => response.volunteer_id)
        .map((response) => [response.id, response.volunteer_id!])
    )
    const dismissed = new Set(
      responses.filter((response) => response.match_dismissed).map((response) => response.id)
    )
    // matching always runs against the full roster: filtering the audience
    // decides who is *counted*, never who a response is allowed to belong to
    const full = comparePeople(people, roster, confirmed, dismissed)
    const inAudience = new Set(audience.map((entry) => entry.id))
    return {
      ...full,
      unmatchedTargets: full.unmatchedTargets.filter((target) => inAudience.has(target.id)),
    }
  }, [responses, keys, roster, audience])

  const responsesById = useMemo(
    () => new Map(responses.map((response) => [response.id, response])),
    [responses]
  )

  const submitted = audience.length - comparison.unmatchedTargets.length
  const percent = audience.length ? Math.round((submitted / audience.length) * 100) : 0

  const likely = comparison.review.filter(
    (row) => row.match.confidence === "strong" && row.match.target
  )

  async function confirm(row: ComparisonRow, volunteerId: string) {
    try {
      await confirmMatch.mutateAsync({
        volunteerId,
        name: row.source.name,
        source: form.title,
        responseId: row.source.id,
      })
      toast.success("Match confirmed — this spelling is remembered from now on")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the match")
    }
  }

  async function confirmAllLikely() {
    try {
      for (const row of likely) {
        await confirmMatch.mutateAsync({
          volunteerId: row.match.target!.id,
          name: row.source.name,
          source: form.title,
          responseId: row.source.id,
        })
      }
      toast.success(`${likely.length} matches confirmed`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save every match")
    }
  }

  if (isLoading || rosterLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!keys.full_name && !keys.university_id && !keys.phone && !keys.email) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            title="This form asks for nothing that identifies a person"
            description="Add a name, university ID, phone or email question — then the answers can be lined up against the volunteer roster."
            icon={TriangleAlert}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ---- how far along it is ---- */}
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Filled in by</p>
              <p className="text-2xl font-semibold tracking-tight text-foreground">
                {submitted} <span className="text-muted-foreground">of {audience.length}</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {comparison.unmatchedTargets.length} still to go
                {comparison.review.length > 0 &&
                  ` · ${comparison.review.length} to check below`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select value={department} onValueChange={(value) => setDepartment(value ?? ALL)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Every team</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.name}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={status} onValueChange={(value) => setStatus(value ?? ALL)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Every status</SelectItem>
                  {Object.entries(VOLUNTEER_STATUS_LABELS)
                    .filter(([value]) => value !== "archived")
                    .map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Progress value={percent} className="gap-1">
            <p className="w-full text-xs text-muted-foreground">{percent}% of this group</p>
          </Progress>
        </CardContent>
      </Card>

      {/* ---- guesses waiting on a human ---- */}
      {comparison.review.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">
                  {comparison.review.length} to check
                </p>
                <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
                  These look like people on the roster written a different way. Confirm one and the
                  spelling is remembered — every future form will match it on its own.
                </p>
              </div>
              {likely.length > 1 && (
                <Button
                  variant="outline"
                  disabled={confirmMatch.isPending}
                  onClick={confirmAllLikely}
                >
                  <CheckCheck className="size-4" />
                  Confirm the {likely.length} very likely
                </Button>
              )}
            </div>

            <MatchReviewList
              rows={comparison.review}
              roster={roster}
              busy={confirmMatch.isPending || dismissMatch.isPending}
              onConfirm={confirm}
              onReject={(row) => dismissMatch.mutate(row.source.id)}
            />
          </CardContent>
        </Card>
      )}

      {/* ---- the answer to the actual question ---- */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-6">
            <div>
              <p className="font-medium text-foreground">Hasn't filled it in</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {comparison.unmatchedTargets.length} volunteer
                {comparison.unmatchedTargets.length === 1 ? "" : "s"} in this group with no response
              </p>
            </div>
            <Button
              variant="outline"
              disabled={!comparison.unmatchedTargets.length}
              onClick={() =>
                exportToExcel(
                  comparison.unmatchedTargets as RosterEntry[],
                  [
                    { header: "Name", value: (row) => row.name },
                    { header: "Team", value: (row) => row.department ?? "" },
                    { header: "Phone", value: (row) => row.phone ?? "" },
                    { header: "Email", value: (row) => row.email ?? "" },
                    { header: "University ID", value: (row) => row.universityId ?? "" },
                  ],
                  `${form.slug}-not-submitted`
                )
              }
            >
              <Download className="size-4" />
              Export
            </Button>
          </div>

          {comparison.unmatchedTargets.length === 0 ? (
            <EmptyState
              title="Everybody in this group has answered"
              description="Nothing left to chase."
              icon={Users}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(comparison.unmatchedTargets as RosterEntry[]).map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Link
                        to={`/volunteers/${entry.id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {entry.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.department ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{entry.phone ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {VOLUNTEER_STATUS_LABELS[entry.status as VolunteerStatus] ?? entry.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ---- people who answered but are on no roster ---- */}
      {comparison.missing.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div>
              <p className="font-medium text-foreground">
                {comparison.missing.length} answered but aren't on the roster
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Nobody on the roster matches these, by ID, phone, email or name.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {comparison.missing.map((row) => {
                const response = responsesById.get(row.source.id)
                return (
                  <div
                    key={row.source.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        {row.source.name || "(no name given)"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[row.source.universityId, row.source.phone, row.source.email]
                          .filter(Boolean)
                          .join(" · ") || "no other details given"}
                        {response && ` · ${new Date(response.created_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        <UserRoundX className="size-3" />
                        Not on the roster
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
