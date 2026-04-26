import { useState, useMemo, useEffect, useCallback, useRef, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import {
  addDays,
  addMonths,
  differenceInMinutes,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import type { BlockedDate, Booking, WorkingHours } from '../types'

type AdminView = 'today' | 'week' | 'month' | 'list' | 'settings'
type StatusFilter = 'all' | Booking['status']

const viewTabs: { value: AdminView; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'list', label: 'List' },
  { value: 'settings', label: 'Settings' },
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

function isValueActiveBooking(booking: Booking) {
  return booking.status !== 'cancelled' && booking.status !== 'no_show'
}

function canUpdateStatus(booking: Booking) {
  return booking.status === 'pending' || booking.status === 'confirmed'
}

function getBookingValue(bookings: Booking[]) {
  return bookings
    .filter(isValueActiveBooking)
    .reduce((sum, booking) => sum + Number(booking.total_price || 0), 0)
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

function mergeBookings(existing: Booking[], incoming: Booking[]) {
  const byId = new Map(existing.map((booking) => [booking.id, booking]))

  incoming.forEach((booking) => byId.set(booking.id, booking))

  return [...byId.values()].sort(
    (first, second) => parseISO(first.start_time).getTime() - parseISO(second.start_time).getTime()
  )
}

const orderedWorkingDays = [1, 2, 3, 4, 5, 6, 0]
const shortDayNames: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
}

function normalizeTimeInput(value: string) {
  return value.slice(0, 5)
}

function sortWorkingHours(hours: WorkingHours[]) {
  return [...hours].sort(
    (first, second) =>
      orderedWorkingDays.indexOf(first.day_of_week) - orderedWorkingDays.indexOf(second.day_of_week)
  )
}

function sortBlockedDates(dates: BlockedDate[]) {
  return [...dates].sort((first, second) => first.date.localeCompare(second.date))
}

export default function AdminPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [loginLoading, setLoginLoading] = useState(false)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [knownBookings, setKnownBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<AdminView>('today')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const viewRef = useRef(view)

  useEffect(() => {
    viewRef.current = view
  }, [view])

  const fetchBookings = useCallback(async (nextView?: AdminView) => {
    const targetView = nextView ?? viewRef.current

    setLoading(true)
    setErrorMessage('')

    let query = supabase
      .from('bookings')
      .select('*, booking_services(name_at_booking, is_primary, price_at_booking)')
      .order('start_time', { ascending: true })

    if (targetView === 'today') {
      const start = getLocalDayStart()
      const end = addDays(start, 1)
      query = query.gte('start_time', start.toISOString()).lt('start_time', end.toISOString())
    } else if (targetView === 'week') {
      const start = getLocalDayStart()
      const end = addDays(start, 7)
      query = query.gte('start_time', start.toISOString()).lt('start_time', end.toISOString())
    } else if (targetView === 'month') {
      const start = startOfMonth(getLocalDayStart())
      const end = addMonths(start, 1)
      query = query.gte('start_time', start.toISOString()).lt('start_time', end.toISOString())
    }

    const { data, error } = await query

    if (error) {
      setErrorMessage('Could not load bookings. Please try again.')
      setBookings([])
    } else {
      const nextBookings = (data as Booking[]) || []
      setBookings(nextBookings)
      setKnownBookings((current) => mergeBookings(current, nextBookings))
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return

      const nextSession = data.session

      setSession(nextSession)
      setAuthLoading(false)

      if (nextSession) {
        void fetchBookings('today')
      } else {
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)

      if (!nextSession) {
        setBookings([])
        setKnownBookings([])
        setLoading(false)
      } else {
        void fetchBookings('today')
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [fetchBookings])

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoginLoading(true)
    setErrorMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setErrorMessage('Could not sign in. Check your email and password.')
    } else {
      setPassword('')
    }

    setLoginLoading(false)
  }

  const handleLogout = async () => {
    setErrorMessage('')

    const { error } = await supabase.auth.signOut()

    if (error) {
      setErrorMessage('Could not sign out. Please try again.')
    }
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
    const todayStart = getLocalDayStart()
    const tomorrowStart = addDays(todayStart, 1)
    const weekEnd = addDays(todayStart, 7)
    const statsSource = knownBookings.length > 0 ? knownBookings : bookings
    const todayBookings = statsSource.filter((booking) => {
      const startTime = parseISO(booking.start_time).getTime()
      return startTime >= todayStart.getTime() && startTime < tomorrowStart.getTime()
    })
    const weekBookings = statsSource.filter((booking) => {
      const startTime = parseISO(booking.start_time).getTime()
      return startTime >= todayStart.getTime() && startTime < weekEnd.getTime()
    })

    return {
      total: bookings.length,
      pending: bookings.filter((booking) => booking.status === 'pending').length,
      confirmed: bookings.filter((booking) => booking.status === 'confirmed').length,
      revenue: getBookingValue(bookings),
      todayRevenue: getBookingValue(todayBookings),
      weekRevenue: getBookingValue(weekBookings),
    }
  }, [bookings, knownBookings])

  const nextUpcomingBooking = useMemo(() => {
    const tomorrowStart = addDays(getLocalDayStart(), 1)

    return knownBookings.find(
      (booking) =>
        isValueActiveBooking(booking) &&
        parseISO(booking.start_time).getTime() >= tomorrowStart.getTime()
    )
  }, [knownBookings])

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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f7f8f4] px-4 py-8 text-brand-text">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
          <div className="w-full max-w-md rounded-[2rem] border border-white/80 bg-white p-8 shadow-[0_24px_80px_rgba(44,44,44,0.10)]">
            <p className="text-sm font-medium text-brand-muted">Checking admin session...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!session) {
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

            <form className="space-y-3" onSubmit={handleLogin}>
              <label className="block text-sm font-medium text-brand-text" htmlFor="admin-email">
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                required
                autoComplete="email"
                onChange={(event) => {
                  setEmail(event.target.value)
                  setErrorMessage('')
                }}
                className="w-full rounded-2xl border border-brand-border bg-brand-bg px-4 py-3 text-sm text-brand-text outline-none transition focus:border-brand-sage focus:ring-4 focus:ring-brand-sage-light"
              />
              <label className="block text-sm font-medium text-brand-text" htmlFor="admin-password">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                placeholder="Enter password"
                value={password}
                required
                autoComplete="current-password"
                onChange={(event) => {
                  setPassword(event.target.value)
                  setErrorMessage('')
                }}
                className="w-full rounded-2xl border border-brand-border bg-brand-bg px-4 py-3 text-sm text-brand-text outline-none transition focus:border-brand-sage focus:ring-4 focus:ring-brand-sage-light"
              />
              {errorMessage && <p className="text-sm text-rose-600">{errorMessage}</p>}
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full rounded-2xl bg-brand-text px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-black focus:outline-none focus:ring-4 focus:ring-brand-sage-light disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loginLoading ? 'Signing in...' : 'Enter Dashboard'}
              </button>
            </form>
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
            {view !== 'settings' && (
              <button
                onClick={() => void fetchBookings()}
                className="rounded-2xl border border-brand-border bg-white px-4 py-2.5 text-sm font-medium text-brand-text shadow-sm transition hover:border-brand-sage"
              >
                Refresh
              </button>
            )}
            <button
              onClick={() => void handleLogout()}
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

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard label="Bookings" value={stats.total} detail={`${visibleBookings.length} showing`} />
          <StatCard
            label="Pending"
            value={stats.pending}
            detail={stats.pending > 0 ? 'Needs action' : 'Awaiting confirmation'}
            highlighted={stats.pending > 0}
            badge={stats.pending > 0 ? 'Needs action' : undefined}
          />
          <StatCard label="Confirmed" value={stats.confirmed} detail="Ready to go" />
          <StatCard
            label="Today Revenue"
            value={moneyFormatter.format(stats.todayRevenue)}
            detail="Excludes inactive"
          />
          <StatCard
            label="Week Revenue"
            value={moneyFormatter.format(stats.weekRevenue)}
            detail="Next 7 days"
          />
          <StatCard
            label="Active Value"
            value={moneyFormatter.format(stats.revenue)}
            detail="Excludes cancelled/no-show"
          />
        </section>

        <section className="mt-6 rounded-3xl border border-white bg-white p-4 shadow-[0_18px_50px_rgba(44,44,44,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap rounded-2xl bg-brand-bg p-1">
              {viewTabs.map((item) => (
                <button
                  key={item.value}
                  onClick={() => {
                    setView(item.value)
                    if (item.value !== 'settings') {
                      void fetchBookings(item.value)
                    }
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

            {view !== 'settings' && (
              <div className="rounded-3xl border border-brand-border/80 bg-brand-bg/70 p-3 lg:min-w-[36rem]">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-sage">
                  Find bookings
                </p>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
                  <label className="block">
                    <span className="sr-only">Search bookings</span>
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search by name, phone, or service"
                      className="w-full rounded-2xl border border-brand-border bg-white px-4 py-3 text-sm outline-none transition focus:border-brand-sage focus:ring-4 focus:ring-brand-sage-light"
                    />
                  </label>
                  <label className="block">
                    <span className="sr-only">Filter by status</span>
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                      className="w-full rounded-2xl border border-brand-border bg-white px-4 py-3 text-sm outline-none transition focus:border-brand-sage focus:ring-4 focus:ring-brand-sage-light"
                    >
                      {statusFilters.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="mt-5">
          {view === 'settings' ? (
            <SettingsView />
          ) : loading ? (
            <div className="grid gap-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-36 animate-pulse rounded-3xl border border-white bg-white shadow-[0_12px_40px_rgba(44,44,44,0.05)]"
                />
              ))}
            </div>
          ) : view === 'week' ? (
            <WeekView
              bookings={visibleBookings}
              updatingId={updatingId}
              onUpdateStatus={updateStatus}
            />
          ) : view === 'month' ? (
            <MonthView bookings={visibleBookings} />
          ) : view === 'today' && bookings.length === 0 ? (
            <TodayEmptyState nextBooking={nextUpcomingBooking} />
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
                <ListView
                  bookings={visibleBookings}
                  updatingId={updatingId}
                  onUpdateStatus={updateStatus}
                />
              )}
            </>
          )}
        </section>
      </main>
    </div>
  )
}

function SettingsView() {
  const [workingHours, setWorkingHours] = useState<WorkingHours[]>([])
  const [loadingHours, setLoadingHours] = useState(true)
  const [savingHours, setSavingHours] = useState(false)
  const [workingHoursMessage, setWorkingHoursMessage] = useState<{
    tone: 'success' | 'error'
    text: string
  } | null>(null)
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([])
  const [loadingBlockedDates, setLoadingBlockedDates] = useState(true)
  const [savingBlockedDate, setSavingBlockedDate] = useState(false)
  const [removingBlockedDate, setRemovingBlockedDate] = useState<string | null>(null)
  const [newBlockedDate, setNewBlockedDate] = useState('')
  const [newBlockedReason, setNewBlockedReason] = useState('')
  const [blockedDatesMessage, setBlockedDatesMessage] = useState<{
    tone: 'success' | 'error'
    text: string
  } | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchWorkingHours() {
      setLoadingHours(true)
      setWorkingHoursMessage(null)

      const { data, error } = await supabase
        .from('working_hours')
        .select('*')
        .order('day_of_week')

      if (cancelled) return

      if (error) {
        setWorkingHours([])
        setWorkingHoursMessage({
          tone: 'error',
          text: 'Could not load working hours. Please refresh and try again.',
        })
      } else {
        setWorkingHours(
          sortWorkingHours(
            ((data as WorkingHours[]) || []).map((row) => ({
              ...row,
              start_time: normalizeTimeInput(row.start_time),
              end_time: normalizeTimeInput(row.end_time),
            }))
          )
        )
      }

      setLoadingHours(false)
    }

    void fetchWorkingHours()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function fetchBlockedDates() {
      setLoadingBlockedDates(true)
      setBlockedDatesMessage(null)

      const { data, error } = await supabase
        .from('blocked_dates')
        .select('date,reason')
        .gte('date', getLocalDateKey(new Date()))
        .order('date')

      if (cancelled) return

      if (error) {
        setBlockedDates([])
        setBlockedDatesMessage({
          tone: 'error',
          text: 'Could not load days off. Please refresh and try again.',
        })
      } else {
        setBlockedDates(sortBlockedDates((data as BlockedDate[]) || []))
      }

      setLoadingBlockedDates(false)
    }

    void fetchBlockedDates()

    return () => {
      cancelled = true
    }
  }, [])

  const updateWorkingHour = (dayOfWeek: number, updates: Partial<WorkingHours>) => {
    setWorkingHours((current) =>
      current.map((row) => (row.day_of_week === dayOfWeek ? { ...row, ...updates } : row))
    )
    setWorkingHoursMessage(null)
  }

  const saveWorkingHours = async () => {
    const invalidDay = workingHours.find(
      (row) => row.is_open && normalizeTimeInput(row.start_time) >= normalizeTimeInput(row.end_time)
    )

    if (invalidDay) {
      setWorkingHoursMessage({
        tone: 'error',
        text: `${invalidDay.day_name} needs an end time later than the start time.`,
      })
      return
    }

    setSavingHours(true)
    setWorkingHoursMessage(null)

    const results = await Promise.all(
      workingHours.map((row) =>
        supabase
          .from('working_hours')
          .update({
            is_open: row.is_open,
            start_time: normalizeTimeInput(row.start_time),
            end_time: normalizeTimeInput(row.end_time),
            slot_interval_minutes: row.slot_interval_minutes,
          })
          .eq('day_of_week', row.day_of_week)
          .select('day_of_week')
      )
    )

    const failedResult = results.find((result) => result.error)
    const missingRow = results.some((result) => !result.data || result.data.length === 0)

    if (failedResult?.error || missingRow) {
      setWorkingHoursMessage({
        tone: 'error',
        text: 'Could not save working hours. Please try again.',
      })
    } else {
      setWorkingHours((current) => sortWorkingHours(current))
      setWorkingHoursMessage({
        tone: 'success',
        text: 'Working hours saved.',
      })
    }

    setSavingHours(false)
  }

  const addBlockedDate = async () => {
    if (!newBlockedDate) {
      setBlockedDatesMessage({
        tone: 'error',
        text: 'Choose a date to block.',
      })
      return
    }

    if (blockedDates.some((blockedDate) => blockedDate.date === newBlockedDate)) {
      setBlockedDatesMessage({
        tone: 'error',
        text: 'That date is already blocked.',
      })
      return
    }

    setSavingBlockedDate(true)
    setBlockedDatesMessage(null)

    const nextBlockedDate = {
      date: newBlockedDate,
      reason: newBlockedReason.trim() || null,
    }
    const { data, error } = await supabase
      .from('blocked_dates')
      .insert(nextBlockedDate)
      .select('date,reason')
      .single()

    if (error || !data) {
      setBlockedDatesMessage({
        tone: 'error',
        text: 'Could not add this day off. Please try again.',
      })
    } else {
      setBlockedDates((current) => sortBlockedDates([...current, data as BlockedDate]))
      setNewBlockedDate('')
      setNewBlockedReason('')
      setBlockedDatesMessage({
        tone: 'success',
        text: 'Day off added.',
      })
    }

    setSavingBlockedDate(false)
  }

  const removeBlockedDate = async (date: string) => {
    setRemovingBlockedDate(date)
    setBlockedDatesMessage(null)

    const { error } = await supabase.from('blocked_dates').delete().eq('date', date)

    if (error) {
      setBlockedDatesMessage({
        tone: 'error',
        text: 'Could not remove this day off. Please try again.',
      })
    } else {
      setBlockedDates((current) => current.filter((blockedDate) => blockedDate.date !== date))
      setBlockedDatesMessage({
        tone: 'success',
        text: 'Day off removed.',
      })
    }

    setRemovingBlockedDate(null)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-3xl border border-white bg-white p-6 shadow-[0_12px_40px_rgba(44,44,44,0.05)]">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-sage">
          Settings
        </p>
        <h2 className="text-xl font-semibold text-brand-text">Working hours</h2>
        <p className="mt-2 text-sm leading-6 text-brand-muted">
          Set the weekly days and times clients can book.
        </p>

        <div className="mt-5 grid gap-2.5">
          {loadingHours ? (
            <div className="grid gap-2.5">
              {[1, 2, 3, 4, 5, 6, 7].map((item) => (
                <div key={item} className="h-16 animate-pulse rounded-2xl bg-brand-bg" />
              ))}
            </div>
          ) : workingHours.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-brand-border bg-brand-bg px-4 py-5 text-sm text-brand-muted">
              No working hours are available yet.
            </div>
          ) : (
            workingHours.map((row) => (
              <div
                key={row.day_of_week}
                className={`grid gap-3 rounded-2xl border px-4 py-3 transition sm:grid-cols-[5.5rem_auto_minmax(0,1fr)] sm:items-center ${
                  row.is_open
                    ? 'border-brand-border bg-brand-bg'
                    : 'border-stone-200 bg-stone-50 text-stone-400'
                }`}
              >
                <div>
                  <p className="text-sm font-semibold text-brand-text">
                    {shortDayNames[row.day_of_week] || row.day_name.slice(0, 3)}
                  </p>
                  <p className="mt-0.5 text-xs text-brand-muted">{row.day_name}</p>
                </div>

                <button
                  type="button"
                  onClick={() => updateWorkingHour(row.day_of_week, { is_open: !row.is_open })}
                  className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                    row.is_open
                      ? 'bg-brand-sage-light text-brand-sage ring-brand-border'
                      : 'bg-white text-stone-500 ring-stone-200'
                  }`}
                >
                  {row.is_open ? 'Open' : 'Closed'}
                </button>

                {row.is_open ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-brand-muted">Start</span>
                      <input
                        type="time"
                        value={normalizeTimeInput(row.start_time)}
                        onChange={(event) =>
                          updateWorkingHour(row.day_of_week, { start_time: event.target.value })
                        }
                        className="w-full rounded-2xl border border-brand-border bg-white px-3 py-2 text-sm font-medium text-brand-text outline-none transition focus:border-brand-sage focus:ring-4 focus:ring-brand-sage-light"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-brand-muted">End</span>
                      <input
                        type="time"
                        value={normalizeTimeInput(row.end_time)}
                        onChange={(event) =>
                          updateWorkingHour(row.day_of_week, { end_time: event.target.value })
                        }
                        className="w-full rounded-2xl border border-brand-border bg-white px-3 py-2 text-sm font-medium text-brand-text outline-none transition focus:border-brand-sage focus:ring-4 focus:ring-brand-sage-light"
                      />
                    </label>
                  </div>
                ) : (
                  <p className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-500">
                    Closed for bookings
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        {workingHoursMessage && (
          <p
            className={`mt-4 rounded-2xl px-4 py-3 text-sm font-medium ${
              workingHoursMessage.tone === 'success'
                ? 'bg-brand-sage-light text-brand-sage'
                : 'bg-rose-50 text-rose-700'
            }`}
          >
            {workingHoursMessage.text}
          </p>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => void saveWorkingHours()}
            disabled={loadingHours || savingHours || workingHours.length === 0}
            className="rounded-2xl bg-brand-text px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500"
          >
            {savingHours ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-white bg-white p-6 shadow-[0_12px_40px_rgba(44,44,44,0.05)]">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-sage">
          Settings
        </p>
        <h2 className="text-xl font-semibold text-brand-text">Days off</h2>
        <p className="mt-2 text-sm leading-6 text-brand-muted">
          Block holidays, days off, or one-off unavailable dates.
        </p>

        <div className="mt-5 rounded-2xl border border-brand-border bg-brand-bg p-4">
          <div className="grid gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-brand-text">Date</span>
              <input
                type="date"
                value={newBlockedDate}
                min={getLocalDateKey(new Date())}
                onChange={(event) => {
                  setNewBlockedDate(event.target.value)
                  setBlockedDatesMessage(null)
                }}
                className="w-full rounded-2xl border border-brand-border bg-white px-3 py-2.5 text-sm font-medium text-brand-text outline-none transition focus:border-brand-sage focus:ring-4 focus:ring-brand-sage-light"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-brand-text">
                Reason <span className="font-medium text-brand-muted">(optional)</span>
              </span>
              <input
                type="text"
                value={newBlockedReason}
                onChange={(event) => {
                  setNewBlockedReason(event.target.value)
                  setBlockedDatesMessage(null)
                }}
                placeholder="Holiday, appointment, closed..."
                className="w-full rounded-2xl border border-brand-border bg-white px-3 py-2.5 text-sm font-medium text-brand-text outline-none transition placeholder:text-brand-muted/70 focus:border-brand-sage focus:ring-4 focus:ring-brand-sage-light"
              />
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => void addBlockedDate()}
              disabled={savingBlockedDate}
              className="rounded-2xl bg-brand-text px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500"
            >
              {savingBlockedDate ? 'Adding...' : 'Add day off'}
            </button>
          </div>
        </div>

        {blockedDatesMessage && (
          <p
            className={`mt-4 rounded-2xl px-4 py-3 text-sm font-medium ${
              blockedDatesMessage.tone === 'success'
                ? 'bg-brand-sage-light text-brand-sage'
                : 'bg-rose-50 text-rose-700'
            }`}
          >
            {blockedDatesMessage.text}
          </p>
        )}

        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-brand-text">Upcoming blocked dates</p>
            <span className="rounded-full bg-brand-bg px-2.5 py-1 text-xs font-semibold text-brand-muted">
              {blockedDates.length}
            </span>
          </div>

          {loadingBlockedDates ? (
            <div className="grid gap-2.5">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-16 animate-pulse rounded-2xl bg-brand-bg" />
              ))}
            </div>
          ) : blockedDates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-brand-border bg-brand-bg px-4 py-5 text-sm text-brand-muted">
              No upcoming days off.
            </div>
          ) : (
            <div className="grid gap-2.5">
              {blockedDates.map((blockedDate) => (
                <div
                  key={blockedDate.date}
                  className="grid gap-3 rounded-2xl border border-brand-border bg-brand-bg px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-brand-text">
                      {format(parseISO(blockedDate.date), 'EEE, d MMM yyyy')}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-brand-muted">
                      {blockedDate.reason || 'No reason added'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void removeBlockedDate(blockedDate.date)}
                    disabled={removingBlockedDate === blockedDate.date}
                    className="w-fit rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {removingBlockedDate === blockedDate.date ? 'Removing...' : 'Remove'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
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

function TodayEmptyState({ nextBooking }: { nextBooking?: Booking }) {
  const nextStart = nextBooking ? parseISO(nextBooking.start_time) : null
  const tomorrow = addDays(getLocalDayStart(), 1)
  const nextLabel = nextStart
    ? isSameDay(nextStart, tomorrow)
      ? `Next booking is tomorrow at ${format(nextStart, 'HH:mm')}.`
      : `Next booking is ${format(nextStart, 'EEE, d MMM')} at ${format(nextStart, 'HH:mm')}.`
    : 'No bookings today. Upcoming bookings will appear here once loaded.'

  return (
    <div className="rounded-3xl border border-dashed border-brand-border bg-white px-6 py-14 text-center">
      <h2 className="text-xl font-semibold text-brand-text">No bookings today</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-brand-muted">{nextLabel}</p>
    </div>
  )
}

function ListView({
  bookings,
  updatingId,
  onUpdateStatus,
}: {
  bookings: Booking[]
  updatingId: string | null
  onUpdateStatus: (id: string, status: Booking['status']) => void
}) {
  const groups = useMemo(() => {
    const todayStart = getLocalDayStart()
    const tomorrowStart = addDays(todayStart, 1)
    const weekEnd = addDays(todayStart, 7)
    const grouped = {
      today: [] as Booking[],
      week: [] as Booking[],
      later: [] as Booking[],
    }

    bookings.forEach((booking) => {
      const startTime = parseISO(booking.start_time).getTime()

      if (startTime >= todayStart.getTime() && startTime < tomorrowStart.getTime()) {
        grouped.today.push(booking)
      } else if (startTime >= tomorrowStart.getTime() && startTime < weekEnd.getTime()) {
        grouped.week.push(booking)
      } else {
        grouped.later.push(booking)
      }
    })

    return [
      { key: 'today', label: 'Today', bookings: grouped.today },
      { key: 'week', label: 'This Week', bookings: grouped.week },
      { key: 'later', label: 'Later', bookings: grouped.later },
    ]
  }, [bookings])

  return (
    <div className="grid gap-5">
      {groups.map((group) => (
        <section key={group.key} className={group.bookings.length === 0 ? 'hidden' : ''}>
          <div className="mb-2 flex items-center gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-sage">
              {group.label}
            </h2>
            <span className="h-px flex-1 bg-brand-border" />
            <span className="text-xs font-medium text-brand-muted">
              {group.bookings.length} {group.bookings.length === 1 ? 'booking' : 'bookings'}
            </span>
          </div>
          <div className="grid gap-3">
            {group.bookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                updating={updatingId === booking.id}
                onUpdateStatus={onUpdateStatus}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function WeekView({
  bookings,
  updatingId,
  onUpdateStatus,
}: {
  bookings: Booking[]
  updatingId: string | null
  onUpdateStatus: (id: string, status: Booking['status']) => void
}) {
  const days = useMemo(() => {
    const start = getLocalDayStart()
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(start, index)
      const key = getLocalDateKey(date)
      const dayBookings = bookings.filter((booking) => getLocalDateKey(parseISO(booking.start_time)) === key)
      const revenue = dayBookings
        .filter(isValueActiveBooking)
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
                <WeekBookingRow
                  key={booking.id}
                  booking={booking}
                  updating={updatingId === booking.id}
                  onUpdateStatus={onUpdateStatus}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}

function WeekBookingRow({
  booking,
  updating,
  onUpdateStatus,
}: {
  booking: Booking
  updating: boolean
  onUpdateStatus: (id: string, status: Booking['status']) => void
}) {
  const start = parseISO(booking.start_time)
  const end = parseISO(booking.end_time)
  const needsAction = booking.status === 'pending'
  const showStatusActions = canUpdateStatus(booking)

  return (
    <div
      className={`grid gap-3 rounded-2xl px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center ${
        needsAction ? 'bg-amber-50/70 ring-1 ring-amber-100' : 'bg-brand-bg'
      }`}
    >
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
        {showStatusActions && (
          <div className="flex gap-1.5">
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
            <ActionButton
              disabled={updating}
              variant="neutral"
              onClick={() => onUpdateStatus(booking.id, 'no_show')}
            >
              No-show
            </ActionButton>
            <ActionButton
              disabled={updating}
              variant="danger"
              onClick={() => onUpdateStatus(booking.id, 'cancelled')}
            >
              Cancel
            </ActionButton>
          </div>
        )}
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
          const activeBookings = dayBookings.filter(isValueActiveBooking)
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

function StatCard({
  label,
  value,
  detail,
  highlighted = false,
  badge,
}: {
  label: string
  value: string | number
  detail: string
  highlighted?: boolean
  badge?: string
}) {
  return (
    <div
      className={`rounded-3xl border p-5 shadow-[0_14px_40px_rgba(44,44,44,0.06)] ${
        highlighted ? 'border-amber-200 bg-amber-50/70' : 'border-white bg-white'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-brand-muted">{label}</p>
        {badge && (
          <span className="rounded-full bg-white px-2.5 py-1 text-[0.68rem] font-semibold text-amber-700 ring-1 ring-amber-200">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-brand-text">{value}</p>
      <p
        className={`mt-2 text-xs font-medium uppercase tracking-[0.16em] ${
          highlighted ? 'text-amber-700' : 'text-brand-sage'
        }`}
      >
        {detail}
      </p>
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
  const needsAction = booking.status === 'pending'
  const showStatusActions = canUpdateStatus(booking)

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
              {needsAction && (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                  Needs action
                </span>
              )}
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
              {needsAction && (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                  Needs action
                </span>
              )}
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

          {showStatusActions && (
            <div className="mt-3 flex flex-wrap justify-end gap-2">
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
              <ActionButton
                disabled={updating}
                variant="neutral"
                onClick={() => onUpdateStatus(booking.id, 'no_show')}
              >
                No-show
              </ActionButton>
              <ActionButton disabled={updating} variant="danger" onClick={() => onUpdateStatus(booking.id, 'cancelled')}>
                Cancel
              </ActionButton>
            </div>
          )}
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
