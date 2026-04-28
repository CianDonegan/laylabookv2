# LaylaBook v2
LaylaBook is a React, TypeScript, and Supabase booking system for a salon workflow. It handles public appointment booking, dynamic availability, secure admin management, rescheduling, client profiles, schedule controls, and automated email notifications.

Built for a real salon use case with production-style scheduling logic and database-level validation.

**Live demo:** https://laylabookv2.vercel.app/

---

## Booking Flow

The booking flow is designed to reflect how real appointments work:

1. The client accepts the booking policy
2. The client selects a primary service
3. Optional add-ons can be added, changing the total duration
4. The client picks a date
5. Available time slots are fetched dynamically based on total duration
6. The client selects a time and enters their name, email address, and phone number
7. A booking is created via the Supabase RPC function `create_booking`
8. A confirmation email is sent to the client via Resend

When a booking is created, the database:

* Checks working hours, blocked dates, and booking conflicts
* Creates or updates a client profile by phone number using `upsert_client`
* Stores the `client_id` on the booking
* Stores a snapshot of selected services in `booking_services`
* Returns the booking ID to the frontend

After the booking is created, the frontend calls `save_booking_email` to store the email on the client profile, then invokes the `send-booking-confirmation` edge function to dispatch the confirmation email. Both calls are fire-and-forget and do not block the success screen.

A key detail is that changing add-ons automatically recalculates availability, since longer appointments reduce the number of valid time slots.

---

## Email Notifications

The system sends two types of automated emails via [Resend](https://resend.com), handled by Supabase edge functions.

### Booking confirmation

Triggered immediately after `create_booking` succeeds. The `send-booking-confirmation` edge function receives the booking details from the frontend and sends an HTML email containing the appointment date, time, service, total price, and a note to text on arrival.

### 24-hour reminders

A pg_cron job runs daily at 09:00 UTC and calls the `send-booking-reminder` edge function. The function queries `get_tomorrows_reminders()` using the service role key, which returns all confirmed bookings where the appointment date is tomorrow (evaluated in `Europe/Dublin` timezone) and the client has an email address on file. A reminder email is sent to each client with the same appointment details plus the salon address.

The cron job authenticates to the edge function using a shared `CRON_SECRET` embedded in the pg_cron command at setup time. Failed sends are logged individually and do not prevent other reminders from going out.

---

## Data Model

The system is driven by a small set of focused tables:

* **bookings** - stores appointment times, client details, status, total price, and optional `client_id`
* **booking_services** - stores a snapshot of service names, prices, and primary/add-on status at the time of booking
* **clients** - stores client profiles by unique phone number, with an optional email address and editable admin notes
* **services** - defines available services, durations, prices, categories, add-ons, and active state
* **working_hours** - defines the recurring weekly schedule
* **blocked_dates** - stores one-off closures, holidays, and days off
* **admin_users** - identifies which Supabase Auth users can access admin-only data and actions

Storing service details in `booking_services` preserves historical booking records even if service names or prices change later.

---

## Admin System

The admin dashboard is designed for day-to-day salon use and is protected by Supabase Auth.

Available admin views:

* **Today** - live daily operations with compact booking rows
* **Week** - planning view with compact empty days and highlighted booked days
* **Month** - overview calendar with booked-day indicators, revenue pills, closed-day styling, and today's highlight
* **List** - searchable, filterable compact booking list
* **Clients** - searchable client profiles with notes and full booking history
* **Settings** - working hours and blocked date management

Bookings can be:

* Confirmed
* Cancelled
* Completed
* Marked as no-show
* Rescheduled

The dashboard also includes:

* Supabase Auth email/password login
* Persistent admin sessions with `getSession` and `onAuthStateChange`
* Revenue tracking for today, week, and active booking value
* Status filtering and booking search
* Inline admin actions for fast workflow
* Pending booking indicators
* Muted styling for inactive bookings
* Editable client notes with save confirmation

---

## Rescheduling

Admins can reschedule pending and confirmed bookings from the dashboard.

The rescheduling flow:

1. The admin clicks **Reschedule**
2. A modal opens with a date picker and available time grid
3. Blocked dates and closed days are disabled
4. Available slots are calculated using `get_reschedule_available_slots`
5. The current booking is excluded from its own conflict checks
6. The admin reviews the old time and new time
7. The booking is updated via `reschedule_booking`

The booking status is preserved during rescheduling.

---

## Client Profiles

Client profiles are created automatically during booking.

The `clients` table uses phone number as the unique identifier. When a booking is created, `upsert_client` either creates a new client or updates the existing client's name. After booking, the client's email is stored via `save_booking_email`, which updates the clients row matched by phone number.

The admin Clients tab shows:

* Client name
* Phone number
* Email address (shown as a mailto link when present)
* Number of bookings
* Last booking date
* Editable private notes
* Full booking history with date, service, status, and price

Only admins can read or edit client profiles directly.

---

## Scheduling & Availability Control

The system separates scheduling into two concepts:

* **Working Hours** - recurring weekly schedule
* **Blocked Dates** - one-off exceptions such as holidays, days off, or closures

Both are configurable from the admin Settings view.

Availability logic always checks both, ensuring:

* Closed days cannot be booked
* Blocked dates override normal working hours
* Existing pending and confirmed bookings block overlapping slots
* Admin rescheduling uses the same conflict rules as booking creation

---

## Auth & Security

The admin dashboard uses Supabase Auth instead of a client-side password gate.

Security is enforced with:

* Supabase email/password authentication
* An `admin_users` table for admin authorization
* A `private.is_admin()` helper function
* Row Level Security on all main tables
* Admin-only policies for bookings, clients, working hours, and blocked dates
* Public read access only where needed for booking flow data
* Public booking actions handled through secure RPC functions

The frontend uses the Supabase anon client, but sensitive access is controlled by RLS and database functions.

---

## Supabase RPC Functions

The backend uses Supabase RPC functions as the source of truth for booking logic:

* **get_available_slots** - generates public booking availability
* **create_booking** - validates and creates new bookings
* **upsert_client** - creates or updates client profiles by phone number
* **save_booking_email** - stores a client's email address matched by phone number
* **get_reschedule_available_slots** - generates admin reschedule availability while excluding the current booking
* **reschedule_booking** - validates conflicts and updates booking times
* **get_tomorrows_reminders** - returns confirmed bookings for tomorrow (Dublin timezone) with client email, used by the reminder edge function

This keeps important business logic in the database rather than relying only on frontend checks.

---

## Edge Functions

Two Supabase edge functions handle outbound email via Resend:

* **send-booking-confirmation** - called by the frontend after a booking is created; sends an HTML confirmation email with appointment details
* **send-booking-reminder** - called daily by pg_cron; queries `get_tomorrows_reminders()` and sends a reminder email to each client with a confirmed appointment the following day

Both functions use the `RESEND_API_KEY` and `RESEND_FROM_EMAIL` secrets. The reminder function additionally uses `CRON_SECRET` for authentication and `SUPABASE_SERVICE_ROLE_KEY` (automatically injected) to query the database.

---

## How the System Works

This project is built around a simple idea:

> **Availability is not stored. It is generated dynamically.**

Instead of pre-creating time slots and trying to keep them in sync, the system calculates availability in real time based on rules and existing bookings.

At the core of this is a Supabase RPC function (`get_available_slots`) which:

* Reads the salon's working hours for the selected day
* Checks if the date is blocked for days off or holidays
* Generates possible time slots using SQL
* Filters out slots that overlap with active bookings

This means the system always returns current availability without needing to manage or update slot data manually.

---

## Key Design Decisions

Some of the main decisions behind this system:

* **Dynamic availability instead of stored slots**
  Avoids sync issues and keeps scheduling logic reliable.

* **Backend as the source of truth**
  Availability, conflicts, booking creation, client linking, and rescheduling are enforced in Supabase.

* **Snapshot booking data**
  Services and prices are stored at the time of booking to preserve history.

* **Supabase-native auth and RLS**
  Admin access is based on authenticated users and database policies, not hidden frontend state.

* **Phone-based client profiles**
  Simple and practical for a solo salon workflow.

* **Fire-and-forget email dispatch**
  Confirmation and reminder emails are non-blocking — a failed email send never affects the booking itself.

* **Database-driven reminders**
  The pg_cron job calls an edge function that queries the database directly, so reminder logic stays consistent with the same timezone and status rules used everywhere else.

* **Focused admin dashboard**
  The admin UI is optimized for scanning, quick actions, and repeated daily use.

---

## Tech Stack

* React
* TypeScript
* Vite
* Tailwind CSS
* Supabase Auth
* Supabase Postgres
* Supabase RPC functions
* Supabase Edge Functions (Deno)
* Row Level Security
* pg_cron + pg_net
* Resend
* date-fns
* Vitest + Testing Library

---

## Limitations / Future Improvements

Potential future improvements include:

* Multi-staff or stylist support
* Waitlist and cancellation handling
* Client self-service cancellation or rescheduling
* Deposits or online payments
* Admin audit history for booking changes

---

## What I Learned

Building this project helped me understand how to design real-world scheduling systems, handle availability and conflicts correctly, use Supabase RPC functions for backend logic, secure a frontend app with Supabase Auth and RLS, model bookings and client profiles, automate transactional email with edge functions and pg_cron, and balance polished admin UX with reliable database constraints.
