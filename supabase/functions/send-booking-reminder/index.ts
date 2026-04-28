// Supabase edge function — Deno runtime, no npm packages.
// Called by pg_cron daily. Queries for tomorrow's confirmed bookings and sends
// reminder emails via Resend.
//
// Required Supabase secrets:
//   RESEND_API_KEY     — your Resend API key
//   RESEND_FROM_EMAIL  — verified sender, e.g. "Beauty by Layla <bookings@beautybylayla.ie>"
//   CRON_SECRET        — random secret shared with pg_cron for auth

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Beauty by Layla <bookings@beautybylayla.ie>'
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

interface ReminderRow {
  booking_id: string
  client_name: string
  client_email: string
  start_time: string
  total_price: number
  services: Array<{ name: string; is_primary: boolean }>
}

function formatDate(isoString: string): string {
  return new Intl.DateTimeFormat('en-IE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Dublin',
  }).format(new Date(isoString))
}

function formatTime(isoString: string): string {
  return new Intl.DateTimeFormat('en-IE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Dublin',
  }).format(new Date(isoString))
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount)
}

function buildHtml(row: ReminderRow): string {
  const { client_name, start_time, services, total_price } = row
  const date = formatDate(start_time)
  const time = formatTime(start_time)
  const primary = services.find((s) => s.is_primary)?.name ?? 'Appointment'
  const addons = services.filter((s) => !s.is_primary)

  const addonsRows = addons
    .map(
      (a) => `
      <tr>
        <td style="padding:12px 20px;border-bottom:1px solid #dfe6da;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-size:13px;color:#9a9a9a;">Add-on</td>
            <td style="font-size:13px;font-weight:600;color:#2c2c2c;text-align:right;">${a.name}</td>
          </tr></table>
        </td>
      </tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>Appointment reminder – Beauty by Layla</title>
</head>
<body style="margin:0;padding:0;background:#f0f1ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

          <!-- Header -->
          <tr>
            <td style="background:#8fa17f;padding:28px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:rgba(255,255,255,0.75);">Beauty by Layla</p>
              <h1 style="margin:8px 0 0;font-size:22px;font-weight:600;color:#ffffff;">Your appointment is tomorrow</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 6px;font-size:14px;color:#2c2c2c;">Hi ${client_name},</p>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.65;color:#6b6b6b;">
                Just a reminder that your appointment with Beauty by Layla is tomorrow.
                We look forward to seeing you!
              </p>

              <!-- Appointment details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f6ee;border-radius:16px;border:1px solid #cfdcc8;margin-bottom:24px;">
                <tr>
                  <td style="padding:14px 20px;border-bottom:1px solid #dfe6da;">
                    <p style="margin:0;font-size:10px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:#7f9670;">Appointment details</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 20px;border-bottom:1px solid #dfe6da;">
                    <table width="100%" cellpadding="0" cellspacing="0"><tr>
                      <td style="font-size:13px;color:#9a9a9a;">Date</td>
                      <td style="font-size:13px;font-weight:600;color:#2c2c2c;text-align:right;">${date}</td>
                    </tr></table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 20px;border-bottom:1px solid #dfe6da;">
                    <table width="100%" cellpadding="0" cellspacing="0"><tr>
                      <td style="font-size:13px;color:#9a9a9a;">Time</td>
                      <td style="font-size:13px;font-weight:600;color:#2c2c2c;text-align:right;">${time}</td>
                    </tr></table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 20px;border-bottom:1px solid #dfe6da;">
                    <table width="100%" cellpadding="0" cellspacing="0"><tr>
                      <td style="font-size:13px;color:#9a9a9a;">Service</td>
                      <td style="font-size:13px;font-weight:600;color:#2c2c2c;text-align:right;">${primary}</td>
                    </tr></table>
                  </td>
                </tr>
                ${addonsRows}
                <tr>
                  <td style="padding:14px 20px;background:#ffffff;border-top:1px solid #dfe6da;border-radius:0 0 16px 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0"><tr>
                      <td style="font-size:13px;font-weight:600;color:#2c2c2c;">Total</td>
                      <td style="font-size:16px;font-weight:600;color:#6f875f;text-align:right;">${formatPrice(total_price)}</td>
                    </tr></table>
                  </td>
                </tr>
              </table>

              <!-- Location + arrival note -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fbfcfa;border:1px solid #edf0ea;border-radius:16px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 3px;font-size:12px;font-weight:600;color:#2c2c2c;">Beauty by Layla</p>
                    <p style="margin:0 0 10px;font-size:12px;color:#9a9a9a;">Clondalkin, Dublin 22</p>
                    <p style="margin:0;font-size:12px;line-height:1.6;color:#6b6b6b;">
                      When you arrive, please text Layla and she'll come to let you in.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #edf0ea;text-align:center;">
              <p style="margin:0;font-size:11px;color:#b0b0b0;">
                This is an automated reminder. Please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

async function getTomorrowsReminders(): Promise<ReminderRow[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_tomorrows_reminders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: '{}',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`get_tomorrows_reminders failed: ${text}`)
  }

  return res.json()
}

async function sendReminder(row: ReminderRow): Promise<void> {
  const html = buildHtml(row)

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [row.client_email],
      subject: `Reminder: your appointment is tomorrow – Beauty by Layla`,
      html,
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Resend error for ${row.client_email}: ${detail}`)
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200 })
  }

  // Verify the shared secret passed by pg_cron.
  // Authorization header is not used — Supabase's JWT gateway would reject a
  // non-JWT value before the function runs. X-Cron-Secret bypasses the gateway.
  const token = req.headers.get('X-Cron-Secret') ?? ''
  if (!CRON_SECRET || token !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const bookings = await getTomorrowsReminders()
    console.log(`[send-booking-reminder] found ${bookings.length} bookings for tomorrow`)

    const results = await Promise.allSettled(bookings.map(sendReminder))

    let sent = 0
    let failed = 0
    for (const r of results) {
      if (r.status === 'fulfilled') {
        sent++
      } else {
        failed++
        console.error('[send-booking-reminder] failed:', r.reason)
      }
    }

    return new Response(JSON.stringify({ sent, failed }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[send-booking-reminder] error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
