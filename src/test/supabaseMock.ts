import { vi } from 'vitest'

// Builds a chainable Supabase query mock whose terminal call resolves to `result`.
// Every chained method (select, order, eq, gte, lt, …) returns the same chain
// so any call sequence works; only maybeSingle / single / the awaited chain itself
// actually resolve.
export function makeQueryChain(result: { data: unknown; error: unknown }) {
  const resolved = Promise.resolve(result)
  const chain: Record<string, unknown> = {
    select: vi.fn(),
    order: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lt: vi.fn(),
    update: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
    // Make the chain itself awaitable (covers bare `await supabase.from(...).select(...)`)
    then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      resolved.then(res, rej),
  }
  ;(chain.select as ReturnType<typeof vi.fn>).mockReturnValue(chain)
  ;(chain.order as ReturnType<typeof vi.fn>).mockReturnValue(chain)
  ;(chain.eq as ReturnType<typeof vi.fn>).mockReturnValue(chain)
  ;(chain.gte as ReturnType<typeof vi.fn>).mockReturnValue(chain)
  ;(chain.lt as ReturnType<typeof vi.fn>).mockReturnValue(chain)
  ;(chain.update as ReturnType<typeof vi.fn>).mockReturnValue(chain)
  return chain
}

// Builds the full supabase mock object. Pass per-table results; anything not
// listed defaults to { data: [], error: null }.
export function makeSupabaseMock(tableResults: Record<string, { data: unknown; error: unknown }> = {}) {
  const defaultResult = { data: [], error: null }

  return {
    from: vi.fn((table: string) =>
      makeQueryChain(tableResults[table] ?? defaultResult)
    ),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  }
}
