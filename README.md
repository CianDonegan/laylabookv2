# LaylaBook v2
LaylaBook is a React, TypeScript, and Supabase booking system for a salon workflow. It handles public appointment booking, dynamic availability, secure admin management, rescheduling, client profiles, and schedule controls.

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
6. The client selects a time and enters their name and phone number
7. A booking is created via the Supabase RPC function `create_booking`

When a booking is created, the database:

* Checks working hours, blocked dates, and booking conflicts
* Creates or updates a client profile by phone number using `upsert_client`
* Stores the `client_id` on the booking
* Stores a snapshot of selected services in `booking_services`
* Returns the booking ID to the frontend

A key detail is that changing add-ons automatically recalculates availability, since longer appointments reduce the number of valid time slots.

---

## Data Model

The system is driven by a small set of focused tables:

* **bookings** - stores appointment times, client details, status, total price, and optional `client_id`
* **booking_services** - stores a snapshot of service names, prices, and primary/add-on status at the time of booking
* **clients** - stores client profiles by unique phone number, with editable admin notes
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

The `clients` table uses phone number as the unique identifier. When a booking is created, `upsert_client` either creates a new client or updates the existing client's name.

The admin Clients tab shows:

* Client name
* Phone number
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
* **get_reschedule_available_slots** - generates admin reschedule availability while excluding the current booking
* **reschedule_booking** - validates conflicts and updates booking times

This keeps important business logic in the database rather than relying only on frontend checks.

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
* Row Level Security
* date-fns

---

## Limitations / Future Improvements

Potential future improvements include:

* Multi-staff or stylist support
* SMS or email confirmations and reminders
* Waitlist and cancellation handling
* Client self-service cancellation or rescheduling
* Deposits or online payments
* Admin audit history for booking changes

---

## What I Learned

Building this project helped me understand how to design real-world scheduling systems, handle availability and conflicts correctly, use Supabase RPC functions for backend logic, secure a frontend app with Supabase Auth and RLS, model bookings and client profiles and balance polished admin UX with reliable database constraints.
