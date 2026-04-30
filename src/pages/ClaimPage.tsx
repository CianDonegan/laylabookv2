import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { useClaim } from '../hooks/useClaim'
import type { ClaimOffer } from '../types'

type PageState =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'already_claimed'; offer: ClaimOffer }
  | { kind: 'expired'; offer: ClaimOffer | null }
  | { kind: 'claimable'; offer: ClaimOffer }
  | { kind: 'claiming'; offer: ClaimOffer }
  | { kind: 'success'; offer: ClaimOffer; bookingId: string }
  | { kind: 'claim_failed'; offer: ClaimOffer; message: string }

const moneyFormatter = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

function offerToInitialState(offer: ClaimOffer): PageState {
  if (offer.status === 'claimed') return { kind: 'already_claimed', offer }
  if (offer.status === 'expired' || offer.status === 'cancelled') {
    return { kind: 'expired', offer }
  }
  if (offer.status !== 'notified') return { kind: 'expired', offer }
  if (Date.parse(offer.expiresAt) <= Date.now()) return { kind: 'expired', offer }
  return { kind: 'claimable', offer }
}

export default function ClaimPage() {
  const { token } = useParams<{ token: string }>()
  const { fetchOffer, claimSlot } = useClaim()
  const [state, setState] = useState<PageState>(() =>
    token ? { kind: 'loading' } : { kind: 'invalid' }
  )

  useEffect(() => {
    if (!token) return

    let cancelled = false

    fetchOffer(token)
      .then((offer) => {
        if (cancelled) return
        if (!offer) {
          setState({ kind: 'invalid' })
          return
        }
        setState(offerToInitialState(offer))
      })
      .catch(() => {
        if (cancelled) return
        setState({ kind: 'invalid' })
      })

    return () => {
      cancelled = true
    }
  }, [token, fetchOffer])

  const claimable = state.kind === 'claimable' ? state.offer : null

  useEffect(() => {
    if (!claimable) return

    const tick = () => {
      if (Date.parse(claimable.expiresAt) <= Date.now()) {
        setState({ kind: 'expired', offer: claimable })
      }
    }

    tick()
    const intervalId = window.setInterval(tick, 1000)
    return () => window.clearInterval(intervalId)
  }, [claimable])

  const handleClaim = async () => {
    if (state.kind !== 'claimable' || !token) return
    const offer = state.offer
    setState({ kind: 'claiming', offer })

    try {
      const bookingId = await claimSlot(token)
      setState({ kind: 'success', offer, bookingId })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not claim that slot.'
      const normalized = message.toLowerCase()
      if (normalized.includes('already been claimed')) {
        setState({ kind: 'already_claimed', offer })
      } else if (normalized.includes('expired') || normalized.includes('invalid')) {
        setState({ kind: 'expired', offer })
      } else {
        setState({ kind: 'claim_failed', offer, message })
      }
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg px-4 py-10 text-brand-text sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 text-center">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#7f9670]">
            Layla Book
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Claim your slot</h1>
        </div>

        {state.kind === 'loading' && <ClaimSkeleton />}

        {state.kind === 'invalid' && (
          <ClaimNotice
            title="This claim link isn't valid"
            message="The link looks incorrect or the entry has been removed. If you joined the waitlist recently, watch your inbox for a fresh email."
          />
        )}

        {state.kind === 'expired' && (
          <ClaimNotice
            title="This offer has expired"
            message="Claim windows are 15 minutes. We've passed the slot to the next person on the waitlist — you'll stay on the list and we'll email you again the next time a matching time opens."
          />
        )}

        {state.kind === 'already_claimed' && (
          <ClaimNotice
            title="You've already claimed this slot"
            message={`Your booking with ${state.offer.clientName.split(' ')[0]} is confirmed. Check your email for the details.`}
          />
        )}

        {(state.kind === 'claimable' || state.kind === 'claiming' || state.kind === 'claim_failed') && (
          <ClaimableCard
            offer={state.offer}
            onClaim={handleClaim}
            claiming={state.kind === 'claiming'}
            errorMessage={state.kind === 'claim_failed' ? state.message : null}
          />
        )}

        {state.kind === 'success' && <SuccessCard offer={state.offer} />}

        <div className="mt-8 text-center">
          <Link
            to="/"
            className="text-xs font-semibold text-[#7f9670] underline-offset-2 hover:underline"
          >
            Back to booking
          </Link>
        </div>
      </div>
    </div>
  )
}

function ClaimSkeleton() {
  return (
    <div className="rounded-[2rem] border border-white bg-white p-6 shadow-[0_18px_50px_rgba(44,44,44,0.06)]">
      <div className="h-4 w-32 animate-pulse rounded-full bg-brand-bg" />
      <div className="mt-4 h-6 w-48 animate-pulse rounded-full bg-brand-bg" />
      <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-brand-bg" />
      <div className="mt-2 h-4 w-3/4 animate-pulse rounded-full bg-brand-bg" />
    </div>
  )
}

function ClaimNotice({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-[2rem] border border-brand-border bg-white px-6 py-7 shadow-[0_12px_40px_rgba(44,44,44,0.05)]">
      <h2 className="text-lg font-semibold text-brand-text">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-brand-muted">{message}</p>
    </div>
  )
}

function ClaimableCard({
  offer,
  onClaim,
  claiming,
  errorMessage,
}: {
  offer: ClaimOffer
  onClaim: () => void
  claiming: boolean
  errorMessage: string | null
}) {
  const primary = offer.services.find((service) => service.is_primary)
  const addons = offer.services.filter((service) => !service.is_primary)
  const start = parseISO(offer.offeredStartTime)
  const end = parseISO(offer.offeredEndTime)

  return (
    <div className="rounded-[2rem] border border-[#cfdcc8] bg-white px-6 py-7 shadow-[0_18px_50px_rgba(44,44,44,0.08)]">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#8fa17f] text-xs font-semibold text-white">
          ✓
        </span>
        <div className="flex-1">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#7f9670]">
            A slot opened up
          </p>
          <h2 className="mt-1 text-lg font-semibold text-brand-text">
            Hi {offer.clientName.split(' ')[0]}, this matches your waitlist request.
          </h2>
        </div>
      </div>

      <dl className="mt-5 space-y-3 rounded-2xl bg-brand-bg/70 px-4 py-4 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-brand-muted">Service</dt>
          <dd className="text-right font-medium text-brand-text">{primary?.name || 'Booking'}</dd>
        </div>
        {addons.length > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="text-brand-muted">Add-ons</dt>
            <dd className="text-right font-medium text-brand-text">
              {addons.map((service) => service.name).join(', ')}
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-brand-muted">Date</dt>
          <dd className="text-right font-medium text-brand-text">{format(start, 'EEE, d MMM')}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-brand-muted">Time</dt>
          <dd className="text-right font-medium text-brand-text">
            {format(start, 'HH:mm')} – {format(end, 'HH:mm')}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-brand-muted">Total</dt>
          <dd className="text-right font-medium text-brand-text">
            {moneyFormatter.format(offer.totalPrice)}
          </dd>
        </div>
      </dl>

      <Countdown expiresAt={offer.expiresAt} />

      {errorMessage && (
        <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-700">
          {errorMessage}
        </p>
      )}

      <button
        type="button"
        onClick={onClaim}
        disabled={claiming}
        className="mt-5 w-full rounded-full bg-[#8fa17f] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#7f9670] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {claiming ? 'Claiming…' : 'Claim this slot'}
      </button>

      <p className="mt-3 text-center text-[0.7rem] leading-relaxed text-brand-muted">
        Confirming books the slot under your existing waitlist details. No card needed now.
      </p>
    </div>
  )
}

function Countdown({ expiresAt }: { expiresAt: string }) {
  const expiryMs = useMemo(() => Date.parse(expiresAt), [expiresAt])
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, expiryMs - Date.now()))

  useEffect(() => {
    const tick = () => setRemainingMs(Math.max(0, expiryMs - Date.now()))
    tick()
    const intervalId = window.setInterval(tick, 1000)
    return () => window.clearInterval(intervalId)
  }, [expiryMs])

  const totalSeconds = Math.floor(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const urgent = remainingMs <= 60_000

  return (
    <div
      className={`mt-4 flex items-center justify-between rounded-2xl border px-4 py-3 text-xs ${
        urgent
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-[#cfdcc8] bg-[#f1f6ee] text-[#6f875f]'
      }`}
    >
      <span className="font-semibold uppercase tracking-[0.14em]">Time remaining</span>
      <span className="text-base font-semibold tabular-nums">
        {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  )
}

function SuccessCard({ offer }: { offer: ClaimOffer }) {
  const start = parseISO(offer.offeredStartTime)
  return (
    <div className="rounded-[2rem] border border-[#cfdcc8] bg-[#f1f6ee] px-6 py-7 shadow-[0_18px_50px_rgba(44,44,44,0.08)]">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#8fa17f] text-xs font-semibold text-white">
          ✓
        </span>
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#7f9670]">
            Booking confirmed
          </p>
          <h2 className="mt-1 text-lg font-semibold text-brand-text">You're booked in</h2>
          <p className="mt-2 text-sm leading-relaxed text-brand-muted">
            See you on <strong className="text-brand-text">{format(start, 'EEEE, d MMM')}</strong>{' '}
            at <strong className="text-brand-text">{format(start, 'HH:mm')}</strong>. A confirmation
            email is on its way.
          </p>
        </div>
      </div>
    </div>
  )
}
