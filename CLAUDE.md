# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server with hot reload
npm run build     # Type-check (tsc -b) then build for production
npm run lint      # Run ESLint across all TS/TSX files
npm run preview   # Preview production build locally
```

No test suite exists in this project.

## Environment

Requires a `.env` file with:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Architecture

**LaylaBook v2** is a salon booking SPA with two routes:

- `/` — Public multi-step booking wizard (policy → service → add-ons → date → time → form → success)
- `/admin` — Protected admin dashboard (login via Supabase Auth + `admin_users` table check)

### Stack

- **React 19 + TypeScript + Vite** for the frontend
- **Supabase** for database (PostgreSQL), auth, and all business logic (RPC functions)
- **Tailwind CSS v4** with a custom sage/green design system defined in `src/index.css`
- **React Router v7** for routing
- **date-fns v4** for date utilities
- Deployed on **Vercel**

### Key Design Decisions

**All business logic lives in Supabase RPC functions**, not the frontend. The frontend calls these RPCs; it never writes directly to tables:

| RPC | Purpose |
|-----|---------|
| `get_available_slots(date, duration_minutes)` | Generates available times from working hours, excluding conflicts and blocked dates |
| `create_booking(client_name, phone, start_time, end_time, total_price, services)` | Creates booking + upserts client profile |
| `get_reschedule_available_slots(booking_id, date, duration_minutes)` | Like above but excludes the current booking |
| `reschedule_booking(booking_id, start_time, end_time)` | Validates and updates booking |
| `upsert_client(phone, name)` | Phone-based client dedup |

**Availability is computed dynamically** — there are no pre-created time slot records. The RPC derives slots from `working_hours`, `blocked_dates`, and existing `bookings` at query time.

**Service snapshots**: `booking_services` stores `price_at_booking` and `name_at_booking` so historical bookings stay accurate even if services are later edited.

**Clients are phone-keyed** — `clients.phone` is the unique identifier; booking the same number auto-links history.

### Code Layout

```
src/
  components/booking/   # All booking wizard step components (Hero, PolicyCard, ServicePicker, etc.)
  hooks/                # Data-fetching hooks (useServices, useAvailability, useBooking, etc.)
  pages/                # BookingPage.tsx and AdminPage.tsx (full route components)
  lib/                  # Supabase client init (supabase.ts)
  utils/                # Time/timezone helpers (getLocalToday, formatTime, etc.)
  types/                # Shared TypeScript interfaces (Service, Booking, WorkingHours, etc.)
```

`AdminPage.tsx` is a single large component managing all admin views (Today / Week / Month / List / Clients / Settings) with internal state switching. No global state manager — views are controlled by `useState`.

### Database Tables

- `services` — Service catalogue with pricing, duration, buffer minutes, categories, addon flags
- `bookings` — Appointments with status (`pending` / `confirmed` / `cancelled` / `completed` / `no_show`)
- `booking_services` — Service snapshots per booking
- `clients` — Phone-keyed client profiles with optional admin notes
- `working_hours` — Weekly recurring schedule (day_of_week, open, start/end times, slot interval)
- `blocked_dates` — One-off date closures
- `admin_users` — Supabase Auth UIDs authorized for admin access

### Design System

Custom Tailwind CSS v4 theme tokens (defined in `src/index.css`):

- `--color-brand-bg: #F0F1EC` — warm sage background
- `--color-brand-sage: #a8b89a` — main accent
- `--color-brand-text: #2c2c2c` — primary text
- `--color-brand-muted: #9a9a9a` — secondary text
- `--color-brand-border: #ebebeb` — subtle borders

Currency displays use `en-IE` locale (EUR). All date/time storage is UTC ISO 8601; `getLocalToday()` in utils handles timezone-correct "today" for the browser.
