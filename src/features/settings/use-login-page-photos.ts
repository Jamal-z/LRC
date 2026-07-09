import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

export type LoginPagePhoto = {
  url: string
  path: string
  alt?: string
  created_at: string
  positionX?: number
  positionY?: number
}

export const LOGIN_PAGE_PHOTOS_SETTING_KEY = "login_page_photos"

function isPhoto(value: unknown): value is LoginPagePhoto {
  if (!value || typeof value !== "object") return false

  const photo = value as Partial<LoginPagePhoto>
  return typeof photo.url === "string" && typeof photo.path === "string"
}

export function normalizeLoginPagePhotos(value: unknown): LoginPagePhoto[] {
  if (!Array.isArray(value)) return []

  return value.filter(isPhoto).map((photo) => ({
    ...photo,
    positionX: typeof photo.positionX === "number" ? photo.positionX : 50,
    positionY: typeof photo.positionY === "number" ? photo.positionY : 50,
  }))
}

export function useLoginPagePhotos() {
  return useQuery({
    queryKey: ["app-setting", LOGIN_PAGE_PHOTOS_SETTING_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", LOGIN_PAGE_PHOTOS_SETTING_KEY)
        .maybeSingle()

      if (error) throw error

      return normalizeLoginPagePhotos(data?.value)
    },
  })
}

export async function saveLoginPagePhotos(photos: LoginPagePhoto[]) {
  const { error } = await supabase.from("app_settings").upsert({
    key: LOGIN_PAGE_PHOTOS_SETTING_KEY,
    value: photos,
    updated_at: new Date().toISOString(),
  })

  if (error) throw error
}