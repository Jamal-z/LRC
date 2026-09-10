import { useEffect, useRef } from "react"
import { FIELD_INDEX_ATTR } from "./form-design"
import type { FormFieldRow } from "@/types/database.types"

/**
 * "The file is the form": the uploaded markup is the form.
 *
 * Redrawing somebody's HTML with our own elements can get close, never
 * identical — a table of languages against levels is a structure, not a set of
 * colours, and no amount of restyling turns a stack of radio buttons into one.
 * So here nothing is redrawn: the file's own markup is put on the page exactly
 * as written and the only thing added is the wiring that makes its controls
 * save an answer.
 *
 * That means React does not own these nodes. They are written once and left
 * alone; a single delegated listener reads whatever the visitor did and hands
 * it back, which is also why the fields stay responsive no matter how exotic
 * the markup around them is.
 */
/**
 * What a ticked option should be recorded as.
 *
 * The wording a person read is what belongs in the answer: `value="2"` beside
 * a pill that says "الثانية" would file the choice as "2" and leave the
 * summary counting an option nobody was offered. The visible text is what the
 * question's options were built from, so it is what an answer has to match;
 * the value only stands in when there is no wording, as in a grid cell.
 */
function optionText(input: HTMLInputElement) {
  const label = input.labels?.[0]?.textContent ?? input.closest("label")?.textContent ?? ""
  return label.replace(/\s+/g, " ").trim() || input.value.trim()
}

export function HtmlLayout({
  html,
  fields,
  onAnswer,
}: {
  html: string
  /** saved questions, in the order the file's controls were tagged */
  fields: FormFieldRow[]
  onAnswer: (fieldId: string, value: string | string[] | null) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  // read through a ref so the listener never goes stale and never re-binds
  const fieldsRef = useRef(fields)
  const answerRef = useRef(onAnswer)
  fieldsRef.current = fields
  answerRef.current = onAnswer

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function fieldFor(control: Element) {
      const index = Number(control.getAttribute(FIELD_INDEX_ATTR))
      return Number.isInteger(index) ? fieldsRef.current[index] : undefined
    }

    function handle(event: Event) {
      const target = event.target as HTMLElement | null
      const control = target?.closest?.(`[${FIELD_INDEX_ATTR}]`)
      if (!control) return

      const field = fieldFor(control)
      if (!field) return

      const input = control as HTMLInputElement

      if (input.type === "checkbox") {
        // a group of checkboxes is one answer, so read the whole group
        const group = container!.querySelectorAll<HTMLInputElement>(
          `input[type=checkbox][${FIELD_INDEX_ATTR}="${control.getAttribute(FIELD_INDEX_ATTR)}"]`
        )
        const ticked = [...group].filter((box) => box.checked).map(optionText).filter(Boolean)
        answerRef.current(field.id, ticked.length ? ticked : null)
        return
      }

      if (input.type === "radio") {
        answerRef.current(field.id, optionText(input) || null)
        return
      }

      answerRef.current(field.id, input.value.trim() ? input.value : null)
    }

    // one listener for the whole layout: "change" covers pickers and boxes,
    // "input" keeps typing in step as it happens
    container.addEventListener("change", handle)
    container.addEventListener("input", handle)
    return () => {
      container.removeEventListener("change", handle)
      container.removeEventListener("input", handle)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="lrc-html-layout"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
