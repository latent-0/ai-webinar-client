import { useState } from 'react'
import { Plus, Star, Trash2, Briefcase, ArrowLeft, Square, CheckSquare } from 'lucide-react'
import SectionShell from '../components/SectionShell'
import { sectionById } from '../lib/ia'
import { usePersistStore } from '../store/persist'

/**
 * Projects (LLP-119) — my work & collections with a functional project
 * workspace (overview, tasks) backed by the persistent layer.
 */
export default function Projects() {
  const section = sectionById('projects')!
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <SectionShell
      section={section}
      defaultTab="all"
      actions={<NewProjectButton onCreated={setOpenId} />}
    >
      {(tab) => {
        if (openId) return <ProjectDetail id={openId} onBack={() => setOpenId(null)} />
        if (tab === 'templates') return <Templates />
        return <ProjectList starredOnly={tab === 'starred'} onOpen={setOpenId} />
      }}
    </SectionShell>
  )
}

function NewProjectButton({ onCreated }: { onCreated: (id: string) => void }) {
  const addProject = usePersistStore((s) => s.addProject)
  return (
    <button
      onClick={() => onCreated(addProject('Untitled project'))}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold"
    >
      <Plus size={15} /> New project
    </button>
  )
}

function ProjectList({ starredOnly, onOpen }: { starredOnly: boolean; onOpen: (id: string) => void }) {
  const projects = usePersistStore((s) => s.projects)
  const updateProject = usePersistStore((s) => s.updateProject)
  const removeProject = usePersistStore((s) => s.removeProject)

  const list = projects.filter((p) => (starredOnly ? p.starred : true))
  if (list.length === 0) return <div className="text-center py-16 text-sm text-[var(--muted)]">No projects yet. Create one to get started.</div>

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {list.map((p) => {
        const done = p.tasks.filter((t) => t.done).length
        return (
          <div key={p.id} className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] flex flex-col">
            <div className="flex items-start justify-between mb-2">
              <button onClick={() => onOpen(p.id)} className="text-left flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center"><Briefcase size={15} className="text-indigo-600 dark:text-indigo-400" /></div>
              </button>
              <div className="flex items-center gap-1">
                <button onClick={() => updateProject(p.id, { starred: !p.starred })} title="Star"><Star size={14} className={p.starred ? 'text-amber-500 fill-amber-500' : 'text-[var(--muted)]'} /></button>
                <button onClick={() => removeProject(p.id)} title="Delete"><Trash2 size={14} className="text-[var(--muted)] hover:text-red-500" /></button>
              </div>
            </div>
            <button onClick={() => onOpen(p.id)} className="text-left">
              <p className="text-sm font-semibold leading-tight mb-1">{p.name}</p>
              <p className="text-xs text-[var(--muted)] leading-relaxed line-clamp-2">{p.description || 'No description'}</p>
            </button>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-[var(--surface-3)] overflow-hidden">
                <div className="h-full bg-indigo-500" style={{ width: `${p.tasks.length ? (done / p.tasks.length) * 100 : 0}%` }} />
              </div>
              <span className="text-[11px] text-[var(--muted)]">{done}/{p.tasks.length}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ProjectDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const project = usePersistStore((s) => s.projects.find((p) => p.id === id))
  const updateProject = usePersistStore((s) => s.updateProject)
  const addProjectTask = usePersistStore((s) => s.addProjectTask)
  const toggleProjectTask = usePersistStore((s) => s.toggleProjectTask)
  const [task, setTask] = useState('')

  if (!project) return <div className="text-sm text-[var(--muted)]">Project not found. <button onClick={onBack} className="text-indigo-600 underline">Back</button></div>

  return (
    <div>
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--text)] mb-4"><ArrowLeft size={15} /> All projects</button>

      <input
        value={project.name}
        onChange={(e) => updateProject(id, { name: e.target.value })}
        className="w-full text-lg font-bold bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-indigo-500 focus:outline-none mb-2 pb-1"
      />
      <textarea
        value={project.description}
        onChange={(e) => updateProject(id, { description: e.target.value })}
        placeholder="Add a description…"
        rows={2}
        className="w-full text-sm text-[var(--muted)] bg-transparent resize-none focus:outline-none mb-6"
      />

      <div className="max-w-xl">
        <h3 className="text-sm font-semibold mb-3">Tasks & to-dos</h3>
        <div className="space-y-1.5 mb-3">
          {project.tasks.map((t) => (
            <button key={t.id} onClick={() => toggleProjectTask(id, t.id)} className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-[var(--surface-3)] text-left">
              {t.done ? <CheckSquare size={16} className="text-indigo-500" /> : <Square size={16} className="text-[var(--muted)]" />}
              <span className={`text-sm ${t.done ? 'line-through text-[var(--muted)]' : ''}`}>{t.title}</span>
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); if (task.trim()) { addProjectTask(id, task.trim()); setTask('') } }}
          className="flex gap-2"
        >
          <input
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="Add a task…"
            className="flex-1 px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button type="submit" className="px-3 py-2 rounded-xl bg-[var(--surface-3)] text-sm font-medium">Add</button>
        </form>
      </div>
    </div>
  )
}

function Templates() {
  const addProject = usePersistStore((s) => s.addProject)
  const templates = [
    { name: 'Workshop plan', desc: 'Plan and run a live workshop end-to-end.' },
    { name: 'Practice project', desc: 'A Play-based hands-on build.' },
    { name: 'Research collection', desc: 'Gather sources, notes and findings.' },
  ]
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {templates.map((t) => (
        <div key={t.name} className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <p className="text-sm font-semibold mb-1">{t.name}</p>
          <p className="text-xs text-[var(--muted)] mb-3">{t.desc}</p>
          <button onClick={() => addProject(t.name, t.desc)} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium">Use template</button>
        </div>
      ))}
    </div>
  )
}
