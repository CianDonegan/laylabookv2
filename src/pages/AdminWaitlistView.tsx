import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import type { WaitlistStatus } from '../types'

interface WaitlistEntry {
  id: string
  client_name: string
  client_phone: string
  client_email: string
  service_id: string
  service_name: string
  preferred_date: string
  earliest_time: string
  latest_time: string
  status: WaitlistStatus
  position: number
  expires_at: string | null
  notified_at: string | null
  offered_start_time: string | null
}

function formatTimeRange(start: string, end: string) {
  return `${start.slice(0, 5)} – ${end.slice(0, 5)}`
}

function formatDateHeading(isoDate: string) {
  return format(parseISO(isoDate), 'EEEE, d MMMM yyyy')
}

function formatMinutesLeft(expiresAt: string, nowMs: number) {
  const remainingMs = Date.parse(expiresAt) - nowMs
  if (remainingMs <= 0) return 'Expiring'
  const minutes = Math.ceil(remainingMs / 60_000)
  if (minutes <= 1) return '<1m left'
  return `${minutes}m left`
}

function groupByDate(entries: WaitlistEntry[]) {
  const groups = new Map<string, WaitlistEntry[]>()
  for (const entry of entries) {
    const bucket = groups.get(entry.preferred_date)
    if (bucket) {
      bucket.push(entry)
    } else {
      groups.set(entry.preferred_date, [entry])
    }
  }
  return [...groups.entries()].map(([date, items]) => ({ date, items }))
}

export default function AdminWaitlistView({
  onSaved,
}: {
  onSaved: (message: string) => void
}) {
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false

    async function fetchEntries() {
      setLoading(true)
      setErrorMessage('')

      const { data, error } = await supabase
        .from('waitlist_with_position')
        .select(
          'id,client_name,client_phone,client_email,service_id,service_name,preferred_date,earliest_time,latest_time,status,position,expires_at,notified_at,offered_start_time'
        )
        .in('status', ['pending', 'notified'])
        .order('preferred_date', { ascending: true })
        .order('position', { ascending: true })

      if (cancelled) return

      if (error) {
        setEntries([])
        setErrorMessage('Could not load the waitlist. Please refresh and try again.')
      } else {
        setEntries(
          ((data as WaitlistEntry[]) || []).map((entry) => ({
            ...entry,
            position: Number(entry.position),
          }))
        )
      }

      setLoading(false)
    }

    void fetchEntries()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 60_000)
    return () => window.clearInterval(intervalId)
  }, [])

  const groups = useMemo(() => groupByDate(entries), [entries])

  const handleRemove = async (entry: WaitlistEntry) => {
    setRemovingId(entry.id)
    setRowError(null)

    const { data, error } = await supabase.rpc('admin_remove_waitlist_entry', {
      p_waitlist_id: entry.id,
    })

    setRemovingId(null)

    if (error) {
      setRowError({ id: entry.id, message: error.message || 'Could not remove this entry.' })
      return
    }

    if (!data) {
      setRowError({
        id: entry.id,
        message: 'This entry could not be removed (it may already be claimed or expired).',
      })
      return
    }

    setEntries((prev) => prev.filter((row) => row.id !== entry.id))
    setConfirmingId(null)
    onSaved('Removed from waitlist.')
  }

  if (loading) {
    return (
      <div className="grid gap-3">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-32 animate-pulse rounded-3xl border border-white bg-white shadow-[0_12px_40px_rgba(44,44,44,0.05)]"
          />
        ))}
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-7 text-sm text-rose-700">
        {errorMessage}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-brand-border bg-white px-6 py-14 text-center">
        <h2 className="text-xl font-semibold text-brand-text">No one on the waitlist</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-brand-muted">
          When clients join the waitlist for a busy day, they'll appear here in FIFO order.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {groups.map((group) => (
        <section
          key={group.date}
          className="rounded-3xl border border-white bg-white/80 p-4 shadow-[0_12px_40px_rgba(44,44,44,0.05)]"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-brand-border pb-3">
            <h2 className="rounded-full bg-brand-bg px-3 py-1.5 text-sm font-semibold text-brand-text">
              {formatDateHeading(group.date)}
            </h2>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brand-muted ring-1 ring-brand-border">
              {group.items.length} {group.items.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          <div className="grid gap-2">
            {group.items.map((entry) => (
              <WaitlistRow
                key={entry.id}
                entry={entry}
                nowMs={nowMs}
                confirming={confirmingId === entry.id}
                removing={removingId === entry.id}
                rowError={rowError?.id === entry.id ? rowError.message : null}
                onAskRemove={() => {
                  setRowError(null)
                  setConfirmingId(entry.id)
                }}
                onCancelRemove={() => setConfirmingId(null)}
                onConfirmRemove={() => void handleRemove(entry)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function WaitlistRow({
  entry,
  nowMs,
  confirming,
  removing,
  rowError,
  onAskRemove,
  onCancelRemove,
  onConfirmRemove,
}: {
  entry: WaitlistEntry
  nowMs: number
  confirming: boolean
  removing: boolean
  rowError: string | null
  onAskRemove: () => void
  onCancelRemove: () => void
  onConfirmRemove: () => void
}) {
  const isNotified = entry.status === 'notified'
  const tone = isNotified
    ? 'border-l-4 border-l-amber-300 bg-amber-50/60'
    : 'border-l-4 border-l-brand-sage bg-[#fbfcfa]'

  return (
    <article
      className={`rounded-2xl border border-transparent px-4 py-3 shadow-[0_10px_30px_rgba(44,44,44,0.04)] ${tone}`}
    >
      <div className="grid gap-3 xl:grid-cols-[3rem_minmax(0,1.1fr)_minmax(0,1fr)_auto] xl:items-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-bg text-sm font-semibold text-brand-text">
          #{entry.position}
        </div>

        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-brand-text">{entry.client_name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-brand-muted">
            <a className="hover:text-brand-text" href={`tel:${entry.client_phone}`}>
              {entry.client_phone}
            </a>
            <a className="hover:text-brand-text" href={`mailto:${entry.client_email}`}>
              {entry.client_email}
            </a>
          </div>
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-brand-text">{entry.service_name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-brand-muted ring-1 ring-brand-border">
              {formatTimeRange(entry.earliest_time, entry.latest_time)}
            </span>
            <StatusPill entry={entry} nowMs={nowMs} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          {!confirming ? (
            <button
              type="button"
              disabled={removing}
              onClick={onAskRemove}
              className="rounded-xl bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Remove
            </button>
          ) : (
            <>
              <span className="text-[0.7rem] text-brand-muted">Remove this entry?</span>
              <button
                type="button"
                disabled={removing}
                onClick={onConfirmRemove}
                className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {removing ? 'Removing…' : 'Yes, remove'}
              </button>
              <button
                type="button"
                disabled={removing}
                onClick={onCancelRemove}
                className="rounded-xl bg-stone-100 px-3 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {rowError && (
        <p className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {rowError}
        </p>
      )}
    </article>
  )
}

function StatusPill({ entry, nowMs }: { entry: WaitlistEntry; nowMs: number }) {
  if (entry.status === 'notified' && entry.expires_at) {
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
        Notified · {formatMinutesLeft(entry.expires_at, nowMs)}
        {entry.offered_start_time &&
          ` · offered ${format(parseISO(entry.offered_start_time), 'HH:mm')}`}
      </span>
    )
  }

  if (entry.status === 'pending') {
    return (
      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
        Waiting
      </span>
    )
  }

  return (
    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700 ring-1 ring-stone-200">
      {entry.status}
    </span>
  )
}

export { AdminWaitlistView }
