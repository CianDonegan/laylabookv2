import { useState, useMemo } from 'react'
import { addMinutes, format, parseISO } from 'date-fns'
import Hero from '../components/booking/Hero'
import PolicyCard from '../components/booking/PolicyCard'
import ServicePicker from '../components/booking/ServicePicker'
import AddonPicker from '../components/booking/AddonPicker'
import DatePicker from '../components/booking/DatePicker'
import TimeGrid from '../components/booking/TimeGrid'
import ClientForm from '../components/booking/ClientForm'
import WaitlistJoinForm, { type WaitlistJoinFormState } from '../components/booking/WaitlistJoinForm'
import SuccessView from '../components/booking/SuccessView'
import { useServices } from '../hooks/useServices'
import { useWorkingHours } from '../hooks/useWorkingHours'
import { useBlockedDates } from '../hooks/useBlockedDates'
import { useAvailability } from '../hooks/useAvailability'
import { useBooking } from '../hooks/useBooking'
import { useWaitlist } from '../hooks/useWaitlist'
import { getLocalToday } from '../utils/time'
import type { Service, WaitlistPosition } from '../types'

export default function BookingPage() {
  const [policyAccepted, setPolicyAccepted] = useState(false)
  const [primaryService, setPrimaryService] = useState<Service | null>(null)
  const [selectedAddons, setSelectedAddons] = useState<Service[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [submitted, setSubmitted] = useState(false)
  const [waitlistOpen, setWaitlistOpen] = useState(false)
  const [waitlistForm, setWaitlistForm] = useState<WaitlistJoinFormState>({
    name: '', email: '', phone: '', earliestTime: '09:00', latestTime: '17:00',
  })
  const [joinedWaitlist, setJoinedWaitlist] = useState<WaitlistPosition | null>(null)

  const { services, loading: servicesLoading, error: servicesError } = useServices()
  const { hours: workingHours, loading: workingHoursLoading, error: workingHoursError } = useWorkingHours()
  const { dates: blockedDates, loading: blockedDatesLoading, error: blockedDatesError } = useBlockedDates()

  const primaryServices = useMemo(() => services.filter((s) => !s.is_addon), [services])
  const addonServices = useMemo(() => services.filter((s) => s.is_addon), [services])

  const totalDuration = useMemo(() => {
    if (!primaryService) return 0
    const serviceTime = [primaryService, ...selectedAddons].reduce(
      (sum, s) => sum + s.duration_minutes,
      0
    )
    return serviceTime + (primaryService.buffer_minutes || 15)
  }, [primaryService, selectedAddons])

  const totalPrice = useMemo(() => {
    if (!primaryService) return 0
    return [primaryService, ...selectedAddons].reduce((sum, s) => {
      const price = parseFloat(String(s.price))
      return sum + (isNaN(price) ? 0 : price)
    }, 0)
  }, [primaryService, selectedAddons])

  const {
    slots: availableSlots,
    loading: slotsLoading,
    error: slotsError,
  } = useAvailability(selectedDate, totalDuration)
  const { submit: submitBooking, loading: submitting, error: bookingError } = useBooking()
  const {
    join: joinWaitlist,
    leave: leaveWaitlist,
    getPosition: getWaitlistPosition,
    loading: waitlistLoading,
    error: waitlistError,
    waitlistId,
  } = useWaitlist()

  const setupLoading = servicesLoading || workingHoursLoading || blockedDatesLoading

  const isDateBlocked = (dateStr: string) => {
    if (blockedDates.includes(dateStr)) return true
    const day = parseISO(dateStr).getDay()
    const hours = workingHours.find((wh) => wh.day_of_week === day)
    return !hours?.is_open
  }

  const resetWaitlistUi = () => {
    setWaitlistOpen(false)
    setJoinedWaitlist(null)
  }

  const handleSelectService = (service: Service | null) => {
    setPrimaryService(service)
    setSelectedAddons([])
    setSelectedDate('')
    setSelectedTime('')
    resetWaitlistUi()
  }

  const handleToggleAddon = (addon: Service) => {
    setSelectedAddons((prev) => {
      const exists = prev.find((a) => a.id === addon.id)
      if (exists) return prev.filter((a) => a.id !== addon.id)
      return [...prev, addon]
    })
    setSelectedTime('')
    resetWaitlistUi()
  }

  const handleSelectDate = (date: string) => {
    setSelectedDate(date)
    setSelectedTime('')
    resetWaitlistUi()

    // Default the waitlist time range to the salon's working hours for that
    // day, so the user starts with a sensible window. Stripping to HH:MM
    // because Postgres `time` returns 'HH:MM:SS' and input[type=time] wants 'HH:MM'.
    const day = parseISO(date).getDay()
    const hours = workingHours.find((wh) => wh.day_of_week === day && wh.is_open)
    setWaitlistForm((prev) => ({
      ...prev,
      earliestTime: hours ? hours.start_time.slice(0, 5) : '09:00',
      latestTime:   hours ? hours.end_time.slice(0, 5)   : '17:00',
    }))
  }

  const handleJoinWaitlist = async () => {
    if (!primaryService || !selectedDate) return
    try {
      const id = await joinWaitlist({
        name: waitlistForm.name,
        phone: waitlistForm.phone,
        email: waitlistForm.email,
        serviceId: primaryService.id,
        addonServiceIds: selectedAddons.map((a) => a.id),
        preferredDate: selectedDate,
        earliestTime: waitlistForm.earliestTime,
        latestTime: waitlistForm.latestTime,
      })
      const position = await getWaitlistPosition(id)
      setJoinedWaitlist(position)
      setWaitlistOpen(false)
    } catch {
      // Error is displayed via waitlistError
    }
  }

  const handleSubmit = async () => {
    if (!primaryService || !selectedDate || !selectedTime) return

    const startTime = `${selectedDate}T${selectedTime}:00`
    const endTime = format(addMinutes(parseISO(startTime), totalDuration), "yyyy-MM-dd'T'HH:mm:ss")

    const servicesPayload = [
      {
        service_id: primaryService.id,
        is_primary: true,
        price: primaryService.price,
        name: primaryService.name,
      },
      ...selectedAddons.map((a) => ({
        service_id: a.id,
        is_primary: false,
        price: a.price,
        name: a.name,
      })),
    ]

    try {
      await submitBooking({
        name: form.name,
        email: form.email,
        phone: form.phone,
        startTime,
        endTime,
        totalPrice,
        services: servicesPayload,
      })
      setSubmitted(true)
    } catch {
      // Error is displayed via bookingError
    }
  }

  if (submitted) return <SuccessView />

  return (
    <div className="min-h-screen bg-[#f7f8f4]">
      <div className="max-w-2xl mx-auto px-4 pt-8 pb-14">
        <Hero />
        <PolicyCard onAccept={() => setPolicyAccepted(true)} />

        {policyAccepted && (
          <>
            {servicesError || workingHoursError || blockedDatesError ? (
              <FlowNotice
                title="Could not load booking options"
                message="Please refresh the page and try again."
                tone="error"
              />
            ) : setupLoading ? (
              <FlowNotice title="Preparing booking options" message="Loading services and availability..." />
            ) : (
              <>
                <ServicePicker
                  services={primaryServices}
                  selected={primaryService}
                  onSelect={handleSelectService}
                />

                <AddonPicker
                  addons={addonServices}
                  selectedAddons={selectedAddons}
                  primaryService={primaryService}
                  onToggle={handleToggleAddon}
                />

                {primaryService && (
                  <DatePicker
                    selectedDate={selectedDate}
                    onSelect={handleSelectDate}
                    isDateBlocked={isDateBlocked}
                    minDate={getLocalToday()}
                  />
                )}

                {selectedDate && (
                  <TimeGrid
                    slots={availableSlots}
                    selectedTime={selectedTime}
                    onSelect={setSelectedTime}
                    loading={slotsLoading}
                    error={slotsError}
                  />
                )}

                {selectedDate && primaryService && !joinedWaitlist && !waitlistOpen && (
                  <WaitlistDisclosure onOpen={() => setWaitlistOpen(true)} />
                )}

                {selectedDate && primaryService && waitlistOpen && (
                  <WaitlistJoinForm
                    form={waitlistForm}
                    onChange={setWaitlistForm}
                    onSubmit={handleJoinWaitlist}
                    onCancel={() => setWaitlistOpen(false)}
                    loading={waitlistLoading}
                    error={waitlistError}
                    summary={{
                      primaryService,
                      addons: selectedAddons,
                      dateLabel: format(parseISO(selectedDate), 'EEE, d MMM'),
                      duration: totalDuration - (primaryService.buffer_minutes || 15),
                      totalPrice: totalPrice.toFixed(2),
                    }}
                  />
                )}

                {joinedWaitlist && waitlistId && (
                  <WaitlistJoinedNotice
                    position={joinedWaitlist}
                    email={waitlistForm.email}
                    onRemove={() => leaveWaitlist(waitlistId, waitlistForm.phone)}
                    onRemoved={resetWaitlistUi}
                  />
                )}

                {selectedTime && primaryService && (
                  <ClientForm
                    form={form}
                    onChange={setForm}
                    onSubmit={handleSubmit}
                    loading={submitting}
                    error={bookingError}
                    summary={{
                      primaryService,
                      addons: selectedAddons,
                      dateLabel: format(parseISO(selectedDate), 'EEE, d MMM'),
                      time: selectedTime,
                      duration: totalDuration - (primaryService.buffer_minutes || 15),
                      totalPrice: totalPrice.toFixed(2),
                    }}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function WaitlistDisclosure({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="mb-4 rounded-[1.5rem] border border-dashed border-[#cfdcc8] bg-[#fbfcfa] px-5 py-4 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-text">Can't find a time?</p>
          <p className="mt-0.5 text-xs leading-relaxed text-brand-muted">
            Join the waitlist and we'll email you when a matching slot opens.
          </p>
        </div>
        <button
          onClick={onOpen}
          className="shrink-0 rounded-full border border-[#cfdcc8] bg-white px-4 py-2 text-xs font-semibold text-[#6f875f] transition-colors hover:bg-[#f1f6ee]"
        >
          Join waitlist
        </button>
      </div>
    </div>
  )
}

function WaitlistJoinedNotice({
  position,
  email,
  onRemove,
  onRemoved,
}: {
  position: WaitlistPosition
  email: string
  onRemove: () => Promise<boolean>
  onRemoved: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setRemoving(true)
    setRemoveError(null)
    try {
      const ok = await onRemove()
      if (ok) {
        onRemoved()
      } else {
        setRemoveError("We couldn't find your waitlist entry. It may have already been removed.")
        setConfirming(false)
      }
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : 'Could not remove you from the waitlist.')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="mb-4 rounded-[1.5rem] border border-[#cfdcc8] bg-[#f1f6ee] px-5 py-4 sm:px-6 shadow-[inset_0_0_0_1px_rgba(143,161,127,0.08)]">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#8fa17f] text-xs font-semibold text-white">
          ✓
        </span>
        <div className="flex-1">
          <p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#7f9670]">
            Waitlist
          </p>
          <h2 className="text-sm font-semibold text-brand-text">You're on the list</h2>
          <p className="mt-1 text-xs leading-relaxed text-brand-muted">
            Position #{position.position}
            {position.aheadCount > 0 && ` — ${position.aheadCount} ahead of you`}.
            We'll email <strong className="text-brand-text">{email}</strong> the moment a matching slot opens.
          </p>

          {removeError && (
            <p className="mt-2 text-xs leading-relaxed text-red-600">{removeError}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!confirming ? (
              <button
                type="button"
                onClick={() => {
                  setRemoveError(null)
                  setConfirming(true)
                }}
                className="rounded-full border border-[#cfdcc8] bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-[#6f875f] transition-colors hover:bg-white/80"
              >
                Remove me
              </button>
            ) : (
              <>
                <span className="text-[0.7rem] text-brand-muted">Remove yourself from the waitlist?</span>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={removing}
                  className="rounded-full bg-[#8fa17f] px-3 py-1.5 text-[0.7rem] font-semibold text-white transition-colors hover:bg-[#7f9670] disabled:opacity-60"
                >
                  {removing ? 'Removing…' : 'Yes, remove'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={removing}
                  className="rounded-full border border-[#cfdcc8] bg-white px-3 py-1.5 text-[0.7rem] font-semibold text-[#6f875f] transition-colors hover:bg-white/80 disabled:opacity-60"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function FlowNotice({
  title,
  message,
  tone = 'neutral',
}: {
  title: string
  message: string
  tone?: 'neutral' | 'error'
}) {
  return (
    <div
      className={`mb-4 rounded-[2rem] border px-6 py-5 shadow-[0_12px_40px_rgba(44,44,44,0.05)] ${
        tone === 'error'
          ? 'border-red-100 bg-red-50 text-red-700'
          : 'border-brand-border bg-white text-brand-text'
      }`}
    >
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className={`mt-2 text-xs leading-relaxed ${tone === 'error' ? 'text-red-600' : 'text-brand-muted'}`}>
        {message}
      </p>
    </div>
  )
}
