import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"

/**
 * Two interviewers on two laptops filling in the same interview.
 *
 * Every edit is broadcast the moment it is made — before anyone presses Save —
 * over a private Supabase Realtime channel (only the committee may join; see
 * migration 025). Presence says who else has the interview open and which
 * field each of them is in.
 *
 * Edits are per field: two people writing in *different* fields never clash;
 * two people typing in the *same* field at the same moment end up with
 * whoever typed last. Saving still writes the row as before — the channel
 * only keeps the unsaved drafts in step.
 */

/** One change to the draft: a whole field, or one key inside ratings / criteria_notes. */
export interface DraftPatch {
  field: string
  sub?: string
  value: unknown
}

export interface RoomPeer {
  clientId: string
  userId: string
  name: string
  /** the `data-field` they are in right now, if any */
  focus: string | null
}

interface PeerMeta {
  userId: string
  name: string
  focus: string | null
}

interface RoomHandlers<T> {
  getDraft: () => T
  /** a peer changed something */
  onPatch: (patch: DraftPatch) => void
  /** we just joined and a peer handed us their live draft */
  onAdopt: (draft: T) => void
  /** a peer saved the interview (a brand-new one gets its id here) */
  onSaved: (id: string) => void
}

export function useInterviewRoom<T>({
  roomKey,
  user,
  handlers,
}: {
  /** null keeps the room closed — e.g. until the draft has loaded */
  roomKey: string | null
  user: { id: string; name: string } | null
  handlers: RoomHandlers<T>
}) {
  const clientId = useMemo(() => crypto.randomUUID(), [])
  const channelRef = useRef<RealtimeChannel | null>(null)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers
  const focusRef = useRef<string | null>(null)
  const adoptedRef = useRef(false)
  const editedRef = useRef(false)

  const [peers, setPeers] = useState<RoomPeer[]>([])
  const [connected, setConnected] = useState(false)

  const userId = user?.id
  const userName = user?.name

  useEffect(() => {
    if (!roomKey || !userId) return
    let cancelled = false
    adoptedRef.current = false
    editedRef.current = false

    const channel = supabase.channel(`interview:${roomKey}`, {
      config: { private: true, broadcast: { self: false }, presence: { key: clientId } },
    })
    channelRef.current = channel

    channel
      .on("broadcast", { event: "patch" }, ({ payload }) => {
        if (payload?.patch) handlersRef.current.onPatch(payload.patch as DraftPatch)
      })
      .on("broadcast", { event: "sync-request" }, ({ payload }) => {
        void channel.send({
          type: "broadcast",
          event: "sync-state",
          payload: { to: payload?.from, draft: handlersRef.current.getDraft() },
        })
      })
      .on("broadcast", { event: "sync-state" }, ({ payload }) => {
        // take the first answer only, and never over something typed already
        if (payload?.to !== clientId || adoptedRef.current || editedRef.current) return
        adoptedRef.current = true
        handlersRef.current.onAdopt(payload.draft as T)
      })
      .on("broadcast", { event: "saved" }, ({ payload }) => {
        if (typeof payload?.id === "string") handlersRef.current.onSaved(payload.id)
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PeerMeta>()
        const others: RoomPeer[] = []
        for (const [key, metas] of Object.entries(state)) {
          if (key === clientId || !metas.length) continue
          const meta = metas[metas.length - 1]
          others.push({ clientId: key, userId: meta.userId, name: meta.name, focus: meta.focus })
        }
        setPeers(others)
      })

    void (async () => {
      // private channels check the signed-in user's token against RLS
      await supabase.realtime.setAuth()
      if (cancelled) return
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnected(true)
          void channel.track({ userId, name: userName ?? "", focus: focusRef.current })
          void channel.send({ type: "broadcast", event: "sync-request", payload: { from: clientId } })
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnected(false)
        }
      })
    })()

    return () => {
      cancelled = true
      channelRef.current = null
      setConnected(false)
      setPeers([])
      void supabase.removeChannel(channel)
    }
  }, [roomKey, userId, userName, clientId])

  /** Tell the others about a local edit. */
  const sendPatch = useCallback((patch: DraftPatch) => {
    editedRef.current = true
    void channelRef.current?.send({ type: "broadcast", event: "patch", payload: { patch } })
  }, [])

  /** Which field this user is in, so the others see it highlighted. */
  const setFocus = useCallback(
    (field: string | null) => {
      if (focusRef.current === field) return
      focusRef.current = field
      if (userId) void channelRef.current?.track({ userId, name: userName ?? "", focus: field })
    },
    [userId, userName]
  )

  const announceSaved = useCallback((id: string) => {
    void channelRef.current?.send({ type: "broadcast", event: "saved", payload: { id } })
  }, [])

  return { peers, connected, sendPatch, setFocus, announceSaved }
}
