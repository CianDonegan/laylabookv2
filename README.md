# LaylaBook v2

A production-ready, full-stack booking system built for a real salon workflow.

**Live:** [laylabookv2.vercel.app](https://laylabookv2.vercel.app)

---

## Tech Stack

**React · TypeScript · Supabase (PostgreSQL, RPC, Edge Functions) · Vercel**

---

## Overview

End-to-end booking platform with a public booking flow, secure admin dashboard, and automated email notifications. Designed and deployed as a live application.

## Key Features

- **Dynamic availability engine** — generates real-time slots from SQL/RPC instead of pre-stored data, accounting for service durations, add-ons, working hours, blocked dates, and booking conflicts.
- **Backend-driven booking logic** — all critical operations (`create_booking`, `get_available_slots`, `reschedule_booking`) live in Supabase RPC functions, making the database the single source of truth.
- **Admin dashboard** — multi-view scheduling (day / week / month), booking management, client profiles, and revenue tracking.
- **Rescheduling system** — conflict-safe slot recalculation that excludes the booking being moved.
- **Automated emails** — booking confirmations (real-time) and 24-hour reminders via Supabase Edge Functions + `pg_cron`, with timezone-aware queries.
- **Secure by design** — Supabase Auth with Row Level Security (RLS) and role-based admin access.

## Engineering Highlights

- Relational schema (`bookings`, `clients`, `services`, `booking_services`) with data integrity and audit-safe history via service snapshotting.
- Backend-enforced validation rather than frontend trust.
- Fire-and-forget side effects so failed emails never block a booking.
- Dynamic computation over stored state to eliminate sync issues.

---

**GitHub:** [github.com/CianDonegan/laylabookv2](https://github.com/CianDonegan/laylabookv2)
