import type { FormTheme } from "@/types/database.types"

export interface FormThemeStyle {
  /** page background behind the form card */
  page: string
  /** the form card itself */
  card: string
  /** heading + label colour on the page (outside the card) */
  pageText: string
  pageSubText: string
  /** logo chip */
  logo: string
  footer: string
  /** whether decorative blobs should be drawn */
  blobs: boolean
}

/**
 * The centre's palette is white and blue, so `light` and `soft` lead.
 * `dark` stays available for anyone who prefers the original navy look.
 */
export const FORM_THEMES: { value: FormTheme; label: string; preview: string }[] = [
  { value: "light", label: "White & blue", preview: "bg-white" },
  { value: "soft", label: "Soft blue", preview: "bg-sky-50" },
  { value: "gradient", label: "Blue gradient", preview: "bg-gradient-to-br from-sky-100 to-blue-200" },
  { value: "dark", label: "Navy", preview: "bg-[#071226]" },
]

export function formThemeStyle(theme: FormTheme): FormThemeStyle {
  switch (theme) {
    case "soft":
      return {
        page: "bg-sky-50 dark:bg-[#0b1a2e]",
        card: "bg-white shadow-xl shadow-blue-900/5 dark:bg-card",
        pageText: "text-slate-900 dark:text-white",
        pageSubText: "text-slate-500 dark:text-blue-100/60",
        logo: "bg-white text-blue-600 shadow-md ring-1 ring-blue-100 dark:bg-white/10 dark:text-white dark:ring-white/20",
        footer: "text-slate-400 dark:text-blue-200/50",
        blobs: true,
      }
    case "gradient":
      return {
        page: "bg-gradient-to-br from-sky-100 via-white to-blue-200 dark:from-[#0b1a2e] dark:via-[#071226] dark:to-[#0b1a35]",
        card: "bg-white/95 shadow-2xl shadow-blue-900/10 backdrop-blur dark:bg-card",
        pageText: "text-slate-900 dark:text-white",
        pageSubText: "text-slate-600 dark:text-blue-100/60",
        logo: "bg-white text-blue-600 shadow-lg ring-1 ring-blue-100 dark:bg-white/10 dark:text-white dark:ring-white/20",
        footer: "text-slate-500 dark:text-blue-200/50",
        blobs: true,
      }
    case "dark":
      return {
        page: "bg-[#071226]",
        card: "bg-white shadow-2xl dark:bg-card",
        pageText: "text-white",
        pageSubText: "text-blue-100/70",
        logo: "bg-white/10 text-white ring-1 ring-white/20 backdrop-blur",
        footer: "text-blue-200/50",
        blobs: true,
      }
    default:
      return {
        page: "bg-white dark:bg-background",
        card: "bg-white shadow-xl shadow-slate-900/5 ring-1 ring-slate-100 dark:bg-card dark:ring-border",
        pageText: "text-slate-900 dark:text-foreground",
        pageSubText: "text-slate-500 dark:text-muted-foreground",
        logo: "bg-blue-600 text-white shadow-md",
        footer: "text-slate-400 dark:text-muted-foreground",
        blobs: false,
      }
  }
}
