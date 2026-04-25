export interface Service {
  id: string
  name: string
  price: number
  duration_minutes: number
  buffer_minutes: number
  category: string
  is_addon: boolean
  addon_for_categories: string[] | null
  active: boolean
  sort_order: number
  created_at: string
}

export interface WorkingHours {
  day_of_week: number
  day_name: string
  is_open: boolean
  start_time: string
  end_time: string
  slot_interval_minutes: number
}

export interface BlockedDate {
  date: string
  reason: string | null
}

export interface Booking {
  id: string
  client_name: string
  client_phone: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
  start_time: string
  end_time: string
  total_price: number
  notes: string | null
  created_at: string
  booking_services?: BookingService[]
}

export interface BookingService {
  id: string
  booking_id: string
  service_id: string
  is_primary: boolean
  price_at_booking: number
  name_at_booking: string
}

export interface BookingPayload {
  name: string
  phone: string
  startTime: string
  endTime: string
  totalPrice: number
  services: {
    service_id: string
    is_primary: boolean
    price: number
    name: string
  }[]
}