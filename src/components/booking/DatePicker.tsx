import { useState } from 'react'
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  parseISO,
} from 'date-fns'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface DatePickerProps {
  selectedDate: string
  onSelect: (date: string) => void
  isDateBlocked: (date: string) => boolean
  minDate: string
}

export default function DatePicker({ selectedDate, onSelect, isDateBlocked, minDate }: DatePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))

  const handleSelect = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd')
    if (isDateBlocked(dateStr)) return
    if (dateStr < minDate) return
    onSelect(dateStr)
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm overflow-hidden mb-4">
      <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-brand-border">
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-medium bg-brand-sage">
            2
          </span>
          <h2 className="font-medium text-sm text-brand-text">Choose a date</h2>
        </div>
        {selectedDate && (
          <button onClick={() => onSelect('')} className="text-xs text-brand-muted">
            Change
          </button>
        )}
      </div>

      {selectedDate && (
        <div className="px-6 py-3 text-sm font-medium text-brand-sage">
          {format(parseISO(selectedDate), 'EEEE, d MMMM')}
        </div>
      )}

      {!selectedDate && (
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={prevMonth}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-50 text-gray-400 text-lg"
            >
              ‹
            </button>
            <span className="text-sm font-medium text-brand-text">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <button
              onClick={nextMonth}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-50 text-gray-400 text-lg"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 mb-2">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-xs font-medium py-1 text-brand-muted">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day, i) => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const blocked = isDateBlocked(dateStr)
              const past = dateStr < minDate
              const disabled = blocked || past || !isSameMonth(day, currentMonth)
              const selected = dateStr === selectedDate

              return (
                <button
                  key={i}
                  disabled={disabled}
                  onClick={() => handleSelect(day)}
                  className="aspect-square rounded-xl text-xs flex items-center justify-center transition-all"
                  style={{
                    background: selected ? '#a8b89a' : 'transparent',
                    color: disabled ? '#ebebeb' : selected ? '#fff' : '#2c2c2c',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    fontWeight: selected ? '600' : '400',
                    opacity: isSameMonth(day, currentMonth) ? 1 : 0.3,
                  }}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}