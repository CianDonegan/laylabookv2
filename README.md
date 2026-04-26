## 🧠 How the System Works

This project is built around a simple idea:

> **Availability is not stored — it is generated dynamically.**

Instead of pre-creating time slots and trying to keep them in sync, the system calculates availability in real time based on rules and existing bookings.

At the core of this is a Supabase RPC function (`get_available_slots`) which:

* Reads the salon’s working hours for the selected day
* Checks if the date is blocked (days off / holidays)
* Generates possible time slots using SQL
* Filters out any slots that overlap with existing bookings

This means the system always returns accurate availability without needing to manage or update slot data manually.

---

##  Booking Flow

The booking flow is designed to reflect how real appointments work:

1. The client selects a service
2. Optional add-ons can be added (which affect total duration)
3. The user picks a date
4. Available time slots are fetched dynamically based on total duration
5. The user selects a time and enters their details
6. A booking is created via a Supabase RPC (`create_booking`)

A key detail here is that **changing add-ons automatically recalculates availability**, since longer appointments reduce the number of valid time slots.

---

##  Data Model

The system is driven by a small set of focused tables:

* **bookings** — stores appointment times, client info, and status
* **booking_services** — stores a snapshot of services and pricing at the time of booking
* **working_hours** — defines the weekly schedule (open/closed + times)
* **blocked_dates** — stores one-off closures (holidays, days off)
* **services** — defines available services, durations, and pricing

One important design choice is storing service details in `booking_services` at the time of booking. This avoids issues if prices or service names change later.

---

##  Admin System

The admin dashboard is designed for day-to-day salon use:

* **Today view** for live operations
* **Week view** for planning
* **Month view** for overview
* **List view** for searching and filtering

Bookings can be:

* Confirmed
* Cancelled
* Completed
* Marked as no-show

The dashboard also includes:

* Revenue tracking (today + weekly)
* Status filtering and search
* Inline actions for fast workflow

---

##  Scheduling & Availability Control

The system separates scheduling into two concepts:

* **Working Hours** → recurring weekly schedule
* **Blocked Dates** → one-off exceptions (days off, holidays)

Both are configurable from the admin settings.

Availability logic always checks both, ensuring:

* Closed days cannot be booked
* Days off override normal working hours

---

##  Key Design Decisions

Some of the main decisions behind this system:

* **Dynamic availability instead of stored slots**
  Avoids sync issues and keeps logic simple and reliable

* **Backend as the source of truth**
  All availability rules are enforced in the database (not just the UI)

* **Snapshot booking data**
  Services and prices are stored at the time of booking to preserve history

* **Separation of concerns**
  The frontend handles UI, while the backend handles business logic

---

##  Limitations / Future Improvements

This version focuses on core booking functionality. Potential improvements include:

* Proper admin authentication (currently client-side gated)
* Multi-staff / stylist support
* Rescheduling bookings
* SMS confirmations and reminders
* Waitlist / cancellation handling

---

##  What I Learned

Building this project helped me understand:

* How to design real-world scheduling systems
* How to handle availability and conflicts correctly
* How to use Supabase RPC for backend logic
* How to balance UX with underlying system constraints
