import { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import {
  addDays,
  addMonths,
  differenceInMinutes,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import type { Booking } from '../types'

const ADMIN_PASSWORD = 'layla2026'

type AdminView = 'today' | 'week' | 'month' | 'list'
type StatusFilter = 'all' | Booking['status']

const viewTabs: { value: AdminView; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'list', label: 'List' },
]

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No-show' },
]

const statusStyles: Record<Booking['status'], string> = {
  pending: 'bg-amber-100 text-amber-800 ring-amber-200',
  confirmed: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  completed: 'bg-blue-100 text-blue-800 ring-blue-200',
  cancelled: 'bg-stone-100 text-stone-600 ring-stone-200',
  no_show: 'bg-rose-100 text-rose-800 ring-rose-200',
}

const statusLabels: Record<Booking['status'], string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
}

const moneyFormatter = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

function getPrimaryService(booking: Booking) {
  return booking.booking_services?.find((service) => service.is_primary)?.name_at_booking || 'Booking'
}

function getAddons(booking: Booking) {
  return booking.booking_services?.filter((service) => !service.is_primary) || []
}

function isActiveBooking(booking: Booking) {
  return booking.status === 'pending' || booking.status === 'confirmed'
}

function getDurationMinutes(booking: Booking) {
  return Math.max(0, differenceInMinutes(parseISO(booking.end_time), parseISO(booking.start_time)))
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`
}

function formatServicePrice(price: number | null | undefined) {
  if (price === null || price === undefined) return ''
  return moneyFormatter.format(Number(price))
}

function getScheduleBlockHeight(booking: Booking) {
  const duration = getDurationMinutes(booking)
  return Math.min(260, Math.max(150, duration * 1.8))
}

function getLocalDateKey(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

function getLocalDayStart(date = new Date()) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  return start
}

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<AdminView>('today')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  async function fetchBookings(nextView = view) {
    setLoading(true)
    setErrorMessage('')

    let query = supabase
      .from('bookings')
      .select('*, booking_services(name_at_booking, is_primary, price_at_booking)')
      .order('start_time', { ascending: true })

    if (nextView === 'today') {
      const start = getLocalDayStart()
      const end = addDays(start, 1)
      query = query.gte('start_time', start.toISOString()).lt('start_time', end.toISOString())
    } else if (nextView === 'week') {
      const start = getLocalDayStart()
      const end = addDays(start, 7)
      query = query.gte('start_time', start.toISOString()).lt('start_time', end.toISOString())
    } else if (nextView === 'month') {
      const start = startOfMonth(getLocalDayStart())
      const end = addMonths(start, 1)
      query = query.gte('start_time', start.toISOString()).lt('start_time', end.toISOString())
    }

    const { data, error } = await query

    if (error) {
      setErrorMessage('Could not load bookings. Please try again.')
      setBookings([])
    } else {
      setBookings((data as Booking[]) || [])
    }

    setLoading(false)
  }

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true)
      setPassword('')
      void fetchBookings('today')
      return
    }

    setErrorMessage('That password is not right.')
  }

  const updateStatus = async (id: string, status: Booking['status']) => {
    setUpdatingId(id)
    setErrorMessage('')

    const { data, error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', id)
      .select('id,status')

    if (error) {
      setErrorMessage('Could not update this booking. Please try again.')
      setUpdatingId(null)
      return
    }

    if (!data || data.length === 0) {
      setErrorMessage('Could not update booking. Please try again.')
      setUpdatingId(null)
      return
    }

    await fetchBookings()
    setUpdatingId(null)
  }

  const visibleBookings = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return bookings.filter((booking) => {
      const matchesStatus = statusFilter === 'all' || booking.status === statusFilter
      const matchesSearch =
        !normalizedSearch ||
        booking.client_name.toLowerCase().includes(normalizedSearch) ||
        booking.client_phone.toLowerCase().includes(normalizedSearch) ||
        getPrimaryService(booking).toLowerCase().includes(normalizedSearch)

      return matchesStatus && matchesSearch
    })
  }, [bookings, search, statusFilter])

  const stats = useMemo(() => {
    const activeBookings = bookings.filter(isActiveBooking)
    const revenue = activeBookings.reduce((sum, booking) => sum + Number(booking.total_price || 0), 0)

    return {
      total: bookings.length,
      pending: bookings.filter((booking) => booking.status === 'pending').length,
      confirmed: bookings.filter((booking) => booking.status === 'confirmed').length,
      revenue,
    }
  }, [bookings])

  const todaySummary = useMemo(() => {
    const activeBookings = visibleBookings.filter(isActiveBooking)
    const totalBookedMinutes = activeBookings.reduce((sum, booking) => sum + getDurationMinutes(booking), 0)

    return {
      firstAppointment: visibleBookings[0] ? format(parseISO(visibleBookings[0].start_time), 'HH:mm') : 'None',
      lastAppointment: visibleBookings[visibleBookings.length - 1]
        ? format(parseISO(visibleBookings[visibleBookings.length - 1].end_time), 'HH:mm')
        : 'None',
      totalBookedTime: formatDuration(totalBookedMinutes),
      activeCount: activeBookings.length,
    }
  }, [visibleBookings])

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#f7f8f4] px-4 py-8 text-brand-text">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
          <div className="w-full max-w-md rounded-[2rem] border border-white/80 bg-white p-8 shadow-[0_24px_80px_rgba(44,44,44,0.10)]">
            <div className="mb-8">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-brand-sage">
                Private dashboard
              </p>
              <h1 className="text-3xl font-semibold text-brand-text">Admin Access</h1>
              <p className="mt-3 text-sm leading-6 text-brand-muted">
                Sign in to manage bookings, confirmations, and client appointments.
              </p>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-brand-text" htmlFor="admin-password">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setErrorMessage('')
                }}
                onKeyDown={(event) => event.key === 'Enter' && handleLogin()}
                className="w-full rounded-2xl border border-brand-border bg-brand-bg px-4 py-3 text-sm text-brand-text outline-none transition focus:border-brand-sage focus:ring-4 focus:ring-brand-sage-light"
              />
              {errorMessage && <p className="text-sm text-rose-600">{errorMessage}</p>}
              <button
                onClick={handleLogin}
                className="w-full rounded-2xl bg-brand-text px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-black focus:outline-none focus:ring-4 focus:ring-brand-sage-light"
              >
                Enter Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f8f4] text-brand-text">
      <header className="border-b border-brand-border/80 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-brand-sage">
              LaylaBook Admin
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-brand-text">Bookings Dashboard</h1>
            <p className="mt-2 text-sm text-brand-muted">
              Review appointments, confirm requests, and keep the day running smoothly.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void fetchBookings()}
              className="rounded-2xl border border-brand-border bg-white px-4 py-2.5 text-sm font-medium text-brand-text shadow-sm transition hover:border-brand-sage"
            >
              Refresh
            </button>
            <button
              onClick={() => setAuthenticated(false)}
              className="rounded-2xl bg-brand-text px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-black"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {errorMessage && (
          <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Bookings" value={stats.total} detail={`${visibleBookings.length} showing`} />
          <StatCard label="Pending" value={stats.pending} detail="Awaiting confirmation" />
          <StatCard label="Confirmed" value={stats.confirmed} detail="Ready to go" />
          <StatCard label="Active value" value={moneyFormatter.format(stats.revenue)} detail="Pending and confirmed" />
        </section>

        <section className="mt-6 rounded-3xl border border-white bg-white p-4 shadow-[0_18px_50px_rgba(44,44,44,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex rounded-2xl bg-brand-bg p-1">
              {viewTabs.map((item) => (
                <button
                  key={item.value}
                  onClick={() => {
                    setView(item.value)
                    void fetchBookings(item.value)
                  }}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                    view === item.value
                      ? 'bg-white text-brand-text shadow-sm'
                      : 'text-brand-muted hover:text-brand-text'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem] lg:min-w-[34rem]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, phone, or service"
                className="w-full rounded-2xl border border-brand-border bg-brand-bg px-4 py-2.5 text-sm outline-none transition focus:border-brand-sage focus:ring-4 focus:ring-brand-sage-light"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="w-full rounded-2xl border border-brand-border bg-brand-bg px-4 py-2.5 text-sm outline-none transition focus:border-brand-sage focus:ring-4 focus:ring-brand-sage-light"
              >
                {statusFilters.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="mt-5">
          {loading ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-36 animate-pulse rounded-3xl border border-white bg-white shadow-[0_12px_40px_rgba(44,44,44,0.05)]"
                />
              ))}
            </div>
          ) : view === 'week' ? (
            <WeekView bookings={visibleBookings} />
          ) : view === 'month' ? (
            <MonthView bookings={visibleBookings} />
          ) : visibleBookings.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-brand-border bg-white px-6 py-14 text-center">
              <h2 className="text-xl font-semibold text-brand-text">No bookings found</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-brand-muted">
                Try a different date range, status, or search term.
              </p>
            </div>
          ) : (
            <>
              {view === 'today' && <TodaySummary summary={todaySummary} />}
              {view === 'today' ? (
                <TodaySchedule
                  bookings={visibleBookings}
                  updatingId={updatingId}
                  onUpdateStatus={updateStatus}
                />
              ) : (
                <div className="grid gap-3">
                  {visibleBookings.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      updating={updatingId === booking.id}
                      onUpdateStatus={updateStatus}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  )
}

function TodaySummary({
  summary,
}: {
  summary: {
    firstAppointment: string
    lastAppointment: string
    totalBookedTime: string
    activeCount: number
  }
}) {
  return (
    <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <ScheduleStat label="First appointment" value={summary.firstAppointment} />
      <ScheduleStat label="Last appointment" value={summary.lastAppointment} />
      <ScheduleStat label="Booked time" value={summary.totalBookedTime} />
      <ScheduleStat label="Pending/confirmed" value={summary.activeCount} />
    </div>
  )
}

function WeekView({ bookings }: { bookings: Booking[] }) {
  const days = useMemo(() => {
    const start = getLocalDayStart()
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(start, index)
      const key = getLocalDateKey(date)
      const dayBookings = bookings.filter((booking) => getLocalDateKey(parseISO(booking.start_time)) === key)
      const revenue = dayBookings
        .filter(isActiveBooking)
        .reduce((sum, booking) => sum + Number(booking.total_price || 0), 0)

      return { date, key, bookings: dayBookings, revenue }
    })
  }, [bookings])

  return (
    <div className="grid gap-3">
      {days.map((day) => (
        <section key={day.key} className="rounded-3xl border border-white bg-white p-5 shadow-[0_12px_40px_rgba(44,44,44,0.05)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-brand-border pb-3">
            <div>
              <h2 className="text-lg font-semibold text-brand-text">{format(day.date, 'EEE d MMM')}</h2>
              <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-brand-muted">
                {day.bookings.length} {day.bookings.length === 1 ? 'booking' : 'bookings'}
              </p>
            </div>
            <p className="text-sm font-semibold text-brand-sage">{moneyFormatter.format(day.revenue)}</p>
          </div>

          {day.bookings.length === 0 ? (
            <p className="py-3 text-sm text-brand-muted">No bookings scheduled.</p>
          ) : (
            <div className="grid gap-2">
              {day.bookings.map((booking) => (
                <WeekBookingRow key={booking.id} booking={booking} />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}

function WeekBookingRow({ booking }: { booking: Booking }) {
  const start = parseISO(booking.start_time)
  const end = parseISO(booking.end_time)

  return (
    <div className="grid gap-3 rounded-2xl bg-brand-bg px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center">
      <p className="text-sm font-semibold text-brand-text">
        {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
      </p>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-brand-text">{getPrimaryService(booking)}</p>
        <p className="mt-1 truncate text-xs text-brand-muted">{booking.client_name}</p>
      </div>
      <div className="flex items-center gap-2 sm:justify-end">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusStyles[booking.status]}`}>
          {statusLabels[booking.status]}
        </span>
        <span className="text-sm font-semibold text-brand-sage">
          {moneyFormatter.format(Number(booking.total_price || 0))}
        </span>
      </div>
    </div>
  )
}

const monthWeekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function MonthView({ bookings }: { bookings: Booking[] }) {
  const todayKey = getLocalDateKey(new Date())
  const monthStart = startOfMonth(getLocalDayStart())
  const monthEnd = endOfMonth(monthStart)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const bookingsByDay = bookings.reduce<Record<string, Booking[]>>((groups, booking) => {
    const key = getLocalDateKey(parseISO(booking.start_time))
    groups[key] = [...(groups[key] || []), booking]
    return groups
  }, {})

  return (
    <section className="rounded-3xl border border-white bg-white p-5 shadow-[0_12px_40px_rgba(44,44,44,0.05)]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-brand-text">{format(monthStart, 'MMMM yyyy')}</h2>
          <p className="mt-1 text-sm text-brand-muted">Monthly booking count and active revenue.</p>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-brand-border pb-2">
        {monthWeekdays.map((day) => (
          <div key={day} className="text-center text-xs font-semibold uppercase tracking-[0.12em] text-brand-muted">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl bg-brand-border">
        {days.map((day) => {
          const key = getLocalDateKey(day)
          const dayBookings = bookingsByDay[key] || []
          const activeBookings = dayBookings.filter(isActiveBooking)
          const revenue = activeBookings.reduce((sum, booking) => sum + Number(booking.total_price || 0), 0)
          const inMonth = isSameMonth(day, monthStart)
          const isToday = key === todayKey

          return (
            <div
              key={key}
              className={`min-h-28 bg-white p-3 ${inMonth ? '' : 'opacity-45'} ${
                isToday ? 'ring-2 ring-inset ring-brand-sage' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                    isToday ? 'bg-brand-sage text-white' : 'text-brand-text'
                  }`}
                >
                  {format(day, 'd')}
                </span>
              </div>

              {dayBookings.length > 0 ? (
                <div className="mt-4 space-y-1">
                  <p className="text-xs font-semibold text-brand-text">
                    {dayBookings.length} {dayBookings.length === 1 ? 'booking' : 'bookings'}
                  </p>
                  <p className="text-xs font-semibold text-brand-sage">{moneyFormatter.format(revenue)}</p>
                </div>
              ) : (
                <p className="mt-4 text-xs text-brand-muted">No bookings</p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function ScheduleStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white bg-white px-4 py-3 shadow-[0_10px_30px_rgba(44,44,44,0.04)]">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-brand-text">{value}</p>
    </div>
  )
}

function TodaySchedule({
  bookings,
  updatingId,
  onUpdateStatus,
}: {
  bookings: Booking[]
  updatingId: string | null
  onUpdateStatus: (id: string, status: Booking['status']) => void
}) {
  return (
    <div className="grid gap-3">
      {bookings.map((booking, index) => {
        const previous = bookings[index - 1]
        const gap = previous ? differenceInMinutes(parseISO(booking.start_time), parseISO(previous.end_time)) : 0

        return (
          <div key={booking.id}>
            {gap > 0 && <GapIndicator minutes={gap} />}
            {gap < 0 && <GapIndicator minutes={Math.abs(gap)} overlap />}
            <div className="grid gap-3 lg:grid-cols-[5rem_minmax(0,1fr)] lg:items-start">
              <div className="hidden pt-5 text-right lg:block">
                <p className="text-lg font-semibold text-brand-text">{format(parseISO(booking.start_time), 'HH:mm')}</p>
                <p className="text-xs font-medium text-brand-muted">{format(parseISO(booking.end_time), 'HH:mm')}</p>
              </div>
              <BookingCard
                booking={booking}
                updating={updatingId === booking.id}
                onUpdateStatus={onUpdateStatus}
                minHeight={getScheduleBlockHeight(booking)}
                scheduleMode
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function GapIndicator({ minutes, overlap = false }: { minutes: number; overlap?: boolean }) {
  return (
    <div className="my-2 flex items-center gap-3 lg:ml-20">
      <div className="h-px flex-1 bg-brand-border" />
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold ${
          overlap ? 'bg-rose-50 text-rose-700' : 'bg-brand-sage-light text-brand-sage'
        }`}
      >
        {formatDuration(minutes)} {overlap ? 'overlap' : 'free'}
      </span>
      <div className="h-px flex-1 bg-brand-border" />
    </div>
  )
}

function StatCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-3xl border border-white bg-white p-5 shadow-[0_14px_40px_rgba(44,44,44,0.06)]">
      <p className="text-sm font-medium text-brand-muted">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-brand-text">{value}</p>
      <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-brand-sage">{detail}</p>
    </div>
  )
}

function BookingCard({
  booking,
  updating,
  onUpdateStatus,
  minHeight,
  scheduleMode = false,
}: {
  booking: Booking
  updating: boolean
  onUpdateStatus: (id: string, status: Booking['status']) => void
  minHeight?: number
  scheduleMode?: boolean
}) {
  const addons = getAddons(booking)
  const start = parseISO(booking.start_time)
  const end = parseISO(booking.end_time)
  const duration = getDurationMinutes(booking)
  const primaryService = booking.booking_services?.find((service) => service.is_primary)

  return (
    <article
      className="rounded-3xl border border-white bg-white p-5 shadow-[0_12px_40px_rgba(44,44,44,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_60px_rgba(44,44,44,0.08)]"
      style={minHeight ? { minHeight } : undefined}
    >
      <div className="grid h-full gap-5 lg:grid-cols-[1.1fr_1fr_auto] lg:items-center">
        {scheduleMode ? (
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold tracking-tight text-brand-text">
                {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
              </h2>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusStyles[booking.status]}`}>
                {statusLabels[booking.status]}
              </span>
            </div>
            <p className="mt-3 text-base font-semibold text-brand-text">{getPrimaryService(booking)}</p>
            {addons.length > 0 && (
              <div className="mt-1 grid gap-1">
                {addons.map((addon) => (
                  <p key={`${booking.id}-${addon.name_at_booking}-summary`} className="text-sm text-brand-muted">
                    + {addon.name_at_booking}
                  </p>
                ))}
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
              <p className="text-sm font-medium text-brand-text">{booking.client_name}</p>
              <a className="text-sm text-brand-muted hover:text-brand-text" href={`tel:${booking.client_phone}`}>
                {booking.client_phone}
              </a>
            </div>
            {booking.notes && <p className="mt-3 text-sm leading-6 text-brand-muted">{booking.notes}</p>}
          </div>
        ) : (
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="truncate text-lg font-semibold text-brand-text">{booking.client_name}</h2>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusStyles[booking.status]}`}>
                {statusLabels[booking.status]}
              </span>
            </div>
            <a className="mt-1 block text-sm text-brand-muted hover:text-brand-text" href={`tel:${booking.client_phone}`}>
              {booking.client_phone}
            </a>
            {booking.notes && <p className="mt-3 text-sm leading-6 text-brand-muted">{booking.notes}</p>}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <Detail label="Date" value={format(start, 'EEE, d MMM')} />
          <Detail label="Starts" value={format(start, 'HH:mm')} />
          <Detail label="Ends" value={format(end, 'HH:mm')} />
          <Detail label="Duration" value={formatDuration(duration)} />
          <Detail label="Total" value={moneyFormatter.format(Number(booking.total_price || 0))} />
        </div>

        <div className="lg:min-w-72">
          <div className="rounded-2xl bg-brand-bg p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                {!scheduleMode && (
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">Primary service</p>
                )}
                <p className="mt-1 text-sm font-semibold text-brand-text">{getPrimaryService(booking)}</p>
              </div>
              {primaryService && formatServicePrice(primaryService.price_at_booking) && (
                <span className="text-sm font-semibold text-brand-sage">
                  {formatServicePrice(primaryService.price_at_booking)}
                </span>
              )}
            </div>
            {addons.length > 0 ? (
              <div className="mt-3 border-t border-brand-border pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">Add-ons</p>
                <div className="grid gap-1.5">
                  {addons.map((addon) => (
                    <div key={`${booking.id}-${addon.name_at_booking}`} className="flex justify-between gap-3 text-xs">
                      <span className="leading-5 text-brand-text">{addon.name_at_booking}</span>
                      {formatServicePrice(addon.price_at_booking) && (
                        <span className="font-semibold text-brand-sage">{formatServicePrice(addon.price_at_booking)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-3 border-t border-brand-border pt-3 text-xs text-brand-muted">No add-ons selected</p>
            )}
          </div>

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <a
              href={`tel:${booking.client_phone}`}
              className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-brand-text ring-1 ring-brand-border transition hover:ring-brand-sage"
            >
              Call
            </a>
            {booking.status === 'pending' && (
              <ActionButton disabled={updating} onClick={() => onUpdateStatus(booking.id, 'confirmed')}>
                Confirm
              </ActionButton>
            )}
            {booking.status === 'confirmed' && (
              <ActionButton disabled={updating} onClick={() => onUpdateStatus(booking.id, 'completed')}>
                Complete
              </ActionButton>
            )}
            {booking.status === 'confirmed' && (
              <ActionButton
                disabled={updating}
                variant="neutral"
                onClick={() => onUpdateStatus(booking.id, 'no_show')}
              >
                No-show
              </ActionButton>
            )}
            {isActiveBooking(booking) && (
              <ActionButton disabled={updating} variant="danger" onClick={() => onUpdateStatus(booking.id, 'cancelled')}>
                Cancel
              </ActionButton>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-brand-text">{value}</p>
    </div>
  )
}

function ActionButton({
  children,
  disabled,
  onClick,
  variant = 'primary',
}: {
  children: string
  disabled: boolean
  onClick: () => void
  variant?: 'primary' | 'neutral' | 'danger'
}) {
  const styles = {
    primary: 'bg-brand-text text-white hover:bg-black',
    neutral: 'bg-stone-100 text-stone-700 hover:bg-stone-200',
    danger: 'bg-rose-100 text-rose-700 hover:bg-rose-200',
  }

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]}`}
    >
      {disabled ? 'Updating...' : children}
    </button>
  )
}
