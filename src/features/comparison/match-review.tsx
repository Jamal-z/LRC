import { useMemo, useState } from "react"
import { Check, Search, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { compareNames, CONFIDENCE_LABELS, type MatchConfidence } from "@/lib/name-match"
import type { ComparisonRow, RosterEntry } from "./use-matching"

/**
 * The human half of matching.
 *
 * Reducing "محمد عليوي" and "Mohammad Ilaiwi" to the same sound is a good
 * guess and never a proof, so every guess is shown with what it was based on
 * and settled by a person — once. These components are that review step, used
 * both inside a single form and on the comparison page.
 */

const CONFIDENCE_STYLES: Record<MatchConfidence, string> = {
  exact: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  strong: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  possible: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  none: "bg-muted text-muted-foreground",
}

export function ConfidenceBadge({ confidence }: { confidence: MatchConfidence }) {
  return <Badge className={CONFIDENCE_STYLES[confidence]}>{CONFIDENCE_LABELS[confidence]}</Badge>
}

/* ------------------------------------------------------------------ *
 * Confirming one proposed match
 * ------------------------------------------------------------------ */

export function MatchReviewList({
  rows,
  roster,
  busy,
  onConfirm,
  onReject,
}: {
  rows: ComparisonRow[]
  roster: RosterEntry[]
  busy?: boolean
  onConfirm: (row: ComparisonRow, volunteerId: string) => void
  /** "this person genuinely isn't on the roster" */
  onReject?: (row: ComparisonRow) => void
}) {
  const [picking, setPicking] = useState<ComparisonRow | null>(null)

  return (
    <>
      <div className="flex flex-col gap-2">
        {rows.map((row) => {
          const candidates = row.match.target
            ? [{ target: row.match.target, reason: row.match.reason, score: row.match.score }]
            : row.match.runnersUp

          return (
            <div
              key={row.source.id}
              className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  {row.source.name || "(no name given)"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[row.source.universityId, row.source.phone, row.source.email]
                    .filter(Boolean)
                    .join(" · ") || "no other details given"}
                </p>
              </div>

              <div className="flex min-w-0 flex-col gap-2 sm:items-end">
                {candidates.map((candidate) => (
                  <div
                    key={candidate.target.id}
                    className="flex flex-wrap items-center justify-end gap-2"
                  >
                    <div className="min-w-0 text-end">
                      <p className="truncate text-sm text-foreground">{candidate.target.name}</p>
                      <p className="text-xs text-muted-foreground">{candidate.reason}</p>
                    </div>
                    <ConfidenceBadge
                      confidence={row.match.target ? row.match.confidence : "possible"}
                    />
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => onConfirm(row, candidate.target.id)}
                    >
                      <Check className="size-3.5" />
                      Yes, same person
                    </Button>
                  </div>
                ))}

                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPicking(row)}>
                    <Search className="size-3.5" />
                    Pick someone else
                  </Button>
                  {onReject && (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => onReject(row)}>
                      <X className="size-3.5" />
                      Not on the roster
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <RosterPicker
        open={!!picking}
        roster={roster}
        forName={picking?.source.name ?? ""}
        onClose={() => setPicking(null)}
        onPick={(volunteerId) => {
          if (picking) onConfirm(picking, volunteerId)
          setPicking(null)
        }}
      />
    </>
  )
}

/* ------------------------------------------------------------------ *
 * Choosing a volunteer by hand
 * ------------------------------------------------------------------ */

export function RosterPicker({
  open,
  roster,
  forName,
  onClose,
  onPick,
}: {
  open: boolean
  roster: RosterEntry[]
  /** the name being matched — the list is pre-sorted by how close it is */
  forName: string
  onClose: () => void
  onPick: (volunteerId: string) => void
}) {
  const [search, setSearch] = useState("")

  const results = useMemo(() => {
    const term = search.trim().toLowerCase()
    const filtered = term
      ? roster.filter(
          (entry) =>
            entry.name.toLowerCase().includes(term) ||
            (entry.aliases ?? []).some((alias) => alias.toLowerCase().includes(term)) ||
            (entry.department ?? "").toLowerCase().includes(term)
        )
      : roster
    if (term || !forName) return filtered.slice(0, 60)
    // no search yet: put the nearest-sounding names at the top
    return [...filtered]
      .map((entry) => ({ entry, score: compareNames(forName, entry.name).score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 60)
      .map(({ entry }) => entry)
  }, [roster, search, forName])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setSearch("")
          onClose()
        }
      }}
    >
      <DialogContent className="flex max-h-[80svh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Who is this?</DialogTitle>
          <DialogDescription>
            {forName ? `Find the volunteer behind "${forName}".` : "Pick a volunteer."}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search the roster"
            className="ps-9"
          />
        </div>

        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          {results.length === 0 ? (
            <EmptyState title="Nobody by that name" icon={Search} />
          ) : (
            <div className="flex flex-col gap-1">
              {results.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onPick(entry.id)}
                  className="flex items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-2 text-start transition-colors hover:border-border hover:bg-muted"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{entry.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[entry.department, entry.universityId, entry.phone]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </div>
                  <Check className="size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
