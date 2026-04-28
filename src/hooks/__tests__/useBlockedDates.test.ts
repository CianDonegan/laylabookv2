import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useBlockedDates } from '../useBlockedDates'
import { makeQueryChain } from '../../test/supabaseMock'

vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

// Import after mock so we get the mocked version
const { supabase } = await import('../../lib/supabase')

describe('useBlockedDates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('starts with loading=true and empty dates', () => {
    // Never resolves — keeps loading state frozen
    ;(supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockReturnValue(new Promise(() => {})),
    })

    const { result } = renderHook(() => useBlockedDates())

    expect(result.current.loading).toBe(true)
    expect(result.current.dates).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('returns mapped date strings on success', async () => {
    ;(supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      makeQueryChain({ data: [{ date: '2026-05-01' }, { date: '2026-05-02' }], error: null })
    )

    const { result } = renderHook(() => useBlockedDates())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.dates).toEqual(['2026-05-01', '2026-05-02'])
    expect(result.current.error).toBeNull()
  })

  it('handles empty result without error', async () => {
    ;(supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      makeQueryChain({ data: [], error: null })
    )

    const { result } = renderHook(() => useBlockedDates())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.dates).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('sets error message and clears loading on Supabase error', async () => {
    ;(supabase.from as ReturnType<typeof vi.fn>).mockReturnValue(
      makeQueryChain({ data: null, error: { message: 'permission denied' } })
    )

    const { result } = renderHook(() => useBlockedDates())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.dates).toEqual([])
    expect(result.current.error).toBe('Could not load availability. Please refresh.')
  })

  it('sets error message on network exception', async () => {
    ;(supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: vi.fn().mockRejectedValue(new Error('Network failure')),
    })

    const { result } = renderHook(() => useBlockedDates())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('Could not load availability. Please refresh.')
  })
})
