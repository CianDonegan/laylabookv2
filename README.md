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

## Waitlist & Auto-Fill

Cancellations don't waste slots: clients can join a waitlist for a busy day, and when a booking is cancelled the freed slot is offered automatically to the next eligible person in FIFO order.

- **Customer flow** — `WaitlistJoinForm` collects name, phone, email, and a time window when no slot fits; the offered claimant gets an email with a one-time link to `ClaimPage`, which shows a live 15-minute countdown and a single "Claim this slot" action — expiry cascades to the next FIFO match.
- **Database** — `waitlist` table, `waitlist_with_position` FIFO view, `on_booking_cancelled` trigger, and a `process_waitlist_expirations` job run every minute by `pg_cron` to expire stale offers and cascade.
- **Hold enforcement** — `get_available_slots`, `get_reschedule_available_slots`, `create_booking`, and `reschedule_booking` all check active waitlist holds at the database level, so direct bookings can't land on a slot during the 15-minute claim window.
- **Email dispatch** — `send-waitlist-notification` edge function, invoked from `pg_net` with the offered slot details and a one-time `claim_token` link.
- **Admin surface** — Waitlist tab in the dashboard lists current entries grouped by date, shows a live "Notified · Xm left" pill, and removes entries via `admin_remove_waitlist_entry`.
- **Setup** — requires a `CRON_SECRET` shared between the edge function and `pg_cron`; full rotation procedure is documented in the header of `supabase/migrations/20260429000002_waitlist_cron.sql`.
- **Known limitations** — email-only (no SMS), slots starting within 60 minutes are skipped to leave headroom for the claim window and delivery, held slots are soft-reserved and hidden from direct booking during the 15-minute claim window, and the admin `Refresh` button doesn't yet refetch the waitlist tab.

---

**GitHub:** [github.com/CianDonegan/laylabookv2](https://github.com/CianDonegan/laylabookv2)
