import type { CSSProperties } from "react"
import type { FormDesign } from "@/types/database.types"

/**
 * Everything about how a public form looks lives in one `design` object on
 * the form row. Nothing in it is required — `resolveDesign` fills in every
 * missing key — so new controls can be added without migrating old forms.
 */

export const DEFAULT_DESIGN: Required<FormDesign> = {
  preset: "aurora",

  width: "wide",
  density: "comfortable",
  radius: "xl",

  bgStyle: "mesh",
  bgFrom: "#eff6ff",
  bgVia: "#ffffff",
  bgTo: "#dbeafe",
  bgAngle: 160,
  bgPatternColor: "#2563eb",
  bgPatternOpacity: 8,
  bgImageUrl: null,
  bgImageOverlay: 55,

  cardStyle: "elevated",
  cardBg: "#ffffff",
  cardOpacity: 100,
  cardBorderColor: "#e2e8f0",
  cardShadow: "xl",

  questionStyle: "card",
  questionBg: "#f8fafc",
  questionBorderColor: "#e2e8f0",
  questionAccentBar: true,
  questionNumbers: true,
  questionTextColor: "#0f172a",
  choiceStyle: "box",
  choiceColumns: "auto",

  headingColor: "#0f172a",
  bodyColor: "#475569",
  font: "geist",
  titleSize: "lg",

  coverHeight: "lg",
  coverOverlay: 0,
  headerStyle: "banner",
  showLogo: true,

  buttonStyle: "solid",
  buttonRadius: "xl",
  buttonWidth: "full",
  buttonLabel: "",

  accentGradient: true,
  accentTo: "#0ea5e9",
  progressBar: true,
  animate: true,
  footerNote: "",
}

/* ------------------------------------------------------------------ */
/* Option lists — these drive the designer UI                          */
/* ------------------------------------------------------------------ */

export const WIDTH_OPTIONS = [
  { value: "narrow", label: "Narrow", px: "36rem" },
  { value: "normal", label: "Normal", px: "46rem" },
  { value: "wide", label: "Wide", px: "58rem" },
  { value: "xwide", label: "Extra wide", px: "72rem" },
  { value: "full", label: "Full width", px: "96rem" },
] as const

export const DENSITY_OPTIONS = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
  { value: "airy", label: "Airy" },
] as const

export const BG_STYLES = [
  { value: "solid", label: "Solid" },
  { value: "gradient", label: "Gradient" },
  { value: "mesh", label: "Soft mesh" },
  { value: "dots", label: "Dots" },
  { value: "grid", label: "Grid" },
  { value: "stripes", label: "Stripes" },
  { value: "waves", label: "Waves" },
  { value: "rings", label: "Rings" },
  { value: "glow", label: "Glow blobs" },
  { value: "image", label: "Image" },
] as const

export const CARD_STYLES = [
  { value: "elevated", label: "Elevated" },
  { value: "flat", label: "Flat" },
  { value: "outlined", label: "Outlined" },
  { value: "glass", label: "Glass" },
  { value: "none", label: "No card" },
] as const

export const QUESTION_STYLES = [
  { value: "card", label: "Card per question" },
  { value: "boxed", label: "Coloured box" },
  { value: "underline", label: "Underline" },
  { value: "flat", label: "No frame" },
  { value: "split", label: "Side by side" },
] as const

export const CHOICE_STYLES = [
  { value: "box", label: "Boxes" },
  { value: "pill", label: "Pills" },
  { value: "card", label: "Wide cards" },
  { value: "list", label: "Plain list" },
] as const

export const CHOICE_COLUMN_OPTIONS = [
  { value: "auto", label: "Fit" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
] as const

export const HEADER_STYLES = [
  { value: "banner", label: "Banner" },
  { value: "overlap", label: "Inset image" },
  { value: "hero", label: "Hero (title over image)" },
  { value: "minimal", label: "No cover" },
] as const

export const BUTTON_STYLES = [
  { value: "solid", label: "Solid" },
  { value: "gradient", label: "Gradient" },
  { value: "outline", label: "Outline" },
  { value: "soft", label: "Soft" },
  { value: "glow", label: "Glow" },
] as const

export const TITLE_SIZES = [
  { value: "sm", label: "Small", css: "1.5rem" },
  { value: "md", label: "Medium", css: "1.875rem" },
  { value: "lg", label: "Large", css: "2.35rem" },
  { value: "xl", label: "Huge", css: "3rem" },
] as const

export const FONT_OPTIONS = [
  { value: "geist", label: "Geist — default", stack: "'Geist Variable', system-ui, sans-serif" },
  { value: "cairo", label: "Cairo — modern Arabic", stack: "'Cairo', 'Geist Variable', sans-serif" },
  { value: "tajawal", label: "Tajawal — easy Arabic", stack: "'Tajawal', 'Geist Variable', sans-serif" },
  { value: "rubik", label: "Rubik — bold Arabic", stack: "'Rubik', 'Geist Variable', sans-serif" },
  {
    value: "ibmarabic",
    label: "IBM Plex Sans Arabic",
    stack: "'IBM Plex Sans Arabic', 'Geist Variable', sans-serif",
  },
  { value: "almarai", label: "Almarai — crisp Arabic", stack: "'Almarai', 'Geist Variable', sans-serif" },
  { value: "system", label: "System font", stack: "system-ui, -apple-system, sans-serif" },
] as const

/** Google Fonts families pulled in on the public page when selected. */
export const FONT_GOOGLE_FAMILY: Record<string, string | null> = {
  geist: null,
  system: null,
  cairo: "Cairo:wght@300;400;500;600;700",
  tajawal: "Tajawal:wght@300;400;500;700",
  rubik: "Rubik:wght@300;400;500;600;700",
  ibmarabic: "IBM+Plex+Sans+Arabic:wght@300;400;500;600;700",
  almarai: "Almarai:wght@300;400;700",
}

export const RADIUS_OPTIONS = [
  { value: "none", label: "Square" },
  { value: "sm", label: "Slight" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
  { value: "xl", label: "Extra large" },
  { value: "2xl", label: "Very round" },
] as const

export const RADIUS_PX: Record<string, string> = {
  none: "0px",
  sm: "6px",
  md: "10px",
  lg: "14px",
  xl: "20px",
  "2xl": "28px",
  pill: "9999px",
}

export const SHADOW_OPTIONS = [
  { value: "none", label: "No shadow" },
  { value: "sm", label: "Subtle" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
  { value: "xl", label: "Soft and wide" },
  { value: "glow", label: "Accent glow" },
] as const

export const SHADOWS: Record<string, string> = {
  none: "none",
  sm: "0 1px 2px rgb(15 23 42 / 0.06)",
  md: "0 6px 16px -4px rgb(15 23 42 / 0.10)",
  lg: "0 18px 40px -12px rgb(15 23 42 / 0.18)",
  xl: "0 32px 70px -20px rgb(15 23 42 / 0.28)",
  glow: "0 0 0 1px rgb(255 255 255 / 0.5), 0 30px 80px -24px var(--lrc-accent)",
}

export const COVER_HEIGHT_OPTIONS = [
  { value: "none", label: "No image" },
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
  { value: "hero", label: "Huge (fills the top)" },
] as const

export const COVER_HEIGHTS: Record<string, string> = {
  none: "0rem",
  sm: "10rem",
  md: "16rem",
  lg: "22rem",
  hero: "30rem",
}

export const DENSITY_GAP: Record<string, string> = {
  compact: "0.75rem",
  comfortable: "1.25rem",
  airy: "2rem",
}

/* ------------------------------------------------------------------ */
/* Presets — a one-click starting point that anything can be tweaked from */
/* ------------------------------------------------------------------ */

export interface DesignPreset {
  value: string
  label: string
  description: string
  accent: string
  design: Partial<FormDesign>
}

export const DESIGN_PRESETS: DesignPreset[] = [
  {
    value: "aurora",
    label: "Aurora",
    description: "Soft blue wash with white cards — closest to the centre brand",
    accent: "#2563eb",
    design: {
      bgStyle: "mesh",
      bgFrom: "#eff6ff",
      bgVia: "#ffffff",
      bgTo: "#dbeafe",
      bgPatternColor: "#2563eb",
      cardStyle: "elevated",
      cardBg: "#ffffff",
      cardShadow: "xl",
      questionStyle: "card",
      questionBg: "#f8fafc",
      questionBorderColor: "#e2e8f0",
      questionTextColor: "#0f172a",
      radius: "xl",
      accentGradient: true,
      accentTo: "#0ea5e9",
      headingColor: "#0f172a",
      bodyColor: "#475569",
      coverHeight: "lg",
      headerStyle: "banner",
      buttonStyle: "gradient",
    },
  },
  {
    value: "sunrise",
    label: "Sunrise",
    description: "Warm and lively — orange and gold, a tinted box per question",
    accent: "#f97316",
    design: {
      bgStyle: "glow",
      bgFrom: "#fff7ed",
      bgVia: "#fffbeb",
      bgTo: "#ffedd5",
      bgPatternColor: "#fb923c",
      bgPatternOpacity: 22,
      cardStyle: "elevated",
      cardBg: "#ffffff",
      cardShadow: "lg",
      questionStyle: "boxed",
      questionBg: "#fff7ed",
      questionBorderColor: "#fed7aa",
      questionTextColor: "#431407",
      radius: "2xl",
      accentGradient: true,
      accentTo: "#f59e0b",
      headingColor: "#431407",
      bodyColor: "#9a3412",
      coverHeight: "lg",
      headerStyle: "overlap",
      buttonStyle: "gradient",
    },
  },
  {
    value: "midnight",
    label: "Midnight",
    description: "Dark and sharp — a glass card on navy with a glow",
    accent: "#38bdf8",
    design: {
      bgStyle: "glow",
      bgFrom: "#020617",
      bgVia: "#0b1220",
      bgTo: "#0f172a",
      bgPatternColor: "#38bdf8",
      bgPatternOpacity: 26,
      cardStyle: "glass",
      cardBg: "#0f172a",
      cardOpacity: 72,
      cardBorderColor: "#1e293b",
      cardShadow: "glow",
      questionStyle: "boxed",
      questionBg: "#111c33",
      questionBorderColor: "#1e293b",
      questionTextColor: "#e2e8f0",
      headingColor: "#f8fafc",
      bodyColor: "#94a3b8",
      radius: "xl",
      accentGradient: true,
      accentTo: "#818cf8",
      coverHeight: "lg",
      headerStyle: "hero",
      buttonStyle: "glow",
    },
  },
  {
    value: "mint",
    label: "Mint",
    description: "Calm, clean green — underlines instead of boxes",
    accent: "#059669",
    design: {
      bgStyle: "dots",
      bgFrom: "#ecfdf5",
      bgVia: "#f0fdfa",
      bgTo: "#d1fae5",
      bgPatternColor: "#059669",
      cardStyle: "outlined",
      cardBg: "#ffffff",
      cardBorderColor: "#a7f3d0",
      cardShadow: "md",
      questionStyle: "underline",
      questionBg: "#ffffff",
      questionBorderColor: "#a7f3d0",
      questionTextColor: "#064e3b",
      radius: "lg",
      accentGradient: true,
      accentTo: "#14b8a6",
      headingColor: "#064e3b",
      bodyColor: "#047857",
      coverHeight: "md",
      headerStyle: "banner",
      buttonStyle: "solid",
    },
  },
  {
    value: "paper",
    label: "Paper",
    description: "As plain as it gets — white paper, generous spacing",
    accent: "#0f172a",
    design: {
      bgStyle: "solid",
      bgFrom: "#f8fafc",
      bgVia: "#f8fafc",
      bgTo: "#f8fafc",
      cardStyle: "flat",
      cardBg: "#ffffff",
      cardShadow: "none",
      questionStyle: "flat",
      questionBg: "transparent",
      questionAccentBar: false,
      questionTextColor: "#0f172a",
      radius: "md",
      accentGradient: false,
      headingColor: "#0f172a",
      bodyColor: "#64748b",
      coverHeight: "sm",
      headerStyle: "minimal",
      density: "airy",
      buttonStyle: "solid",
    },
  },
  {
    value: "grape",
    label: "Grape",
    description: "Bold violet over a faint grid",
    accent: "#7c3aed",
    design: {
      bgStyle: "grid",
      bgFrom: "#faf5ff",
      bgVia: "#f5f3ff",
      bgTo: "#ede9fe",
      bgPatternColor: "#7c3aed",
      cardStyle: "elevated",
      cardBg: "#ffffff",
      cardShadow: "xl",
      questionStyle: "card",
      questionBg: "#faf5ff",
      questionBorderColor: "#ddd6fe",
      questionTextColor: "#2e1065",
      radius: "2xl",
      accentGradient: true,
      accentTo: "#ec4899",
      headingColor: "#2e1065",
      bodyColor: "#6d28d9",
      coverHeight: "lg",
      headerStyle: "overlap",
      buttonStyle: "gradient",
    },
  },
  {
    value: "sand",
    label: "Sand",
    description: "Earthy and quiet — sand tones and diagonal stripes",
    accent: "#b45309",
    design: {
      bgStyle: "stripes",
      bgFrom: "#fefce8",
      bgVia: "#fef9c3",
      bgTo: "#fef3c7",
      bgPatternColor: "#b45309",
      bgPatternOpacity: 6,
      cardStyle: "outlined",
      cardBg: "#fffdf7",
      cardBorderColor: "#fde68a",
      cardShadow: "md",
      questionStyle: "split",
      questionBg: "#fffbeb",
      questionBorderColor: "#fde68a",
      questionTextColor: "#451a03",
      radius: "lg",
      accentGradient: false,
      headingColor: "#451a03",
      bodyColor: "#78350f",
      coverHeight: "md",
      headerStyle: "banner",
      buttonStyle: "solid",
    },
  },
  {
    value: "ocean",
    label: "Ocean",
    description: "Blue waves under a glass card — modern and lively",
    accent: "#0284c7",
    design: {
      bgStyle: "waves",
      bgFrom: "#0c4a6e",
      bgVia: "#0369a1",
      bgTo: "#0ea5e9",
      bgPatternColor: "#ffffff",
      bgPatternOpacity: 30,
      cardStyle: "glass",
      cardBg: "#ffffff",
      cardOpacity: 94,
      cardBorderColor: "#bae6fd",
      cardShadow: "xl",
      questionStyle: "card",
      questionBg: "#f0f9ff",
      questionBorderColor: "#bae6fd",
      questionTextColor: "#0c4a6e",
      radius: "2xl",
      accentGradient: true,
      accentTo: "#06b6d4",
      headingColor: "#0c4a6e",
      bodyColor: "#0369a1",
      coverHeight: "hero",
      headerStyle: "hero",
      buttonStyle: "gradient",
    },
  },
  {
    value: "rose",
    label: "Rose",
    description: "Warm pink on cream — friendly, good for sign-ups and events",
    accent: "#e11d48",
    design: {
      bgStyle: "glow",
      bgFrom: "#fff1f2",
      bgVia: "#fffbeb",
      bgTo: "#ffe4e6",
      bgPatternColor: "#fb7185",
      bgPatternOpacity: 22,
      cardStyle: "elevated",
      cardBg: "#fffdfd",
      cardOpacity: 100,
      cardBorderColor: "#fecdd3",
      cardShadow: "lg",
      questionStyle: "boxed",
      questionBg: "#fff1f2",
      questionBorderColor: "#fecdd3",
      questionTextColor: "#4c0519",
      questionAccentBar: true,
      radius: "2xl",
      accentGradient: true,
      accentTo: "#f59e0b",
      headingColor: "#881337",
      bodyColor: "#9f1239",
      titleSize: "lg",
      headerStyle: "overlap",
      buttonStyle: "gradient",
      buttonRadius: "pill",
    },
  },
  {
    value: "slate",
    label: "Slate",
    description: "Quiet grey, sharp edges — formal reports and official forms",
    accent: "#0f172a",
    design: {
      bgStyle: "solid",
      bgFrom: "#f1f5f9",
      bgVia: "#f1f5f9",
      bgTo: "#f1f5f9",
      cardStyle: "outlined",
      cardBg: "#ffffff",
      cardOpacity: 100,
      cardBorderColor: "#cbd5e1",
      cardShadow: "none",
      questionStyle: "underline",
      questionBg: "#ffffff",
      questionBorderColor: "#cbd5e1",
      questionTextColor: "#0f172a",
      questionAccentBar: false,
      questionNumbers: true,
      radius: "sm",
      accentGradient: false,
      headingColor: "#0f172a",
      bodyColor: "#475569",
      density: "compact",
      width: "normal",
      titleSize: "md",
      headerStyle: "minimal",
      buttonStyle: "solid",
      buttonRadius: "sm",
      buttonWidth: "auto",
      progressBar: false,
      animate: false,
    },
  },
]

/* ------------------------------------------------------------------ */
/* Resolution + computed styles                                        */
/* ------------------------------------------------------------------ */

export function resolveDesign(design: FormDesign | null | undefined): Required<FormDesign> {
  return { ...DEFAULT_DESIGN, ...(design ?? {}) }
}

export function applyPreset(preset: DesignPreset): Required<FormDesign> {
  return { ...DEFAULT_DESIGN, ...preset.design, preset: preset.value }
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = (hex || "#000000").replace("#", "")
  const full =
    clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean.padEnd(6, "0").slice(0, 6)
  const n = Number.parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgba(hex: string, alpha: number) {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Readable text colour (near-black or white) for a given background. */
export function contrastText(hex: string) {
  const [r, g, b] = hexToRgb(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "#0f172a" : "#ffffff"
}

/** The page background behind the form card. */
export function backgroundLayers(d: Required<FormDesign>): CSSProperties {
  const pattern = rgba(d.bgPatternColor, d.bgPatternOpacity / 100)
  const base = `linear-gradient(${d.bgAngle}deg, ${d.bgFrom}, ${d.bgVia}, ${d.bgTo})`

  switch (d.bgStyle) {
    case "solid":
      return { background: d.bgFrom }
    case "gradient":
      return { background: base }
    case "mesh":
      return {
        background: [
          `radial-gradient(at 15% 8%, ${rgba(d.bgVia, 0.95)} 0px, transparent 55%)`,
          `radial-gradient(at 85% 4%, ${rgba(d.bgTo, 0.85)} 0px, transparent 50%)`,
          `radial-gradient(at 78% 92%, ${rgba(d.bgFrom, 0.9)} 0px, transparent 55%)`,
          `radial-gradient(at 8% 88%, ${rgba(d.bgTo, 0.65)} 0px, transparent 50%)`,
          base,
        ].join(", "),
      }
    case "dots":
      return {
        background: `radial-gradient(${pattern} 1.5px, transparent 1.6px), ${base}`,
        backgroundSize: "22px 22px, auto",
      }
    case "grid":
      return {
        background: [
          `linear-gradient(${pattern} 1px, transparent 1px)`,
          `linear-gradient(90deg, ${pattern} 1px, transparent 1px)`,
          base,
        ].join(", "),
        backgroundSize: "36px 36px, 36px 36px, auto",
      }
    case "stripes":
      return {
        background: `repeating-linear-gradient(45deg, ${pattern} 0 10px, transparent 10px 26px), ${base}`,
      }
    case "waves":
      return {
        background: [
          `radial-gradient(130% 55% at 50% 105%, ${rgba(d.bgPatternColor, 0.16)} 0%, transparent 62%)`,
          `radial-gradient(95% 45% at 18% -5%, ${rgba(d.bgPatternColor, 0.13)} 0%, transparent 60%)`,
          `radial-gradient(95% 45% at 88% 30%, ${rgba(d.bgPatternColor, 0.1)} 0%, transparent 60%)`,
          base,
        ].join(", "),
      }
    case "rings":
      return {
        background: `repeating-radial-gradient(circle at 50% 0%, ${pattern} 0 1px, transparent 1px 46px), ${base}`,
      }
    case "glow":
      // the coloured blobs are drawn as elements on top; the base stays flat
      return { background: base }
    case "image":
      return d.bgImageUrl
        ? {
            backgroundImage: `linear-gradient(${d.bgAngle}deg, ${rgba(
              d.bgFrom,
              d.bgImageOverlay / 100
            )}, ${rgba(d.bgTo, d.bgImageOverlay / 100)}), url(${d.bgImageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }
        : { background: base }
    default:
      return { background: base }
  }
}

export function cardStyleProps(d: Required<FormDesign>): CSSProperties {
  const radius = RADIUS_PX[d.radius] ?? RADIUS_PX.xl
  const bg = d.cardOpacity >= 100 ? d.cardBg : rgba(d.cardBg, d.cardOpacity / 100)

  switch (d.cardStyle) {
    case "flat":
      return { background: bg, borderRadius: radius, boxShadow: "none" }
    case "outlined":
      return {
        background: bg,
        borderRadius: radius,
        border: `1.5px solid ${d.cardBorderColor}`,
        boxShadow: SHADOWS[d.cardShadow] ?? "none",
      }
    case "glass":
      return {
        background: rgba(d.cardBg, Math.min(d.cardOpacity, 88) / 100),
        borderRadius: radius,
        border: `1px solid ${rgba(d.cardBorderColor, 0.65)}`,
        boxShadow: SHADOWS[d.cardShadow] ?? SHADOWS.xl,
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
      }
    case "none":
      return { background: "transparent", borderRadius: radius, boxShadow: "none" }
    default:
      return { background: bg, borderRadius: radius, boxShadow: SHADOWS[d.cardShadow] ?? SHADOWS.xl }
  }
}

export function questionStyleProps(d: Required<FormDesign>, accent: string): CSSProperties {
  const radius = RADIUS_PX[d.radius] ?? RADIUS_PX.xl
  const inner = `calc(${radius} * 0.72)`

  switch (d.questionStyle) {
    case "boxed":
      return {
        background: d.questionBg,
        border: `1px solid ${d.questionBorderColor}`,
        borderRadius: inner,
        padding: "1rem 1.15rem",
      }
    case "underline":
      return {
        background: "transparent",
        borderBottom: `1.5px solid ${d.questionBorderColor}`,
        borderRadius: "0",
        padding: "0 0 1.1rem",
      }
    case "flat":
      return { background: "transparent", padding: "0" }
    case "split":
      return {
        background: d.questionBg,
        border: `1px solid ${d.questionBorderColor}`,
        borderRadius: inner,
        padding: "1rem 1.15rem",
      }
    default:
      return {
        background: d.questionBg,
        border: `1px solid ${d.questionBorderColor}`,
        borderRadius: inner,
        padding: "1.15rem 1.25rem",
        boxShadow: d.questionAccentBar ? `inset -3px 0 0 0 ${accent}` : undefined,
      }
  }
}

/** True when a colour is dark enough that white text reads better on it. */
/**
 * How a set of choices is laid out.
 *
 * Options are wildly uneven — "نعم" beside a whole sentence — so the default
 * lets the row fill itself: short answers sit side by side and long ones take
 * the width they need, instead of one stack of mostly-empty rows.
 */
export function choiceListProps(d: Required<FormDesign>): CSSProperties {
  const gap = d.choiceStyle === "pill" ? "0.5rem" : "0.6rem"

  if (d.choiceStyle === "card" || d.choiceColumns === "1") {
    return { display: "grid", gap, gridTemplateColumns: "1fr" }
  }
  if (d.choiceColumns === "auto") {
    // pills hug their text; boxes line up in whatever fits at ~14rem
    return d.choiceStyle === "pill" || d.choiceStyle === "list"
      ? { display: "flex", flexWrap: "wrap", gap }
      : { display: "grid", gap, gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))" }
  }
  return { display: "grid", gap, gridTemplateColumns: `repeat(${d.choiceColumns}, minmax(0, 1fr))` }
}

/** One selectable option, in the shape the designer asked for. */
export function choiceProps(
  d: Required<FormDesign>,
  accent: string,
  checked: boolean,
  surface: { background: string; color: string },
  inputRadius: string
): CSSProperties {
  const base: CSSProperties = {
    display: "flex",
    alignItems: d.choiceStyle === "card" ? "flex-start" : "center",
    gap: "0.65rem",
    cursor: "pointer",
    color: surface.color,
    transition: d.animate ? "all 0.15s ease" : undefined,
  }

  if (d.choiceStyle === "list") {
    return { ...base, padding: "0.25rem 0", background: "transparent", border: "none" }
  }

  const border = `2px solid ${checked ? accent : d.questionBorderColor}`
  const background = checked ? rgba(accent, 0.12) : surface.background

  if (d.choiceStyle === "pill") {
    return {
      ...base,
      padding: "0.6rem 1.1rem",
      borderRadius: "9999px",
      border,
      background,
      fontSize: "0.9rem",
      fontWeight: 500,
    }
  }

  if (d.choiceStyle === "card") {
    return {
      ...base,
      padding: "0.85rem 1rem",
      borderRadius: inputRadius,
      border,
      background,
      lineHeight: 1.6,
      boxShadow: checked ? `0 8px 20px -12px ${accent}` : undefined,
    }
  }

  return { ...base, padding: "0.7rem 0.9rem", borderRadius: inputRadius, border, background }
}

export function isDark(hex: string) {
  return contrastText(hex) === "#ffffff"
}

/**
 * Inputs have to sit on whatever surface the question block ended up with.
 * On a light form that is plain white; on a dark one a bright white box is
 * blinding, so the input borrows the surface and lightens slightly instead.
 */
export function inputSurface(d: Required<FormDesign>) {
  const surface =
    d.questionStyle === "flat" || d.questionStyle === "underline" || d.questionBg === "transparent"
      ? d.cardBg
      : d.questionBg

  if (!isDark(surface)) {
    return { background: "#ffffff", color: "#0f172a", placeholder: "#94a3b8" }
  }
  return {
    background: rgba("#ffffff", 0.07),
    color: "#f1f5f9",
    placeholder: rgba("#f1f5f9", 0.45),
  }
}

export function accentBackground(d: Required<FormDesign>, accent: string) {
  return d.accentGradient ? `linear-gradient(135deg, ${accent}, ${d.accentTo})` : accent
}

export function submitButtonProps(d: Required<FormDesign>, accent: string): CSSProperties {
  const radius = RADIUS_PX[d.buttonRadius] ?? RADIUS_PX.xl
  const base: CSSProperties = {
    borderRadius: radius,
    width: d.buttonWidth === "full" ? "100%" : undefined,
    minWidth: d.buttonWidth === "full" ? undefined : "12rem",
  }

  switch (d.buttonStyle) {
    case "gradient":
      return {
        ...base,
        background: `linear-gradient(135deg, ${accent}, ${d.accentTo})`,
        color: "#ffffff",
        boxShadow: `0 14px 30px -12px ${rgba(accent, 0.8)}`,
      }
    case "outline":
      return {
        ...base,
        background: "transparent",
        color: accent,
        border: `2px solid ${accent}`,
      }
    case "soft":
      return { ...base, background: rgba(accent, 0.14), color: accent, border: "none" }
    case "glow":
      return {
        ...base,
        background: accent,
        color: contrastText(accent),
        boxShadow: `0 0 0 1px ${rgba(accent, 0.5)}, 0 0 44px -6px ${accent}`,
      }
    default:
      return { ...base, background: accent, color: contrastText(accent) }
  }
}

export function fontStack(font: string) {
  return FONT_OPTIONS.find((f) => f.value === font)?.stack ?? FONT_OPTIONS[0].stack
}

export function maxWidthFor(width: string) {
  return WIDTH_OPTIONS.find((w) => w.value === width)?.px ?? "58rem"
}

export function titleSizeFor(size: string) {
  return TITLE_SIZES.find((t) => t.value === size)?.css ?? "2.35rem"
}

/**
 * Strips anything executable out of an uploaded HTML skin. Admins upload
 * these, but the result is rendered on a page anonymous visitors see, so a
 * careless paste must never become a script on a public URL.
 */
export function sanitizeHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<script[^>]*>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[^>]*>/gi, "")
    .replace(/<link[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript:/gi, "")
}

/** Keeps a pasted stylesheet from escaping into an import or an expression. */
export function sanitizeCss(css: string) {
  return css
    .replace(/@import[^;]*;/gi, "")
    .replace(/expression\s*\(/gi, "(")
    .replace(/javascript:/gi, "")
    .replace(/<\/?[a-z][\s\S]*?>/gi, "")
}

/* ------------------------------------------------------------------ *
 * Keeping an uploaded skin inside the form
 * ------------------------------------------------------------------ */

/** At-rules whose contents are not selectors and must be left alone. */
const OPAQUE_AT_RULES = /^@(keyframes|-\w+-keyframes|font-face|page|counter-style|property)/i
/** At-rules that wrap ordinary rules, so their insides still need scoping. */
const NESTING_AT_RULES = /^@(media|supports|container|layer|scope)/i

/**
 * Rewrites one selector so it can only ever match inside the form.
 *
 * Page-level selectors are the dangerous ones: a skin that says
 * `body { display: none }` is asking for the form's page to be blank, not for
 * the admin screen around the preview to disappear. They are re-pointed at the
 * form's own root, which is the closest honest equivalent.
 */
function scopeSelector(selector: string, scope: string) {
  let trimmed = selector.trim()
  if (!trimmed) return ""

  // never let a skin reach the app shell the preview is sitting in; "html body
  // .x" sheds both page elements, not just the first
  let stripped = false
  while (/^(html|body|:root)(?![\w-])/i.test(trimmed)) {
    trimmed = trimmed.replace(/^(html|body|:root)/i, "").replace(/^\s*>\s*/, "").trim()
    stripped = true
  }
  if (stripped) return trimmed ? `${scope} ${trimmed}` : scope

  if (trimmed === "*") return `${scope}, ${scope} *`
  // a skin targeting the root hook itself means the root, not a child of it
  if (trimmed === scope || new RegExp(`^\\${scope}(?![\\w-])`).test(trimmed)) return trimmed
  return `${scope} ${trimmed}`
}

/**
 * Confines a stylesheet to `scope`.
 *
 * The live preview renders inside the builder, sharing one document with it,
 * so an unscoped upload takes the whole admin screen down with it — which is
 * exactly what happened before this existed. Every rule is walked and pinned
 * to the form's root; at-rules that wrap other rules are walked into, and the
 * ones whose bodies are not selectors (`@keyframes`, `@font-face`) are copied
 * through untouched.
 */
/**
 * Raises a declaration block over the renderer's own inline styles.
 *
 * Every input, label and button the form draws carries a `style` attribute
 * built from the design settings, and an inline style beats any stylesheet.
 * Without this an uploaded skin can restyle the page around the questions but
 * never the questions themselves — which reads, fairly, as "it ignored my
 * design". `!important` is the one thing that outranks inline, so uploaded
 * rules get it and the promise that custom CSS always wins becomes true.
 */
function forceImportant(body: string) {
  const declarations: string[] = []
  let current = ""
  let depth = 0
  let quote = ""

  // a plain split on ";" would cut "url(data:image/svg+xml;base64,…)" in half,
  // so separators only count outside brackets and quotes
  for (const char of body) {
    if (quote) {
      if (char === quote) quote = ""
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (char === "(") {
      depth++
    } else if (char === ")") {
      depth = Math.max(0, depth - 1)
    } else if (char === ";" && depth === 0) {
      declarations.push(current)
      current = ""
      continue
    }
    current += char
  }
  declarations.push(current)

  return declarations
    .map((declaration) => {
      const trimmed = declaration.trim()
      if (!trimmed || !trimmed.includes(":") || /!\s*important$/i.test(trimmed)) {
        return declaration
      }
      return `${declaration} !important`
    })
    .join(";")
}

export function scopeCss(css: string, scope = ".lrc-page", important = false): string {
  let out = ""
  let index = 0

  while (index < css.length) {
    // everything up to the next block is a selector list or an at-rule head
    const braceAt = css.indexOf("{", index)
    if (braceAt === -1) break

    const head = css.slice(index, braceAt).trim()

    // find the matching close brace, counting nesting as we go
    let depth = 1
    let cursor = braceAt + 1
    while (cursor < css.length && depth > 0) {
      if (css[cursor] === "{") depth++
      else if (css[cursor] === "}") depth--
      cursor++
    }
    const body = css.slice(braceAt + 1, cursor - 1)

    if (head.startsWith("@")) {
      if (OPAQUE_AT_RULES.test(head)) {
        // keyframe steps are declarations too, but !important is illegal there
        out += `${head}{${body}}`
      } else if (NESTING_AT_RULES.test(head)) {
        out += `${head}{${scopeCss(body, scope, important)}}`
      }
      // anything else at the top level (@charset, unknown) is dropped
    } else {
      const selectors = head
        .split(",")
        .map((selector) => scopeSelector(selector, scope))
        .filter(Boolean)
      if (selectors.length) {
        out += `${selectors.join(",")}{${important ? forceImportant(body) : body}}`
      }
    }

    index = cursor
  }

  return out
}

/* ------------------------------------------------------------------ *
 * Reading the questions out of an uploaded file
 * ------------------------------------------------------------------ */

export interface ExtractedField {
  label: string
  field_type: string
  options: string[]
  is_required: boolean
}

const INPUT_TYPE_MAP: Record<string, string> = {
  text: "text",
  email: "email",
  tel: "phone",
  number: "number",
  date: "date",
  url: "text",
  search: "text",
  password: "text",
}

/** The visible text tied to a control: its <label>, then placeholder, then name. */
function labelFor(control: Element, doc: Document) {
  const id = control.getAttribute("id")
  const byFor = id ? doc.querySelector(`label[for="${CSS.escape(id)}"]`) : null
  const wrapping = control.closest("label")
  const previous = control.previousElementSibling

  const candidates = [
    byFor?.textContent,
    wrapping?.textContent,
    previous && /^(label|p|span|h[1-6]|strong|legend)$/i.test(previous.tagName)
      ? previous.textContent
      : null,
    control.getAttribute("aria-label"),
    control.getAttribute("placeholder"),
    control.getAttribute("name"),
  ]

  for (const candidate of candidates) {
    const text = (candidate ?? "").replace(/\s+/g, " ").trim()
    // a wrapping label contains the control's own text (an option's caption),
    // which is a poor question title — anything shorter than 2 chars is noise
    if (text.length > 1) return text.replace(/\s*\*$/, "").trim()
  }
  return ""
}

/**
 * Turns the form controls in an uploaded file into questions.
 *
 * People who hand-write a form in HTML write the questions there too, and
 * retyping all of them into the builder afterwards is the kind of busywork
 * that stops the feature being used at all. Radios and checkboxes sharing a
 * `name` are one question with several options, the way a browser treats them.
 */
export function extractFieldsFromHtml(raw: string): ExtractedField[] {
  if (typeof DOMParser === "undefined") return []
  const doc = new DOMParser().parseFromString(raw, "text/html")
  const fields: ExtractedField[] = []
  const groups = new Map<string, ExtractedField>()

  for (const control of doc.querySelectorAll("input, textarea, select")) {
    const tag = control.tagName.toLowerCase()
    const type = (control.getAttribute("type") ?? "text").toLowerCase()

    if (tag === "input" && ["submit", "button", "reset", "hidden", "image", "file"].includes(type)) {
      continue
    }

    const required = control.hasAttribute("required")

    if (tag === "input" && (type === "radio" || type === "checkbox")) {
      // one question, one option per input — grouped by name like a browser does
      const groupName = control.getAttribute("name") ?? `${type}-${fields.length}`
      const option =
        (control.closest("label")?.textContent ?? "").replace(/\s+/g, " ").trim() ||
        control.getAttribute("value") ||
        `Option ${(groups.get(groupName)?.options.length ?? 0) + 1}`

      let group = groups.get(groupName)
      if (!group) {
        // the question title sits above the group, not on any one input
        const fieldset = control.closest("fieldset")
        const legend = fieldset?.querySelector("legend")?.textContent
        group = {
          label: (legend ?? "").replace(/\s+/g, " ").trim() || groupName,
          field_type: type === "radio" ? "radio" : "checkbox",
          options: [],
          is_required: required,
        }
        groups.set(groupName, group)
        fields.push(group)
      }
      if (!group.options.includes(option)) group.options.push(option)
      continue
    }

    if (tag === "select") {
      const options = [...control.querySelectorAll("option")]
        .map((option) => (option.textContent ?? "").replace(/\s+/g, " ").trim())
        // a blank first option is a placeholder, not a choice
        .filter((text, index) => text && !(index === 0 && !option0HasValue(control)))
      fields.push({
        label: labelFor(control, doc) || "Question",
        field_type: "select",
        options,
        is_required: required,
      })
      continue
    }

    fields.push({
      label: labelFor(control, doc) || "Question",
      field_type:
        tag === "textarea" ? "textarea" : (INPUT_TYPE_MAP[type] ?? "text"),
      options: [],
      is_required: required,
    })
  }

  return fields.filter((field) => field.label)
}

/** True when the first <option> is a real choice rather than a "choose…" line. */
function option0HasValue(select: Element) {
  const first = select.querySelector("option")
  return !!first?.getAttribute("value")
}

/* ------------------------------------------------------------------ *
 * Making an uploaded skin fit the questions the form actually draws
 * ------------------------------------------------------------------ */

const classTokens = (element: Element | null | undefined) =>
  (element?.getAttribute("class") ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((name) => `.${name}`)

/**
 * Works out which of the author's class names mean which part of a question.
 *
 * An uploaded file styles its own markup — `.field`, `label.q`, `.submit-btn`
 * — but the form is redrawn with the renderer's own elements, so none of those
 * rules would ever match anything and the upload looks like it was ignored.
 * Reading the file's structure says what each class *was*: the thing wrapping
 * a control is the question block, the label beside it is the label, and so
 * on. Those names then get pointed at the matching `.lrc-` hook.
 */
export function skinAliases(doc: Document): Record<string, string> {
  const aliases: Record<string, string> = {
    // element selectors are the common case and need no guessing
    input: ".lrc-input",
    textarea: ".lrc-input",
    select: ".lrc-input",
  }

  // A file usually holds several looks for the same thing — pill options, card
  // options, a grid of them — but the form draws every option the one way, so
  // two mapped looks would just fight and the last would win at random. Only
  // the first pattern for each part of a question is taken.
  const claimed = new Set<string>()
  /** One pattern may be spread over several elements — a label and the span
   *  inside it — so they are claimed together or not at all. */
  const addAll = (elements: (Element | null | undefined)[], hook: string) => {
    if (claimed.has(hook)) return
    const tokens = elements.flatMap(classTokens)
    if (!tokens.length) return
    for (const token of tokens) aliases[token] ??= hook
    claimed.add(hook)
  }
  const add = (element: Element | null | undefined, hook: string) => addAll([element], hook)

  for (const control of doc.querySelectorAll("input, textarea, select")) {
    const type = (control.getAttribute("type") ?? "text").toLowerCase()
    if (["submit", "button", "reset", "hidden", "image", "file"].includes(type)) continue

    if (type === "radio" || type === "checkbox") {
      // the label around a radio is the clickable option, not a question label
      const option = control.closest("label")
      // the pill look is almost always painted on a span inside that label
      // rather than the label itself, so that span is part of the same pattern
      const inner = [...(option?.querySelectorAll(":scope > [class]") ?? [])].filter(
        (element) => element !== control
      )
      addAll([option, ...inner], ".lrc-choice")
      continue
    }

    add(control, ".lrc-input")

    // the nearest ancestor carrying a class is the question block
    const wrapper = control.parentElement?.closest("[class]")
    const isBlock = wrapper && !/^(form|body|html)$/i.test(wrapper.tagName)
    if (isBlock) add(wrapper, ".lrc-question")

    const id = control.getAttribute("id")
    add(id ? doc.querySelector(`label[for="${CSS.escape(id)}"]`) : null, ".lrc-label")
    add(control.closest("label"), ".lrc-label")
    // most hand-written forms do neither: the label is simply the one sitting
    // beside the control in the same block, tied to it by nothing but layout
    if (isBlock) {
      const sibling = wrapper.querySelector("label:not([class~='choice'])")
      if (sibling && !sibling.contains(control)) add(sibling, ".lrc-label")
      add(wrapper.querySelector("small, .hint, [class*='hint'], [class*='help']"), ".lrc-hint")
    }
  }

  const submit =
    doc.querySelector("button[type=submit], input[type=submit]") ??
    [...doc.querySelectorAll("button")].pop()
  add(submit, ".lrc-submit")
  aliases.button ??= ".lrc-submit"

  return aliases
}

/**
 * Copies each of the author's rules onto the hook its selector stands for.
 *
 * The original rule is kept — the uploaded markup above the questions still
 * uses those classes — and a duplicate is emitted with the class swapped, so
 * the same styling lands on the questions the form renders itself.
 */
export function aliasCss(css: string, aliases: Record<string, string>): string {
  const tokens = Object.keys(aliases)
  if (!tokens.length) return ""

  const extra: string[] = []
  let index = 0

  while (index < css.length) {
    const braceAt = css.indexOf("{", index)
    if (braceAt === -1) break
    const head = css.slice(index, braceAt).trim()

    let depth = 1
    let cursor = braceAt + 1
    while (cursor < css.length && depth > 0) {
      if (css[cursor] === "{") depth++
      else if (css[cursor] === "}") depth--
      cursor++
    }
    const body = css.slice(braceAt + 1, cursor - 1)
    index = cursor

    if (head.startsWith("@")) {
      if (NESTING_AT_RULES.test(head)) {
        const inner = aliasCss(body, aliases)
        if (inner) extra.push(`${head}{${inner}}`)
      }
      continue
    }

    const rewritten = head
      .split(",")
      .map((selector) => {
        let next = selector
        let hit = false
        for (const token of tokens) {
          // ".field" and "input" both have to match as whole tokens, so
          // ".fieldset" and "input-group" are left alone
          const pattern = token.startsWith(".")
            ? new RegExp(`\\${token}(?![\\w-])`, "g")
            : new RegExp(`(^|[\\s>+~])${token}(?![\\w-])`, "g")
          if (!pattern.test(next)) continue
          hit = true
          next = next.replace(
            pattern,
            token.startsWith(".") ? aliases[token] : `$1${aliases[token]}`
          )
        }
        if (!hit) return ""
        // ".choice .pill" describes one option painted on two nested elements;
        // the form draws it as one, so the repeated hook collapses into itself
        return next.replace(/(\.lrc-[\w-]+)(?:\s+\1)+/g, "$1").trim()
      })
      .filter(Boolean)

    if (rewritten.length) extra.push(`${rewritten.join(",")}{${body}}`)
  }

  return extra.join("\n")
}

/**
 * Splits an uploaded file into the three things the form can use: its styles,
 * its decorative markup, and its questions.
 *
 * The questions are taken out of the markup, not left in it. A file that
 * carries its own `<input>`s would otherwise render them as dead decoration
 * above the real questions — the same form twice, only one half of which
 * actually records an answer.
 */
export function splitUploadedHtml(raw: string): {
  css: string
  html: string
  fields: ExtractedField[]
} {
  const css: string[] = []
  let rest = raw.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_match, body: string) => {
    css.push(String(body).trim())
    return ""
  })

  const fields = extractFieldsFromHtml(rest)
  const authorCss = sanitizeCss(css.join("\n\n"))

  // point the file's own class names at the parts of the form they described,
  // so the questions come out looking the way they did in the file
  let mapped = ""
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(rest, "text/html")
    mapped = aliasCss(authorCss, skinAliases(doc))
  }

  const bodyMatch = rest.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (bodyMatch) rest = bodyMatch[1]

  rest = rest
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<\/?html[^>]*>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<\/?body[^>]*>/gi, "")

  return {
    css: mapped
      ? `${authorCss}\n\n/* --- your styling, applied to the form's own questions --- */\n${mapped}`
      : authorCss,
    html: sanitizeHtml(stripFormMarkup(rest)).trim(),
    fields,
  }
}

/** Drops the parts of an upload the form renders itself, keeping the styling. */
function stripFormMarkup(html: string) {
  if (typeof DOMParser === "undefined") return html
  const doc = new DOMParser().parseFromString(html, "text/html")
  for (const node of doc.body.querySelectorAll(
    "form, input, textarea, select, label, fieldset, legend, button"
  )) {
    node.remove()
  }
  // Wrappers left holding nothing are the husks of the form we just removed.
  // A styled empty box is not a husk though — decorative shapes and dividers
  // are drawn exactly that way, and throwing them out would quietly delete
  // half of somebody's design.
  for (const node of [...doc.body.querySelectorAll("div, section, p, span")].reverse()) {
    const decorative =
      node.hasAttribute("style") || node.hasAttribute("class") || node.hasAttribute("id")
    if (decorative) continue
    if (!node.textContent?.trim() && !node.querySelector("img, svg, hr, video")) node.remove()
  }
  return doc.body.innerHTML
}

/** The class hooks a custom skin can target — shown in the designer. */
export const SKIN_HOOKS = [
  { name: ".lrc-page", what: "the whole page" },
  { name: ".lrc-card", what: "the form card" },
  { name: ".lrc-cover", what: "the cover image" },
  { name: ".lrc-title", what: "the form title" },
  { name: ".lrc-desc", what: "the description under it" },
  { name: ".lrc-question", what: "one question block" },
  { name: ".lrc-label", what: "a question label" },
  { name: ".lrc-hint", what: "the help text under a label" },
  { name: ".lrc-choices", what: "the row of options" },
  { name: ".lrc-choice", what: "one radio or checkbox option" },
  { name: ".lrc-input", what: "every input" },
  { name: ".lrc-submit", what: "the submit button" },
  { name: ".lrc-header", what: "your uploaded markup" },
]

/** A starter skin an admin can download, edit and upload back. */
export function starterSkinHtml(title: string) {
  const hooks = SKIN_HOOKS.map((h) => `       ${h.name.padEnd(15)} ${h.what}`).join("\n")
  return `<!--
  LRC form skin for "${title}".
  Edit the CSS below and upload this file back into the form designer.
  Anything in <style> becomes the form's custom CSS; the markup after it is
  rendered above the questions. Scripts are removed on upload.

  Class hooks you can style:
${hooks}
-->
<style>
  .lrc-card {
    /* example: a thicker top edge in the centre's blue */
    border-top: 6px solid #2563eb;
  }

  .lrc-title {
    letter-spacing: -0.02em;
  }

  .lrc-question {
    transition: transform 0.15s ease;
  }

  .lrc-question:hover {
    transform: translateY(-1px);
  }
</style>

<div class="lrc-header" style="text-align:center; padding-bottom:8px">
  <strong>${title}</strong>
</div>
`
}
