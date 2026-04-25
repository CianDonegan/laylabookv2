# LaylaBook

Simple booking system for a nail salon.

## What it does

- Lets clients book appointments based on available times
- Supports multiple services per booking
- Handles service durations and buffer time
- Blocks out unavailable days
- Admin can view, confirm, and cancel bookings

## Tech

- React
- TypeScript
- Vite
- Tailwind CSS
- Supabase

## How it works

Time slots are not stored in the database.

Available times are generated based on:
- working hours
- existing bookings
- service duration
- buffer time

This avoids having to manage a large number of static slots.

## Running locally

Clone the repo:

```bash
git clone https://github.com/CianDonegan/laylabookv2.git
cd laylabookv2
