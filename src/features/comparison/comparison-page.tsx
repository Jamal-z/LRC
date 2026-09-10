import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeftRight, Download, GitCompareArrows, Users } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { EmptyState } from "@/components/shared/empty-state"
import { exportToExcel } from "@/lib/export"
import { useForms, useFormFields, useFormResponses } from "@/features/forms/use-forms"
import { MatchReviewList } from "./match-review"
import {
  comparePeople,
  identityFields,
  responsePerson,
  useConfirmMatch,
  useDismissMatch,
  useVolunteerRoster,
  type ComparisonRow,
  type RosterEntry,
} from "./use-matching"
import type { FormFieldRow, FormResponseRow } from "@/types/database.types"

/**
 * Two lists of people, side by side.
 *
 * Comparing raw names between two forms would compound every spelling problem
 * twice over, so nothing is compared name-to-name here: each side is first
 * resolved to actual volunteers — the roster is the common reference — and the
 * comparison itself then runs on volunteer records, which either are the same
 * person or aren't.
 */

const ROSTER = "roster"

interface ResolvedSide {
  label: string
  /** volunteers this list turned out to contain */
  people: RosterEntry[]
  /** names on this list that belong to nobody on the roster */
  strangers: ComparisonRow[]
  /** guesses a human still has to settle */
  review: ComparisonRow[]
  isLoading: boolean
}

/** Turns whichever list was picked into a set of volunteers. */
function useSide(value: string, roster: RosterEntry[], rosterLoading: boolean): ResolvedSide {
  const formId = value === ROSTER ? undefined : value
  const { data: forms = [] } = useForms()
  const { data: fields = [], isLoading: fieldsLoading } = useFormFields(formId)
  const { data: responses = [], isLoading: responsesLoading } = useFormResponses(formId)

  return useMemo(() => {
    if (value === ROSTER) {
      return {
        label: "Volunteer roster",
        people: roster,
        strangers: [],
        review: [],
        isLoading: rosterLoading,
      }
    }

    const form = forms.find((entry) => entry.id === formId)
    const keys = identityFields(fields as FormFieldRow[])
    const people = (responses as FormResponseRow[]).map((response) =>
      responsePerson(response, keys)
    )
    const confirmed = new Map(
      (responses as FormResponseRow[])
        .filter((response) => response.volunteer_id)
        .map((response) => [response.id, response.volunteer_id!])
    )
    const dismissed = new Set(
      (responses as FormResponseRow[])
        .filter((response) => response.match_dismissed)
        .map((response) => response.id)
    )
    const comparison = comparePeople(people, roster, confirmed, dismissed)

    // matched outright, plus the "very likely" ones — those still show up for
    // review, but leaving them out would make the totals read as wrong
    const ids = new Set(
      [...comparison.matched, ...comparison.review]
        .map((row) => row.match.target?.id)
        .filter(Boolean) as string[]
    )

    return {
      label: form?.title ?? "Form",
      people: roster.filter((entry) => ids.has(entry.id)),
      strangers: comparison.missing,
      review: comparison.review,
      isLoading: fieldsLoading || responsesLoading || rosterLoading,
    }
  }, [value, formId, forms, fields, responses, roster, rosterLoading, fieldsLoading, responsesLoading])
}

export function ComparisonPage() {
  const { roster, isLoading: rosterLoading } = useVolunteerRoster()
  const { data: forms = [], isLoading: formsLoading } = useForms()
  const confirmMatch = useConfirmMatch()
  const dismissMatch = useDismissMatch()

  const [left, setLeft] = useState(ROSTER)
  const [right, setRight] = useState(ROSTER)

  const sideA = useSide(left, roster, rosterLoading)
  const sideB = useSide(right, roster, rosterLoading)

  const result = useMemo(() => {
    const inB = new Set(sideB.people.map((entry) => entry.id))
    const inA = new Set(sideA.people.map((entry) => entry.id))
    return {
      onlyA: sideA.people.filter((entry) => !inB.has(entry.id)),
      onlyB: sideB.people.filter((entry) => !inA.has(entry.id)),
      both: sideA.people.filter((entry) => inB.has(entry.id)),
    }
  }, [sideA.people, sideB.people])

  const review = [...sideA.review, ...sideB.review]

  async function confirm(row: ComparisonRow, volunteerId: string) {
    try {
      await confirmMatch.mutateAsync({
        volunteerId,
        name: row.source.name,
        source: "Comparison",
        responseId: row.source.id,
      })
      toast.success("Match confirmed — this spelling is remembered from now on")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the match")
    }
  }

  const options = [
    { value: ROSTER, label: "Volunteer roster" },
    ...forms.map((form) => ({ value: form.id, label: form.title })),
  ]

  const loading = sideA.isLoading || sideB.isLoading || formsLoading

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Comparison</h1>
        <p className="text-sm text-muted-foreground">
          Put two lists next to each other — who is on both, and who is on only one. Names written
          in Arabic and in English are matched to the same person.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <p className="mb-1.5 text-sm font-medium text-foreground">First list</p>
            <Select value={left} onValueChange={(value) => setLeft(value ?? ROSTER)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="self-center sm:mb-1"
            title="Swap the two lists"
            onClick={() => {
              setLeft(right)
              setRight(left)
            }}
          >
            <ArrowLeftRight className="size-4" />
          </Button>

          <div className="flex-1">
            <p className="mb-1.5 text-sm font-medium text-foreground">Second list</p>
            <Select value={right} onValueChange={(value) => setRight(value ?? ROSTER)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {left === right ? (
        <Card>
          <CardContent>
            <EmptyState
              title="Pick two different lists"
              description="Comparing a list with itself has an easy answer."
              icon={GitCompareArrows}
            />
          </CardContent>
        </Card>
      ) : loading ? (
        <Skeleton className="h-72 w-full" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: `Only in ${sideA.label}`, count: result.onlyA.length },
              { label: "On both lists", count: result.both.length },
              { label: `Only in ${sideB.label}`, count: result.onlyB.length },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent>
                  <p className="truncate text-sm text-muted-foreground" title={stat.label}>
                    {stat.label}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                    {stat.count}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {review.length > 0 && (
            <Card>
              <CardContent className="flex flex-col gap-3">
                <div>
                  <p className="font-medium text-foreground">{review.length} to check</p>
                  <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
                    These names look like people on the roster. Confirming one teaches the system
                    that spelling for good — the counts above update as you go.
                  </p>
                </div>
                <MatchReviewList
                  rows={review}
                  roster={roster}
                  busy={confirmMatch.isPending || dismissMatch.isPending}
                  onConfirm={confirm}
                  onReject={(row) => dismissMatch.mutate(row.source.id)}
                />
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="onlyA">
            <TabsList>
              <TabsTrigger value="onlyA">Only in the first ({result.onlyA.length})</TabsTrigger>
              <TabsTrigger value="onlyB">Only in the second ({result.onlyB.length})</TabsTrigger>
              <TabsTrigger value="both">On both ({result.both.length})</TabsTrigger>
            </TabsList>

            {(
              [
                ["onlyA", result.onlyA, `only-in-${sideA.label}`],
                ["onlyB", result.onlyB, `only-in-${sideB.label}`],
                ["both", result.both, "on-both-lists"],
              ] as const
            ).map(([value, rows, fileName]) => (
              <TabsContent key={value} value={value}>
                <PeopleTable rows={rows} fileName={fileName} />
              </TabsContent>
            ))}
          </Tabs>

          {(sideA.strangers.length > 0 || sideB.strangers.length > 0) && (
            <Card>
              <CardContent className="flex flex-col gap-2">
                <div>
                  <p className="font-medium text-foreground">
                    {sideA.strangers.length + sideB.strangers.length} not on the roster
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    They answered, but no volunteer matches them by ID, phone, email or name — so
                    they are in neither column above.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[...sideA.strangers, ...sideB.strangers].map((row) => (
                    <Badge key={row.source.id} variant="outline">
                      {row.source.name || "(no name given)"}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

function PeopleTable({ rows, fileName }: { rows: RosterEntry[]; fileName: string }) {
  if (!rows.length) {
    return (
      <Card>
        <CardContent>
          <EmptyState title="Nobody here" description="This column is empty." icon={Users} />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-0">
        <div className="flex justify-end px-6 pt-6">
          <Button
            variant="outline"
            onClick={() =>
              exportToExcel(
                rows,
                [
                  { header: "Name", value: (row) => row.name },
                  { header: "Team", value: (row) => row.department ?? "" },
                  { header: "Phone", value: (row) => row.phone ?? "" },
                  { header: "Email", value: (row) => row.email ?? "" },
                  { header: "University ID", value: (row) => row.universityId ?? "" },
                ],
                fileName.replace(/\s+/g, "-").toLowerCase()
              )
            }
          >
            <Download className="size-4" />
            Export
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Phone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <Link
                    to={`/volunteers/${entry.id}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {entry.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{entry.department ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{entry.phone ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
