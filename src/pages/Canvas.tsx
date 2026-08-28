import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { X, Plus, ZoomIn, ZoomOut, Maximize2, Image, Video, Loader2, Wand2, Film } from 'lucide-react'
import { textToImage, imageToVideo, hasRunwayKey } from '../lib/runway'

type NodeType = 'prompt' | 'image' | 'video'
type NodeStatus = 'idle' | 'loading' | 'done' | 'error'

interface CanvasNode {
  id: string
  type: NodeType
  x: number
  y: number
  prompt?: string
  imageUrl?: string
  videoUrl?: string
  status: NodeStatus
  error?: string
  progress?: number
  sourceId?: string
}

interface Connection {
  fromId: string
  toId: string
}

const NODE_W = 280
const NODE_H_PROMPT = 140
const NODE_H_MEDIA = 200

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

export default function Canvas() {
  const navigate = useNavigate()
  const [nodes, setNodes] = useState<CanvasNode[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [dragging, setDragging] = useState<{ id: string; ox: number; oy: number } | null>(null)
  const [panning, setPanning] = useState(false)
  const panStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [noKey, setNoKey] = useState(false)
  useEffect(() => {
    hasRunwayKey().then((ok) => setNoKey(!ok))
  }, [])

  function updateNode(id: string, patch: Partial<CanvasNode>) {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, ...patch } : n)))
  }

  function addPromptNode() {
    const cx = (window.innerWidth / 2 - pan.x) / zoom - NODE_W / 2
    const cy = (window.innerHeight / 2 - pan.y) / zoom - NODE_H_PROMPT / 2
    setNodes((ns) => [...ns, { id: uid(), type: 'prompt', x: cx, y: cy, prompt: '', status: 'idle' }])
  }

  async function generateImage(node: CanvasNode) {
    if (!node.prompt?.trim()) return
    updateNode(node.id, { status: 'loading', error: undefined })
    try {
      const url = await textToImage(node.prompt)
      const imgId = uid()
      const newImg: CanvasNode = {
        id: imgId,
        type: 'image',
        x: node.x + NODE_W + 60,
        y: node.y,
        imageUrl: url,
        status: 'done',
        sourceId: node.id,
      }
      setNodes((ns) => [...ns.map((n) => (n.id === node.id ? { ...n, status: 'done' as NodeStatus } : n)), newImg])
      setConnections((cs) => [...cs, { fromId: node.id, toId: imgId }])
    } catch (e) {
      updateNode(node.id, { status: 'error', error: String(e) })
    }
  }

  async function generateVideo(node: CanvasNode) {
    if (!node.imageUrl) return
    updateNode(node.id, { status: 'loading', error: undefined })
    try {
      const url = await imageToVideo(node.imageUrl, node.prompt)
      const vidId = uid()
      const newVid: CanvasNode = {
        id: vidId,
        type: 'video',
        x: node.x + NODE_W + 60,
        y: node.y,
        videoUrl: url,
        status: 'done',
        sourceId: node.id,
      }
      setNodes((ns) => [...ns.map((n) => (n.id === node.id ? { ...n, status: 'done' as NodeStatus } : n)), newVid])
      setConnections((cs) => [...cs, { fromId: node.id, toId: vidId }])
    } catch (e) {
      updateNode(node.id, { status: 'error', error: String(e) })
    }
  }

  function deleteNode(id: string) {
    setNodes((ns) => ns.filter((n) => n.id !== id))
    setConnections((cs) => cs.filter((c) => c.fromId !== id && c.toId !== id))
  }

  // Mouse handlers for node dragging
  function onNodeMouseDown(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    const node = nodes.find((n) => n.id === id)
    if (!node) return
    setDragging({ id, ox: e.clientX / zoom - node.x, oy: e.clientY / zoom - node.y })
  }

  // Canvas pan handlers
  function onCanvasMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return
    setPanning(true)
    panStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y }
  }

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (dragging) {
      const nx = e.clientX / zoom - dragging.ox
      const ny = e.clientY / zoom - dragging.oy
      setNodes((ns) => ns.map((n) => (n.id === dragging.id ? { ...n, x: nx, y: ny } : n)))
    } else if (panning) {
      setPan({
        x: panStart.current.px + (e.clientX - panStart.current.mx),
        y: panStart.current.py + (e.clientY - panStart.current.my),
      })
    }
  }, [dragging, panning, zoom])

  const onMouseUp = useCallback(() => {
    setDragging(null)
    setPanning(false)
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    setZoom((z) => {
      const nz = Math.max(0.2, Math.min(3, z * factor))
      setPan((p) => ({
        x: mx - (mx - p.x) * (nz / z),
        y: my - (my - p.y) * (nz / z),
      }))
      return nz
    })
  }

  function resetView() {
    setPan({ x: 0, y: 0 })
    setZoom(1)
  }

  function nodeCenter(n: CanvasNode) {
    const h = n.type === 'prompt' ? NODE_H_PROMPT : NODE_H_MEDIA
    return { x: n.x + NODE_W / 2, y: n.y + h / 2 }
  }

  return (
    <div className="fixed inset-0 bg-[#0D0D0F] overflow-hidden" ref={containerRef}>
      {/* Dot grid */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.35 }}>
        <defs>
          <pattern
            id="dot-grid"
            x={pan.x % (24 * zoom)}
            y={pan.y % (24 * zoom)}
            width={24 * zoom}
            height={24 * zoom}
            patternUnits="userSpaceOnUse"
          >
            <circle cx={1} cy={1} r={1} fill="#4B5563" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dot-grid)" />
      </svg>

      {/* SVG connections */}
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 1 }}
      >
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {connections.map((c) => {
            const from = nodes.find((n) => n.id === c.fromId)
            const to = nodes.find((n) => n.id === c.toId)
            if (!from || !to) return null
            const fc = nodeCenter(from)
            const tc = nodeCenter(to)
            const mx = (fc.x + tc.x) / 2
            return (
              <path
                key={`${c.fromId}-${c.toId}`}
                d={`M ${fc.x + NODE_W / 2} ${fc.y} C ${mx + 30} ${fc.y}, ${mx - 30} ${tc.y}, ${tc.x - NODE_W / 2} ${tc.y}`}
                stroke="#6366F1"
                strokeWidth={1.5 / zoom}
                fill="none"
                strokeOpacity={0.6}
              />
            )
          })}
        </g>
      </svg>

      {/* Canvas interaction layer */}
      <div
        className="absolute inset-0"
        style={{ cursor: panning ? 'grabbing' : 'grab', zIndex: 2 }}
        onMouseDown={onCanvasMouseDown}
        onWheel={onWheel}
      />

      {/* Nodes */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 3 }}
      >
        <div style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', width: 0, height: 0 }}>
          {nodes.map((node) => (
            <CanvasNodeCard
              key={node.id}
              node={node}
              onMouseDown={(e) => onNodeMouseDown(e, node.id)}
              onDelete={() => deleteNode(node.id)}
              onPromptChange={(v) => updateNode(node.id, { prompt: v })}
              onGenerateImage={() => generateImage(node)}
              onGenerateVideo={() => generateVideo(node)}
              noKey={noKey}
            />
          ))}
        </div>
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 h-12 flex items-center px-4 gap-3 z-10 bg-[#0D0D0F]/80 backdrop-blur-sm border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center">
            <Film size={12} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-white">Infinite Canvas</span>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => navigate({ to: '/' })}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Floating toolbar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#1A1A1F]/90 backdrop-blur-sm border border-white/10 shadow-xl">
        <button
          onClick={addPromptNode}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
        >
          <Plus size={14} /> Add Node
        </button>
        <div className="w-px h-5 bg-white/10" />
        <button
          onClick={() => setZoom((z) => Math.min(3, z * 1.2))}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          title="Zoom in"
        >
          <ZoomIn size={15} />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.2, z / 1.2))}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          title="Zoom out"
        >
          <ZoomOut size={15} />
        </button>
        <button
          onClick={resetView}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          title="Reset view"
        >
          <Maximize2 size={15} />
        </button>
        <div className="w-px h-5 bg-white/10" />
        <span className="text-[11px] text-white/30 tabular-nums">{Math.round(zoom * 100)}%</span>
      </div>

    </div>
  )
}

interface NodeCardProps {
  node: CanvasNode
  onMouseDown: (e: React.MouseEvent) => void
  onDelete: () => void
  onPromptChange: (v: string) => void
  onGenerateImage: () => void
  onGenerateVideo: () => void
  noKey: boolean
}

function CanvasNodeCard({ node, onMouseDown, onDelete, onPromptChange, onGenerateImage, onGenerateVideo, noKey }: NodeCardProps) {
  const isLoading = node.status === 'loading'

  return (
    <div
      className="absolute pointer-events-auto select-none"
      style={{ left: node.x, top: node.y, width: NODE_W }}
      onMouseDown={onMouseDown}
    >
      <div className={`rounded-2xl border shadow-xl overflow-hidden ${
        node.type === 'prompt'
          ? 'bg-[#1A1A1F] border-white/10'
          : node.type === 'image'
          ? 'bg-[#1A1A1F] border-indigo-500/30'
          : 'bg-[#1A1A1F] border-purple-500/30'
      }`}>
        {/* Node header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 cursor-grab active:cursor-grabbing">
          <div className={`w-5 h-5 rounded-md flex items-center justify-center ${
            node.type === 'prompt' ? 'bg-indigo-600/30' : node.type === 'image' ? 'bg-blue-600/30' : 'bg-purple-600/30'
          }`}>
            {node.type === 'prompt' && <Wand2 size={11} className="text-indigo-400" />}
            {node.type === 'image' && <Image size={11} className="text-blue-400" />}
            {node.type === 'video' && <Video size={11} className="text-purple-400" />}
          </div>
          <span className="text-[11px] font-medium text-white/50 uppercase tracking-wider flex-1">
            {node.type === 'prompt' ? 'Prompt' : node.type === 'image' ? 'Image' : 'Video'}
          </span>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onDelete}
            className="p-0.5 rounded hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors"
          >
            <X size={11} />
          </button>
        </div>

        {/* Node body */}
        <div className="p-3">
          {node.type === 'prompt' && (
            <>
              <textarea
                value={node.prompt || ''}
                onChange={(e) => onPromptChange(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="Describe what to generate..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/25 resize-none focus:outline-none focus:border-indigo-500/60 leading-relaxed"
              />
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={onGenerateImage}
                disabled={isLoading || !node.prompt?.trim() || noKey}
                className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
              >
                {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Image size={12} />}
                {isLoading ? 'Generating…' : 'Generate Image'}
              </button>
              {node.error && (
                <p className="mt-2 text-[10px] text-red-400 leading-relaxed">{node.error}</p>
              )}
            </>
          )}

          {node.type === 'image' && (
            <>
              {isLoading ? (
                <div className="flex items-center justify-center h-32 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-center">
                    <Loader2 size={20} className="animate-spin text-indigo-400 mx-auto mb-2" />
                    <p className="text-[10px] text-white/40">Generating video…</p>
                    {node.progress != null && (
                      <p className="text-[10px] text-white/30">{node.progress}%</p>
                    )}
                  </div>
                </div>
              ) : (
                <img
                  src={node.imageUrl}
                  alt="Generated"
                  className="w-full rounded-xl object-cover"
                  style={{ height: 144 }}
                  onMouseDown={(e) => e.stopPropagation()}
                  draggable={false}
                />
              )}
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={onGenerateVideo}
                disabled={isLoading || noKey}
                className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-purple-700 hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
              >
                {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Video size={12} />}
                {isLoading ? 'Processing…' : 'Animate to Video'}
              </button>
              {node.error && (
                <p className="mt-2 text-[10px] text-red-400 leading-relaxed">{node.error}</p>
              )}
            </>
          )}

          {node.type === 'video' && (
            node.videoUrl ? (
              <video
                src={node.videoUrl}
                controls
                loop
                className="w-full rounded-xl"
                style={{ height: 144 }}
                onMouseDown={(e) => e.stopPropagation()}
              />
            ) : (
              <div className="flex items-center justify-center h-32 rounded-xl bg-white/5 border border-white/10">
                <Loader2 size={20} className="animate-spin text-purple-400" />
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
