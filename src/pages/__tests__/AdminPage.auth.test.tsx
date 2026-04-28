import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import AdminPage from '../AdminPage'
import { makeSupabaseMock, makeQueryChain } from '../../test/supabaseMock'

// We need a mutable reference so individual tests can reconfigure the mock.
let mockSupabase = makeSupabaseMock()

vi.mock('../../lib/supabase', () => ({
  get supabase() {
    return mockSupabase
  },
}))

// useWorkingHours and useBlockedDates are called at AdminPage level — they need
// supabase.from to exist. makeSupabaseMock provides sensible empty defaults so
// those hooks resolve without error during auth-focused tests.

function fakeSession(userId = 'user-123') {
  return {
    user: { id: userId },
    access_token: 'tok',
    refresh_token: 'rtok',
    expires_at: Date.now() / 1000 + 3600,
  }
}

describe('AdminPage — authentication', () => {
  beforeEach(() => {
    mockSupabase = makeSupabaseMock()
    vi.clearAllMocks()
  })

  it('shows the login form when there is no active session', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } })

    render(<AdminPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /enter dashboard/i })).toBeInTheDocument()
    })
  })

  it('shows a loading state before the session resolves', () => {
    // Never resolves so we catch the intermediate state
    mockSupabase.auth.getSession.mockReturnValue(new Promise(() => {}))

    render(<AdminPage />)

    expect(screen.getByText(/checking admin session/i)).toBeInTheDocument()
  })

  it('shows an access-denied error and the login form when user is not in admin_users', async () => {
    const session = fakeSession()
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session } })

    // admin_users check returns no row → unauthorized
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'admin_users') {
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
        chain.select.mockReturnValue(chain)
        chain.eq.mockReturnValue(chain)
        return chain
      }
      return makeQueryChain({ data: [], error: null })
    })

    render(<AdminPage />)

    await waitFor(() => {
      expect(screen.getByText(/doesn't have admin access/i)).toBeInTheDocument()
    })

    // Login form should still be visible (user is signed out)
    expect(screen.getByRole('button', { name: /enter dashboard/i })).toBeInTheDocument()
  })

  it('renders the dashboard when user is present in admin_users', async () => {
    const session = fakeSession()
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session } })

    // admin_users check returns a matching row → authorized
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'admin_users') {
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { user_id: 'user-123' }, error: null }),
        }
        chain.select.mockReturnValue(chain)
        chain.eq.mockReturnValue(chain)
        return chain
      }
      return makeQueryChain({ data: [], error: null })
    })

    render(<AdminPage />)

    await waitFor(() => {
      expect(screen.getByText(/bookings dashboard/i)).toBeInTheDocument()
    })

    // Login form should NOT be visible
    expect(screen.queryByRole('button', { name: /enter dashboard/i })).not.toBeInTheDocument()
  })

  it('calls admin_users with the session user id', async () => {
    const session = fakeSession('specific-user-id')
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session } })

    const eqMock = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock })
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'admin_users') return { select: selectMock }
      const { makeQueryChain } = require('../../test/supabaseMock')
      return makeQueryChain({ data: [], error: null })
    })

    render(<AdminPage />)

    await waitFor(() => {
      expect(eqMock).toHaveBeenCalledWith('user_id', 'specific-user-id')
    })
  })
})
