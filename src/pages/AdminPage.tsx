import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format, parseISO } from 'date-fns'
import type { Booking } from '../types'

const ADMIN_PASSWORD = 'layla2026'

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'today' | 'upcoming' | 'all'>('today')

  useEffect(() => {
    if (!authenticated) return
    fetchBookings()
  }, [filter, authenticated])

  async function fetchBookings() {
    setLoading(true)
    let query = supabase
      .from('bookings')
      .select('*, booking_services(name_at_booking, is_primary)')
      .order('start_time', { ascending: true })

    if (filter === 'today') {
      const today = new Date().toISOString().split('T')[0]
      query = query.gte('start_time', `${today}T00:00:00`).lt('start_time', `${today}T23:59:59`)
    } else if (filter === 'upcoming') {
      query = query.gte('start_time', new Date().toISOString())
    }

    const { data } = await query
    setBookings((data as Booking[]) || [])
    setLoading(false)
  }

  const updateStatus = async (id: string, status: Booking['status']) => {
    await supabase.from('bookings').update({ status }).eq('id', id)
    fetchBookings()
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-sm">
          <h2 className="text-lg font-medium mb-4 text-brand-text">Admin Access</h2>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && password === ADMIN_PASSWORD && setAuthenticated(true)}
            className="w-full rounded-2xl px-4 py-3 text-sm border border-brand-border bg-brand-bg mb-3"
          />
          <button
            onClick={() => password === ADMIN_PASSWORD && setAuthenticated(true)}
            className="w-full py-3 rounded-2xl text-sm font-medium bg-brand-sage text-white"
          >
            Enter
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-6 text-brand-text">Layla's Dashboard</h1>

        <div className="flex gap-2 mb-6">
          {(['today', 'upcoming', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm capitalize ${
                filter === f ? 'bg-brand-sage text-white' : 'bg-white text-brand-text'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-brand-muted">Loading...</p>
        ) : bookings.length === 0 ? (
          <p className="text-brand-muted">No bookings found.</p>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => (
              <div key={b.id} className="bg-white rounded-2xl p-5 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium text-brand-text">{b.client_name}</p>
                    <p className="text-sm text-brand-muted">{b.client_phone}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      b.status === 'confirmed'
                        ? 'bg-green-100 text-green-700'
                        : b.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {b.status}
                  </span>
                </div>
                <p className="text-sm text-brand-text mb-1">
                  {format(parseISO(b.start_time), 'EEEE, d MMMM · HH:mm')}
                </p>
                <div className="text-xs text-brand-muted mb-3">
                  {b.booking_services
                    ?.filter((s) => s.is_primary)
                    .map((s) => s.name_at_booking)
                    .join(', ')}
                  {b.booking_services && b.booking_services.filter((s) => !s.is_primary).length > 0 && (
                    <span>
                      {' '}
                      +{' '}
                      {b.booking_services
                        .filter((s) => !s.is_primary)
                        .map((s) => s.name_at_booking)
                        .join(', ')}
                    </span>
                  )}
                </div>
                <p className="text-sm text-brand-sage font-medium mb-3">€{b.total_price}</p>

                <div className="flex gap-2">
                  {b.status === 'pending' && (
                    <button
                      onClick={() => updateStatus(b.id, 'confirmed')}
                      className="px-3 py-1.5 rounded-xl text-xs bg-brand-sage text-white"
                    >
                      Confirm
                    </button>
                  )}
                  {(b.status === 'pending' || b.status === 'confirmed') && (
                    <button
                      onClick={() => updateStatus(b.id, 'cancelled')}
                      className="px-3 py-1.5 rounded-xl text-xs bg-red-100 text-red-600"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}