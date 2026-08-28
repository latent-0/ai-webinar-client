import { useEffect, useRef } from 'react'

type Particle = {
  x: number; y: number
  tx: number; ty: number
  vx: number; vy: number
  r: number; color: string
}

// Maps x-position ratio within each line to a color
function getColor(xRatio: number, lineIndex: number): string {
  const t = Math.max(0, Math.min(1, xRatio))
  if (lineIndex === 0) {
    // "Not another" — soft white transitioning into blue-gray
    const h = 215
    const s = Math.round(15 + t * 35)
    const l = Math.round(82 - t * 14)
    return `hsl(${h},${s}%,${l}%)`
  }
  // "webinar." — blue → violet → emerald
  if (t < 0.5) {
    const u = t / 0.5
    const h = Math.round(213 + u * 42)
    return `hsl(${h},88%,72%)`
  }
  const u = (t - 0.5) / 0.5
  const h = Math.round(255 - u * 96)
  const l = Math.round(72 - u * 20)
  return `hsl(${h},${Math.round(88 - u * 8)}%,${l}%)`
}

export default function ParticleHeadline() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let dead = false
    let raf = 0
    const particles: Particle[] = []
    const mouse = { x: -9999, y: -9999 }

    async function init() {
      await document.fonts.ready
      if (dead) return

      const dpr = window.devicePixelRatio || 1
      const W = canvas!.offsetWidth
      const H = canvas!.offsetHeight
      if (!W || !H) return

      canvas!.width = W * dpr
      canvas!.height = H * dpr
      const ctx = canvas!.getContext('2d')!
      ctx.scale(dpr, dpr)

      // Compute font sizes so text fills the canvas naturally
      const fs2 = Math.min(H * 0.46, W / 4.6)   // "webinar." — bigger
      const fs1 = fs2 * 0.7                        // "Not another" — smaller
      const lineGap = fs2 * 0.18
      const totalTextH = fs1 + lineGap + fs2
      const startY = (H - totalTextH) / 2

      const linesMeta = [
        { text: 'Not another', fs: fs1, y: startY, li: 0 },
        { text: 'webinar.',    fs: fs2, y: startY + fs1 + lineGap, li: 1 },
      ]

      // Draw to offscreen canvas and sample pixel positions
      const off = Object.assign(document.createElement('canvas'), { width: W, height: H })
      const oc = off.getContext('2d')!
      oc.fillStyle = '#000'
      oc.fillRect(0, 0, W, H)
      oc.textBaseline = 'top'
      oc.textAlign = 'left'

      const lineWidths: number[] = []
      for (const { text, fs, y } of linesMeta) {
        oc.font = `800 ${fs}px Inter, system-ui, sans-serif`
        oc.fillStyle = '#fff'
        oc.fillText(text, 0, y)
        lineWidths.push(oc.measureText(text).width)
      }

      const { data } = oc.getImageData(0, 0, W, H)
      // Adaptive sampling density: more particles on wider screens
      const step = Math.max(3, Math.ceil(W / 340))

      for (let y = 0; y < H; y += step) {
        for (let x = 0; x < W; x += step) {
          if (data[(y * W + x) * 4] < 128) continue

          // Which line does this pixel belong to?
          let li = 0
          for (let i = 0; i < linesMeta.length; i++) {
            const { y: ly, fs } = linesMeta[i]
            if (y >= ly && y < ly + fs * 1.2) { li = i; break }
          }

          const xRatio = x / Math.max(1, lineWidths[li])
          particles.push({
            // Start below the canvas, scatter horizontally
            x: x + (Math.random() - 0.5) * W * 0.4,
            y: H + Math.random() * 180 + 40,
            tx: x, ty: y,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -(Math.random() * 2 + 0.5),
            r: Math.random() * 1.15 + 0.45,
            color: getColor(xRatio, li),
          })
        }
      }

      function frame() {
        if (dead) return
        ctx.clearRect(0, 0, W, H)

        for (const p of particles) {
          // Spring toward target
          p.vx += (p.tx - p.x) * 0.072
          p.vy += (p.ty - p.y) * 0.072

          // Mouse repulsion
          const dx = p.x - mouse.x
          const dy = p.y - mouse.y
          const d2 = dx * dx + dy * dy
          if (d2 < 6400 && d2 > 0.01) { // 80px radius
            const d = Math.sqrt(d2)
            const f = ((80 - d) / 80) * 5.5
            p.vx += (dx / d) * f
            p.vy += (dy / d) * f
          }

          p.vx *= 0.79
          p.vy *= 0.79
          p.x += p.vx
          p.y += p.vy

          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
          ctx.fill()
        }

        raf = requestAnimationFrame(frame)
      }

      raf = requestAnimationFrame(frame)
    }

    init()

    const onMove = (e: MouseEvent) => {
      const rect = canvas!.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
    }
    const onLeave = () => { mouse.x = -9999; mouse.y = -9999 }
    const onTouch = (e: TouchEvent) => {
      const rect = canvas!.getBoundingClientRect()
      const t = e.touches[0]
      mouse.x = t.clientX - rect.left
      mouse.y = t.clientY - rect.top
    }

    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseleave', onLeave)
    canvas.addEventListener('touchmove', onTouch, { passive: true })
    canvas.addEventListener('touchend', onLeave)

    return () => {
      dead = true
      cancelAnimationFrame(raf)
      canvas?.removeEventListener('mousemove', onMove)
      canvas?.removeEventListener('mouseleave', onLeave)
      canvas?.removeEventListener('touchmove', onTouch)
      canvas?.removeEventListener('touchend', onLeave)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="w-full block"
      style={{ height: '220px', cursor: 'crosshair' }}
      aria-label="Not another webinar."
    />
  )
}
