import { useState, useEffect } from 'react'
import { Link2, ShieldCheck, Trash2, Download, Calendar, HardDrive, Check, Loader2 } from 'lucide-react'
import SectionShell from '../components/SectionShell'
import { sectionById } from '../lib/ia'
import { usePersistStore } from '../store/persist'
import { CLAUDE_MODELS } from '../lib/claude'
import { getIntegrationStatus, disconnectGoogle, GOOGLE_CONNECT_URL, type IntegrationStatus } from '../lib/integrationsClient'

/**
 * Settings (LLP-121) — account & preferences. Preferences persist to the
 * system layer and take effect immediately (model preference, privacy
 * guardrail, AI memory toggle, etc.).
 */
export default function Settings() {
  const section = sectionById('settings')!
  return (
    <SectionShell section={section} defaultTab="profile">
      {(tab) => {
        if (tab === 'preferences') return <Preferences />
        if (tab === 'integrations') return <Integrations />
        if (tab === 'ai') return <AiSettings />
        if (tab === 'admin') return <Admin />
        return <Profile />
      }}
    </SectionShell>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-[var(--border)] last:border-0">
      <div><p className="text-sm font-medium">{label}</p>{hint && <p className="text-xs text-[var(--muted)]">{hint}</p>}</div>
      {children}
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${on ? 'bg-indigo-600' : 'bg-[var(--surface-3)]'}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
    </button>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="max-w-xl p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">{children}</div>
}

function Profile() {
  const profile = usePersistStore((s) => s.profile)
  const setProfile = usePersistStore((s) => s.setProfile)
  return (
    <Card>
      <label className="block text-sm font-medium mb-1">Name</label>
      <input value={profile.name} onChange={(e) => setProfile({ name: e.target.value })}
        className="w-full mb-4 px-3 py-2 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      <label className="block text-sm font-medium mb-1">Bio</label>
      <textarea value={profile.bio} onChange={(e) => setProfile({ bio: e.target.value })} rows={3} placeholder="Tell us about yourself…"
        className="w-full px-3 py-2 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      <p className="text-xs text-[var(--muted)] mt-3">Changes save automatically.</p>
    </Card>
  )
}

function Preferences() {
  const settings = usePersistStore((s) => s.settings)
  const setSettings = usePersistStore((s) => s.setSettings)
  return (
    <Card>
      <Row label="Language & region">
        <select value={settings.language} onChange={(e) => setSettings({ language: e.target.value })}
          className="px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm focus:outline-none">
          <option value="en-US">English (US)</option>
          <option value="en-GB">English (UK)</option>
          <option value="ga-IE">Gaeilge</option>
          <option value="fr-FR">Français</option>
        </select>
      </Row>
      <Row label="Reduce motion" hint="Minimise animations across the app.">
        <Toggle on={settings.reduceMotion} onChange={(v) => setSettings({ reduceMotion: v })} />
      </Row>
      <Row label="Mentions" hint="Notify me when I'm mentioned.">
        <Toggle on={settings.notifications.mentions} onChange={(v) => setSettings({ notifications: { ...settings.notifications, mentions: v } })} />
      </Row>
      <Row label="Session reminders" hint="Remind me before live sessions.">
        <Toggle on={settings.notifications.sessionReminders} onChange={(v) => setSettings({ notifications: { ...settings.notifications, sessionReminders: v } })} />
      </Row>
      <Row label="Product updates">
        <Toggle on={settings.notifications.productUpdates} onChange={(v) => setSettings({ notifications: { ...settings.notifications, productUpdates: v } })} />
      </Row>
    </Card>
  )
}

function Integrations() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { void getIntegrationStatus().then(setStatus) }, [])

  const google = status?.google
  async function disconnect() {
    setBusy(true)
    await disconnectGoogle()
    setStatus(await getIntegrationStatus())
    setBusy(false)
  }

  return (
    <div className="max-w-xl space-y-2">
      {/* Google Calendar + Drive — one connection grants both (read-only). */}
      <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--surface-3)] flex items-center justify-center shrink-0">
            <Calendar size={16} className="text-[var(--muted)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Google Calendar &amp; Drive</p>
            <p className="text-xs text-[var(--muted)]">See upcoming events in Live and your recent Drive files in Library. Read-only.</p>
          </div>
          {!status ? (
            <Loader2 size={15} className="animate-spin text-[var(--muted)] shrink-0" />
          ) : !google?.configured ? (
            <span className="text-xs px-3 py-1.5 rounded-lg font-medium bg-[var(--surface-3)] text-[var(--muted)] shrink-0">Not configured</span>
          ) : google.connected ? (
            <button onClick={disconnect} disabled={busy} className="text-xs px-3 py-1.5 rounded-lg font-medium bg-[var(--surface-3)] hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 disabled:opacity-60 shrink-0">
              {busy ? 'Disconnecting…' : 'Disconnect'}
            </button>
          ) : (
            <a href={GOOGLE_CONNECT_URL} className="text-xs px-3 py-1.5 rounded-lg font-medium bg-indigo-600 text-white hover:bg-indigo-500 shrink-0">Connect</a>
          )}
        </div>
        {google?.connected && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[var(--border)] text-xs text-emerald-600">
            <span className="inline-flex items-center gap-1"><Check size={13} /> Calendar</span>
            <span className="inline-flex items-center gap-1"><HardDrive size={13} /> Drive</span>
            <span className="text-[var(--muted)]">connected</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="w-9 h-9 rounded-xl bg-[var(--surface-3)] flex items-center justify-center"><Link2 size={16} className="text-[var(--muted)]" /></div>
        <div className="flex-1"><p className="text-sm font-medium">API &amp; Webhooks</p><p className="text-xs text-[var(--muted)]">Automate with your stack</p></div>
        <span className="text-xs px-3 py-1.5 rounded-lg font-medium bg-[var(--surface-3)] text-[var(--muted)]">Coming soon</span>
      </div>
    </div>
  )
}

function AiSettings() {
  const settings = usePersistStore((s) => s.settings)
  const setSettings = usePersistStore((s) => s.setSettings)
  const aiMemory = usePersistStore((s) => s.aiMemory)
  const clearAiMemory = usePersistStore((s) => s.clearAiMemory)

  function exportMemory() {
    const blob = new Blob([JSON.stringify(aiMemory, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'ai-memory.json'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <Row label="Preferred model" hint="Used as the primary provider across surfaces.">
        <select value={settings.aiModelPreference} onChange={(e) => setSettings({ aiModelPreference: e.target.value })}
          className="px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm focus:outline-none">
          {CLAUDE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </Row>
      <Row label="Allow Claude" hint="Privacy guardrail for the agent core.">
        <Toggle on={settings.allowClaude} onChange={(v) => setSettings({ allowClaude: v })} />
      </Row>
      <Row label="Allow Gemini">
        <Toggle on={settings.allowGemini} onChange={(v) => setSettings({ allowGemini: v })} />
      </Row>
      <Row label="AI memory" hint="Let the assistant remember context about you.">
        <Toggle on={settings.aiMemoryEnabled} onChange={(v) => setSettings({ aiMemoryEnabled: v })} />
      </Row>
      <div className="flex items-center gap-2 pt-4">
        <button onClick={exportMemory} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[var(--surface-3)] font-medium"><Download size={13} /> Export memory</button>
        <button onClick={clearAiMemory} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 font-medium"><Trash2 size={13} /> Clear memory</button>
      </div>
    </Card>
  )
}

function Admin() {
  const role = usePersistStore((s) => s.role)
  if (role !== 'facilitator') {
    return (
      <div className="max-w-xl p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] flex items-center gap-3">
        <ShieldCheck size={18} className="text-[var(--muted)]" />
        <p className="text-sm text-[var(--muted)]">Admin settings are available to facilitators. Switch role from the top bar to view them.</p>
      </div>
    )
  }
  const items = ['Organization', 'Users & Roles', 'Content Audit', 'System Settings', 'Billing']
  return (
    <div className="max-w-xl space-y-2">
      <p className="text-xs text-[var(--muted)] mb-1">Admin tools are on the roadmap and not yet available in this build.</p>
      {items.map((i) => (
        <div key={i} className="flex items-center justify-between p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <p className="text-sm font-medium">{i}</p>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface-3)] text-[var(--muted)]">Coming soon</span>
        </div>
      ))}
    </div>
  )
}
