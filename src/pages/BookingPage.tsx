import { useState, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import Hero from '../components/booking/Hero'
import PolicyCard from '../components/booking/PolicyCard'
import ServicePicker from '../components/booking/ServicePicker'
import AddonPicker from '../components/booking/AddonPicker'
import DatePicker from '../components/booking/DatePicker'
import TimeGrid from '../components/booking/TimeGrid'
import ClientForm from '../components/booking/ClientForm'
import SuccessView from '../components/booking/SuccessView'
import { useServices } from '../hooks/useServices'
import { useWorkingHours } from '../hooks/useWorkingHours'
import { useBlockedDates } from '../hooks/useBlockedDates'
import { useAvailability } from '../hooks/useAvailability'
import { useBooking } from '../hooks/useBooking'
import { getLocalToday } from '../utils/time'
import type { Service } from '../types'

export default function BookingPage() {
  const [policyAccepted, setPolicyAccepted] = useState(false)
  const [primaryService, setPrimaryService] = useState<Service | null>(null)
  const [selectedAddons, setSelectedAddons] = useState<Service[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [form, setForm] = useState({ name: '', phone: '' })
  const [submitted, setSubmitted] = useState(false)

  const { services, loading: servicesLoading, error: servicesError } = useServices()
  const { hours: workingHours, loading: workingHoursLoading } = useWorkingHours()
  const { dates: blockedDates, loading: blockedDatesLoading } = useBlockedDates()

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

  const setupLoading = servicesLoading || workingHoursLoading || blockedDatesLoading

  const isDateBlocked = (dateStr: string) => {
    if (blockedDates.includes(dateStr)) return true
    const day = new Date(dateStr).getDay()
    const hours = workingHours.find((wh) => wh.day_of_week === day)
    return !hours?.is_open
  }

  const handleSelectService = (service: Service | null) => {
    setPrimaryService(service)
    setSelectedAddons([])
    setSelectedDate('')
    setSelectedTime('')
  }

  const handleToggleAddon = (addon: Service) => {
    setSelectedAddons((prev) => {
      const exists = prev.find((a) => a.id === addon.id)
      if (exists) return prev.filter((a) => a.id !== addon.id)
      return [...prev, addon]
    })
    setSelectedTime('')
  }

  const handleSelectDate = (date: string) => {
    setSelectedDate(date)
    setSelectedTime('')
  }

  const handleSubmit = async () => {
    if (!primaryService || !selectedDate || !selectedTime) return

    const [h, m] = selectedTime.split(':').map(Number)
    const endTotal = h * 60 + m + totalDuration
    const endTime = `${selectedDate}T${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}:00`
    const startTime = `${selectedDate}T${selectedTime}:00`

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
    <div className="min-h-screen bg-brand-bg">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-12">
        <Hero />
        <PolicyCard onAccept={() => setPolicyAccepted(true)} />

        {policyAccepted && (
          <>
            {servicesError ? (
              <FlowNotice
                title="Services could not load"
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
      className={`mb-4 rounded-3xl border px-6 py-5 shadow-sm ${
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
