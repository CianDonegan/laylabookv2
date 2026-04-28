import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import ClientForm from '../ClientForm'
import type { Service } from '../../../types'

const PRIMARY_SERVICE: Service = {
  id: '1', name: 'Gel Nails', price: 45, duration_minutes: 60,
  buffer_minutes: 15, category: 'Nails', is_addon: false,
  addon_for_categories: null, active: true, sort_order: 1, created_at: '2024-01-01',
}

const SUMMARY = {
  primaryService: PRIMARY_SERVICE,
  addons: [],
  dateLabel: 'Mon, 2 Jun',
  time: '10:00',
  duration: 60,
  totalPrice: '45.00',
}

function renderForm(formOverrides = {}, propOverrides = {}) {
  const onChange = vi.fn()
  const onSubmit = vi.fn()
  render(
    <ClientForm
      form={{ name: '', email: '', phone: '', ...formOverrides }}
      onChange={onChange}
      onSubmit={onSubmit}
      loading={false}
      error={null}
      summary={SUMMARY}
      {...propOverrides}
    />
  )
  return { onChange, onSubmit }
}

describe('ClientForm — submit button state', () => {
  it('is disabled when all fields are empty', () => {
    renderForm()
    expect(screen.getByRole('button', { name: /request appointment/i })).toBeDisabled()
  })

  it('is disabled with valid name and phone but no email', () => {
    renderForm({ name: 'Alice', phone: '0851234567' })
    expect(screen.getByRole('button', { name: /request appointment/i })).toBeDisabled()
  })

  it('is disabled with valid name and email but no phone', () => {
    renderForm({ name: 'Alice', email: 'alice@example.com' })
    expect(screen.getByRole('button', { name: /request appointment/i })).toBeDisabled()
  })

  it('is disabled when name is too short', () => {
    renderForm({ name: 'A', email: 'alice@example.com', phone: '0851234567' })
    expect(screen.getByRole('button', { name: /request appointment/i })).toBeDisabled()
  })

  it('is enabled when name, email and phone are all valid', () => {
    renderForm({ name: 'Alice', email: 'alice@example.com', phone: '0851234567' })
    expect(screen.getByRole('button', { name: /request appointment/i })).toBeEnabled()
  })

  it('is disabled while loading', () => {
    renderForm(
      { name: 'Alice', email: 'alice@example.com', phone: '0851234567' },
      { loading: true }
    )
    expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled()
  })
})

describe('ClientForm — email validation', () => {
  it('shows no error before user has typed in email field', () => {
    renderForm()
    expect(screen.queryByText(/valid email/i)).not.toBeInTheDocument()
  })

  it('shows error for invalid email after typing', () => {
    // ClientForm shows the error when the field has been touched (non-empty) but is invalid.
    // Render directly with a bad email value to trigger the error display.
    renderForm({ email: 'notanemail' })
    expect(screen.getAllByText(/valid email address/i)[0]).toBeInTheDocument()
  })

  it('accepts +353 format email domains', () => {
    renderForm({ name: 'Alice', email: 'alice@beauty.ie', phone: '0851234567' })
    expect(screen.queryByText(/valid email/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /request appointment/i })).toBeEnabled()
  })
})

describe('ClientForm — phone validation', () => {
  it('shows no error before user has typed in phone field', () => {
    renderForm()
    expect(screen.queryByText(/not valid/i)).not.toBeInTheDocument()
  })

  it('shows error hint when phone is started but invalid', () => {
    renderForm({ phone: '123' })
    expect(screen.getByText(/irish numbers/i)).toHaveClass('text-red-500')
  })

  it('accepts Irish 08x format', () => {
    renderForm({ name: 'Alice', email: 'alice@example.com', phone: '0851234567' })
    expect(screen.getByRole('button', { name: /request appointment/i })).toBeEnabled()
  })

  it('accepts +353 format', () => {
    renderForm({ name: 'Alice', email: 'alice@example.com', phone: '+353851234567' })
    expect(screen.getByRole('button', { name: /request appointment/i })).toBeEnabled()
  })

  it('accepts UK +44 format', () => {
    renderForm({ name: 'Alice', email: 'alice@example.com', phone: '+447911123456' })
    expect(screen.getByRole('button', { name: /request appointment/i })).toBeEnabled()
  })

  it('rejects a plain 7-digit number', () => {
    renderForm({ name: 'Alice', email: 'alice@example.com', phone: '1234567' })
    expect(screen.getByRole('button', { name: /request appointment/i })).toBeDisabled()
  })
})

describe('ClientForm — error banner', () => {
  it('displays the error prop when set', () => {
    renderForm({}, { error: 'Booking failed. Please try again.' })
    expect(screen.getByText('Booking failed. Please try again.')).toBeInTheDocument()
  })

  it('does not render an error banner when error is null', () => {
    renderForm()
    expect(screen.queryByText(/booking failed/i)).not.toBeInTheDocument()
  })
})

describe('ClientForm — booking summary', () => {
  it('displays the primary service name', () => {
    renderForm()
    expect(screen.getByText('Gel Nails')).toBeInTheDocument()
  })

  it('displays the date and time', () => {
    renderForm()
    expect(screen.getByText('Mon, 2 Jun')).toBeInTheDocument()
    expect(screen.getByText('10:00')).toBeInTheDocument()
  })
})
