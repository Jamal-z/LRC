import { useEffect, useMemo } from "react"
import { CheckCircle2, Send } from "lucide-react"
import { LrcLogoPlate } from "@/components/shared/lrc-logo"
import {
  COVER_HEIGHTS,
  DENSITY_GAP,
  FONT_GOOGLE_FAMILY,
  RADIUS_PX,
  accentBackground,
  backgroundLayers,
  cardStyleProps,
  fontStack,
  inputSurface,
  maxWidthFor,
  questionStyleProps,
  resolveDesign,
  rgba,
  choiceListProps,
  choiceProps,
  sanitizeCss,
  scopeCss,
  sanitizeHtml,
  submitButtonProps,
  titleSizeFor,
} from "./form-design"
import type { FormDesign, FormFieldRow } from "@/types/database.types"

export type AnswerMap = Record<string, string | string[] | null>

export interface RenderableForm {
  title: string
  description: string | null
  accent_color: string
  cover_image_url: string | null
  success_message: string | null
  design: FormDesign | null
  custom_css: string | null
  custom_header_html: string | null
}

interface FormRendererProps {
  form: RenderableForm
  fields: FormFieldRow[]
  answers: AnswerMap
  errors: Record<string, string>
  onAnswer: (fieldId: string, value: string | string[] | null) => void
  onSubmit: (event: React.FormEvent) => void
  submitting?: boolean
  submitError?: string | null
  submitted?: boolean
  /** the builder's live preview: no font sheet, and the submit button is inert */
  preview?: boolean
}

/**
 * The text on one option.
 *
 * Wide cards exist for options that carry an explanation, and people write
 * those the same way every time: the name, a dash, then what it means. Split
 * on that dash and the card reads as a title with a line under it, without
 * asking anyone to fill in a second box.
 */
function ChoiceLabel({ option, asCard }: { option: string; asCard: boolean }) {
  const split = asCard ? option.match(/^(.{2,60}?)\s+[–—-]\s+(.+)$/s) : null
  if (!split) return <span style={{ fontSize: "0.95rem" }}>{option}</span>
  return (
    <span style={{ fontSize: "0.95rem" }}>
      <strong style={{ display: "block", fontWeight: 700 }}>{split[1]}</strong>
      <span style={{ opacity: 0.75, fontSize: "0.88rem" }}>{split[2]}</span>
    </span>
  )
}

/** Loads a Google font once per family, only on the real public page. */
function useGoogleFont(font: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const family = FONT_GOOGLE_FAMILY[font]
    if (!family) return
    const id = `lrc-font-${font}`
    if (document.getElementById(id)) return
    const link = document.createElement("link")
    link.id = id
    link.rel = "stylesheet"
    link.href = `https://fonts.googleapis.com/css2?family=${family}&display=swap`
    document.head.appendChild(link)
  }, [font, enabled])
}

export function FormRenderer({
  form,
  fields,
  answers,
  errors,
  onAnswer,
  onSubmit,
  submitting = false,
  submitError = null,
  submitted = false,
  preview = false,
}: FormRendererProps) {
  const d = useMemo(() => resolveDesign(form.design), [form.design])
  const accent = form.accent_color || "#2563eb"

  useGoogleFont(d.font, !preview)

  const answered = fields.filter((field) => {
    const value = answers[field.id]
    return Array.isArray(value) ? value.length > 0 : !!value && String(value).trim() !== ""
  }).length
  const progress = fields.length ? Math.round((answered / fields.length) * 100) : 0

  const radius = RADIUS_PX[d.radius] ?? RADIUS_PX.xl
  const inputRadius = `calc(${radius} * 0.6)`
  const gap = DENSITY_GAP[d.density] ?? DENSITY_GAP.comfortable
  const coverHeight = COVER_HEIGHTS[d.coverHeight] ?? COVER_HEIGHTS.lg
  const showCover = d.coverHeight !== "none" && !!form.cover_image_url && d.headerStyle !== "minimal"
  const isHero = d.headerStyle === "hero" && showCover

  const cssVars = {
    "--lrc-accent": accent,
    "--lrc-accent-to": d.accentTo,
    "--lrc-radius": radius,
    "--lrc-input-radius": inputRadius,
    "--lrc-heading": d.headingColor,
    "--lrc-body": d.bodyColor,
    "--lrc-question-text": d.questionTextColor,
    "--lrc-question-bg": d.questionBg,
    "--lrc-question-border": d.questionBorderColor,
    "--lrc-font": fontStack(d.font),
  } as React.CSSProperties

  // pinned to .lrc-page: the builder renders this preview in its own document,
  // so an unscoped skin would take the admin screen down with the form
  const scopedCss = form.custom_css ? scopeCss(sanitizeCss(form.custom_css), ".lrc-page", true) : ""
  const surface = inputSurface(d)

  function renderControl(field: FormFieldRow) {
    const value = answers[field.id]
    const invalid = !!errors[field.id]
    const controlStyle: React.CSSProperties = {
      borderRadius: inputRadius,
      background: surface.background,
      border: `1px solid ${invalid ? "#ef4444" : d.questionBorderColor}`,
      color: surface.color,
      width: "100%",
      padding: "0.7rem 0.9rem",
      fontSize: "0.95rem",
      fontFamily: "inherit",
      outline: "none",
    }

    const choiceStyle = (checked: boolean) =>
      choiceProps(d, accent, checked, surface, inputRadius)

    switch (field.field_type) {
      case "textarea":
        return (
          <textarea
            className="lrc-input"
            rows={4}
            style={{ ...controlStyle, resize: "vertical", minHeight: "6.5rem" }}
            value={(value as string) ?? ""}
            onChange={(e) => onAnswer(field.id, e.target.value)}
          />
        )

      case "select":
        return (
          <select
            className="lrc-input"
            style={{ ...controlStyle, appearance: "auto" }}
            value={(value as string) ?? ""}
            onChange={(e) => onAnswer(field.id, e.target.value || null)}
          >
            <option value="">اختر / Choose…</option>
            {field.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )

      case "radio":
        return (
          <div className="lrc-choices" style={choiceListProps(d)}>
            {field.options.map((option) => (
              <label key={option} className="lrc-choice" style={choiceStyle(value === option)}>
                <input
                  type="radio"
                  name={field.id}
                  checked={value === option}
                  style={{ accentColor: accent, width: "1.05rem", height: "1.05rem" }}
                  onChange={() => onAnswer(field.id, option)}
                />
                <ChoiceLabel option={option} asCard={d.choiceStyle === "card"} />
              </label>
            ))}
          </div>
        )

      case "checkbox": {
        const selected = Array.isArray(value) ? value : []
        return (
          <div className="lrc-choices" style={choiceListProps(d)}>
            {field.options.map((option) => (
              <label
                key={option}
                className="lrc-choice"
                style={choiceStyle(selected.includes(option))}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  style={{ accentColor: accent, width: "1.05rem", height: "1.05rem" }}
                  onChange={(e) =>
                    onAnswer(
                      field.id,
                      e.target.checked
                        ? [...selected, option]
                        : selected.filter((o) => o !== option)
                    )
                  }
                />
                <ChoiceLabel option={option} asCard={d.choiceStyle === "card"} />
              </label>
            ))}
          </div>
        )
      }

      default:
        return (
          <input
            className="lrc-input"
            type={
              field.field_type === "email"
                ? "email"
                : field.field_type === "number"
                  ? "number"
                  : field.field_type === "date"
                    ? "date"
                    : "text"
            }
            dir={field.field_type === "phone" || field.field_type === "email" ? "ltr" : undefined}
            style={controlStyle}
            value={(value as string) ?? ""}
            onChange={(e) => onAnswer(field.id, e.target.value)}
          />
        )
    }
  }

  const headline = (
    <div className="lrc-headline" style={{ textAlign: isHero ? "center" : "start" }}>
      <h1
        className="lrc-title"
        style={{
          margin: 0,
          fontSize: titleSizeFor(d.titleSize),
          lineHeight: 1.25,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: isHero ? "#ffffff" : d.headingColor,
          textShadow: isHero ? "0 2px 20px rgba(0,0,0,0.45)" : undefined,
        }}
      >
        {form.title}
      </h1>
      {form.description && (
        <p
          className="lrc-desc"
          style={{
            margin: "0.6rem 0 0",
            fontSize: "1rem",
            lineHeight: 1.8,
            color: isHero ? "rgba(255,255,255,0.92)" : d.bodyColor,
            textShadow: isHero ? "0 1px 12px rgba(0,0,0,0.5)" : undefined,
          }}
        >
          {form.description}
        </p>
      )}
    </div>
  )

  return (
    <div
      className="lrc-page"
      dir="rtl"
      style={{
        ...backgroundLayers(d),
        ...cssVars,
        fontFamily: "var(--lrc-font)",
        minHeight: preview ? "100%" : "100svh",
        padding: preview ? "1.5rem 1rem" : "2.5rem 1rem 3rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {scopedCss && <style dangerouslySetInnerHTML={{ __html: scopedCss }} />}

      {d.bgStyle === "glow" && (
        <>
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: "-16rem",
              insetInlineStart: "-12rem",
              width: "34rem",
              height: "34rem",
              borderRadius: "9999px",
              background: d.bgPatternColor,
              opacity: d.bgPatternOpacity / 100,
              filter: "blur(90px)",
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              bottom: "-18rem",
              insetInlineEnd: "-10rem",
              width: "30rem",
              height: "30rem",
              borderRadius: "9999px",
              background: d.accentTo,
              opacity: (d.bgPatternOpacity / 100) * 0.8,
              filter: "blur(90px)",
              pointerEvents: "none",
            }}
          />
        </>
      )}

      <div
        style={{
          position: "relative",
          maxWidth: maxWidthFor(d.width),
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
        }}
      >
        {d.showLogo && (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <LrcLogoPlate className="rounded-2xl px-3 py-2 shadow-md" logoClassName="h-9" />
          </div>
        )}

        {submitted ? (
          <div
            className="lrc-card"
            style={{
              ...cardStyleProps(d),
              padding: "3.5rem 2rem",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.9rem",
            }}
          >
            <div
              style={{
                width: "4.5rem",
                height: "4.5rem",
                borderRadius: "9999px",
                display: "grid",
                placeItems: "center",
                background: rgba("#10b981", 0.14),
                color: "#059669",
              }}
            >
              <CheckCircle2 style={{ width: "2.25rem", height: "2.25rem" }} />
            </div>
            <h2 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 700, color: d.headingColor }}>
              تم استلام طلبك! 🎉
            </h2>
            <p style={{ margin: 0, maxWidth: "30rem", color: d.bodyColor, lineHeight: 1.8 }}>
              {form.success_message ||
                "شكرًا لتسجيلك. فريق المركز سيراجع طلبك ويتواصل معك قريبًا."}
            </p>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            {/* hero: the cover fills the top with the title laid over it */}
            {isHero && (
              <div
                className="lrc-cover"
                style={{
                  position: "relative",
                  height: coverHeight,
                  borderRadius: radius,
                  overflow: "hidden",
                  marginBottom: "-4rem",
                }}
              >
                <img
                  src={form.cover_image_url ?? undefined}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: `linear-gradient(to top, ${rgba(accent, 0.78)}, ${rgba(
                      "#000000",
                      0.15 + d.coverOverlay / 200
                    )})`,
                  }}
                />
                <div
                  style={{ position: "absolute", insetInline: 0, bottom: "5rem", padding: "0 2rem" }}
                >
                  {headline}
                </div>
              </div>
            )}

            <div
              className="lrc-card"
              style={{ ...cardStyleProps(d), overflow: "hidden", position: "relative" }}
            >
              {/* banner / overlapping covers sit inside the card */}
              {showCover && !isHero && (
                <div
                  className="lrc-cover"
                  style={{
                    height: coverHeight,
                    position: "relative",
                    overflow: "hidden",
                    margin: d.headerStyle === "overlap" ? "0.75rem 0.75rem 0" : undefined,
                    borderRadius: d.headerStyle === "overlap" ? `calc(${radius} * 0.75)` : undefined,
                  }}
                >
                  <img
                    src={form.cover_image_url ?? undefined}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  {d.coverOverlay > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: rgba(accent, d.coverOverlay / 100),
                      }}
                    />
                  )}
                </div>
              )}

              {d.headerStyle !== "minimal" && (
                <div
                  aria-hidden
                  style={{
                    height: "0.4rem",
                    background: accentBackground(d, accent),
                    margin: d.headerStyle === "overlap" ? "0.75rem 0.75rem 0" : undefined,
                    borderRadius: d.headerStyle === "overlap" ? "9999px" : undefined,
                  }}
                />
              )}

              {d.progressBar && fields.length > 0 && (
                <div style={{ height: "3px", background: rgba(accent, 0.12) }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${progress}%`,
                      background: accentBackground(d, accent),
                      transition: d.animate ? "width 0.35s ease" : undefined,
                    }}
                  />
                </div>
              )}

              <form
                onSubmit={onSubmit}
                noValidate
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap,
                  padding: d.density === "airy" ? "2.5rem" : "1.75rem",
                }}
              >
                {form.custom_header_html && (
                  <div
                    className="lrc-header"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(form.custom_header_html) }}
                  />
                )}

                {!isHero && headline}

                {fields.map((field, index) => {
                  const split = d.questionStyle === "split"
                  return (
                    <div
                      key={field.id}
                      className="lrc-question"
                      style={{
                        ...questionStyleProps(d, accent),
                        display: split ? "grid" : "flex",
                        gridTemplateColumns: split ? "minmax(9rem, 15rem) 1fr" : undefined,
                        flexDirection: split ? undefined : "column",
                        gap: split ? "1.25rem" : "0.55rem",
                        alignItems: split ? "start" : undefined,
                      }}
                    >
                      <div>
                        <label
                          className="lrc-label"
                          style={{
                            display: "block",
                            fontWeight: 600,
                            fontSize: "0.98rem",
                            lineHeight: 1.7,
                            color: d.questionTextColor,
                          }}
                        >
                          {d.questionNumbers && (
                            <span
                              style={{
                                display: "inline-grid",
                                placeItems: "center",
                                width: "1.5rem",
                                height: "1.5rem",
                                marginInlineEnd: "0.5rem",
                                borderRadius: "9999px",
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                background: rgba(accent, 0.12),
                                color: accent,
                                verticalAlign: "middle",
                              }}
                            >
                              {index + 1}
                            </span>
                          )}
                          {field.label}
                          {field.is_required && <span style={{ color: "#ef4444" }}> *</span>}
                        </label>
                        {field.help_text && (
                          <p
                            className="lrc-hint"
                            style={{
                              margin: "0.3rem 0 0",
                              fontSize: "0.82rem",
                              lineHeight: 1.6,
                              color: rgba(d.questionTextColor, 0.65),
                            }}
                          >
                            {field.help_text}
                          </p>
                        )}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                        {renderControl(field)}
                        {errors[field.id] && (
                          <p style={{ margin: 0, fontSize: "0.82rem", color: "#dc2626" }}>
                            {errors[field.id]}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}

                {fields.length === 0 && (
                  <p style={{ color: d.bodyColor, fontSize: "0.9rem" }}>
                    لا توجد أسئلة بعد / No questions yet.
                  </p>
                )}

                {submitError && (
                  <p
                    style={{
                      margin: 0,
                      padding: "0.65rem 0.9rem",
                      borderRadius: inputRadius,
                      background: rgba("#ef4444", 0.1),
                      color: "#dc2626",
                      fontSize: "0.9rem",
                    }}
                  >
                    {submitError}
                  </p>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: d.buttonWidth === "full" ? "stretch" : "center",
                  }}
                >
                  <button
                    type="submit"
                    className="lrc-submit"
                    disabled={submitting || preview}
                    style={{
                      ...submitButtonProps(d, accent),
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.55rem",
                      padding: "0.95rem 1.75rem",
                      fontSize: "1.02rem",
                      fontWeight: 600,
                      fontFamily: "inherit",
                      cursor: submitting || preview ? "default" : "pointer",
                      opacity: submitting ? 0.7 : 1,
                    }}
                  >
                    <Send style={{ width: "1.15rem", height: "1.15rem" }} />
                    {d.buttonLabel || (submitting ? "جارٍ الإرسال…" : "إرسال / Submit")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <p
          style={{
            margin: 0,
            textAlign: "center",
            fontSize: "0.75rem",
            color: rgba(d.bodyColor, 0.7),
          }}
        >
          {d.footerNote || `Designed by Jamal Ilaiwi · LRC ${new Date().getFullYear()}`}
        </p>
      </div>
    </div>
  )
}

/** Shared so the public page and any preview validate identically. */
export function validateAnswers(fields: FormFieldRow[], answers: AnswerMap) {
  const errors: Record<string, string> = {}
  for (const field of fields) {
    const value = answers[field.id]
    const empty =
      value == null || (Array.isArray(value) ? value.length === 0 : String(value).trim() === "")
    if (field.is_required && empty) {
      errors[field.id] = "هذا الحقل مطلوب / This field is required"
      continue
    }
    if (!empty && field.field_type === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
        errors[field.id] = "بريد غير صالح / Invalid email"
      }
    }
  }
  return errors
}

/** Sample questions the designer preview falls back to before any are written. */
export function previewFields(): FormFieldRow[] {
  const base = {
    form_id: "preview",
    help_text: null,
    options: [] as string[],
    is_required: false,
    maps_to: null,
    created_at: "",
  }
  return [
    {
      ...base,
      id: "p1",
      label: "الاسم الرباعي / Full name",
      field_type: "text",
      position: 0,
      is_required: true,
    },
    {
      ...base,
      id: "p2",
      label: "رقم الواتساب / WhatsApp",
      field_type: "phone",
      position: 1,
      is_required: true,
    },
    {
      ...base,
      id: "p3",
      label: "الفريق الذي تريد التطوع فيه / Team you want to join",
      help_text: "اختر الفريق الأقرب لاهتمامك / Pick the closest one",
      field_type: "radio",
      options: [
        "تعليم / Teaching",
        "سوشال ميديا / Social media",
        "تصوير / Photography",
        "تنظيم فعاليات / Events",
      ],
      position: 2,
    },
    {
      ...base,
      id: "p4",
      label: "احكِ لنا عن نفسك / Tell us about yourself",
      field_type: "textarea",
      position: 3,
    },
  ] as FormFieldRow[]
}
