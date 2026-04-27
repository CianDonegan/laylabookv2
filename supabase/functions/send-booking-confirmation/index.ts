// Supabase edge function — Deno runtime, no npm packages.
// Sends a booking confirmation email via the Resend API.
//
// Required Supabase secrets:
//   RESEND_API_KEY     — your Resend API key
//   RESEND_FROM_EMAIL  — verified sender, e.g. "Beauty by Layla <bookings@beautybylayla.ie>"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Beauty by Layla <bookings@beautybylayla.ie>'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Every response must include CORS headers — without them the browser blocks
// the response even if the status is 200.
function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

interface Service {
  name: string
  is_primary: boolean
}

interface Payload {
  clientName: string
  clientEmail: string
  startTime: string
  services: Service[]
  totalPrice: number
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

function buildHtml(payload: Payload): string {
  const { clientName, startTime, services, totalPrice } = payload
  const date = formatDate(startTime)
  const time = formatTime(startTime)
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
  <title>Booking confirmation – Beauty by Layla</title>
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
              <h1 style="margin:8px 0 0;font-size:22px;font-weight:600;color:#ffffff;">Booking request received</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 6px;font-size:14px;color:#2c2c2c;">Hi ${clientName},</p>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.65;color:#6b6b6b;">
                Thanks for booking with Beauty by Layla. Your appointment request has been received
                and will be confirmed within 24 hours.
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
                      <td style="font-size:16px;font-weight:600;color:#6f875f;text-align:right;">${formatPrice(totalPrice)}</td>
                    </tr></table>
                  </td>
                </tr>
              </table>

              <!-- What's next -->
              <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#2c2c2c;">What happens next?</p>
              <p style="margin:0 0 24px;font-size:13px;line-height:1.65;color:#6b6b6b;">
                You'll receive a confirmation email once your appointment is accepted. On the day,
                text when you arrive outside and Layla will come to let you in.
              </p>

              <!-- Location -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fbfcfa;border:1px solid #edf0ea;border-radius:16px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 3px;font-size:12px;font-weight:600;color:#2c2c2c;">Beauty by Layla</p>
                    <p style="margin:0;font-size:12px;color:#9a9a9a;">Clondalkin, Dublin 22</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #edf0ea;text-align:center;">
              <p style="margin:0;font-size:11px;color:#b0b0b0;">
                This is an automated message. Please do not reply to this email.
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  if (!req.headers.get('Authorization')) {
    return respond({ error: 'Unauthorized' }, 401)
  }

  try {
    const payload: Payload = await req.json()
    const { clientName, clientEmail, startTime, services } = payload

    if (!clientEmail || !clientName || !startTime || !services) {
      return respond({ error: 'Missing required fields' }, 400)
    }

    const html = buildHtml(payload)

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [clientEmail],
        subject: 'Booking request received – Beauty by Layla',
        html,
      }),
    })

    if (!resendRes.ok) {
      const detail = await resendRes.text()
      console.error('Resend error:', detail)
      return respond({ error: detail }, 500)
    }

    return respond({ ok: true })
  } catch (err) {
    console.error('send-booking-confirmation error:', err)
    return respond({ error: String(err) }, 500)
  }
})
