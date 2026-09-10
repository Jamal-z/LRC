import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

/**
 * A live preview that cannot reach the page around it.
 *
 * Scoping an uploaded stylesheet stops its *rules* escaping, but nothing in
 * CSS stops the uploaded *markup*: one `position: fixed` decoration and the
 * builder disappears behind it, which is exactly what kept happening. An
 * iframe is a separate document, so a skin can do whatever it likes in there
 * and the editor beside it is untouchable — no scoping, no z-index race, no
 * way for the Save button to vanish again.
 *
 * The preview is still React: the form is portalled into the frame, so typing
 * in the designer updates it live the way an inlined preview did.
 */
export function PreviewFrame({
  children,
  className,
  title = "Live preview",
}: {
  children: React.ReactNode
  className?: string
  title?: string
}) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [mountPoint, setMountPoint] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return

    function attach() {
      const doc = frame!.contentDocument
      if (!doc) return

      // the frame starts empty: give it the app's stylesheets so Tailwind
      // classes inside the form render the same as they do outside
      doc.head.innerHTML = ""
      for (const node of document.head.querySelectorAll('style, link[rel="stylesheet"]')) {
        doc.head.appendChild(node.cloneNode(true))
      }

      const reset = doc.createElement("style")
      reset.textContent = "html,body{margin:0;padding:0;background:transparent}"
      doc.head.appendChild(reset)

      // themes are read off the root element, so carry the current one across
      doc.documentElement.className = document.documentElement.className
      doc.documentElement.setAttribute("dir", document.documentElement.dir || "ltr")

      setMountPoint(doc.body)
    }

    attach()
    frame.addEventListener("load", attach)
    return () => frame.removeEventListener("load", attach)
  }, [])

  return (
    <iframe
      ref={frameRef}
      title={title}
      className={className}
      // the skin is already stripped of scripts; the sandbox is the belt to
      // that pair of braces, and same-origin is what lets React portal in
      sandbox="allow-same-origin"
    >
      {mountPoint && createPortal(children, mountPoint)}
    </iframe>
  )
}
