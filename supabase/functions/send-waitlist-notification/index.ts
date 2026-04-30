// Supabase edge function — Deno runtime, no npm packages.
// Called by the database (pg_net) when a freed slot has been offered to a
// waitlist entry. Sends an HTML email with a tokenised claim link via Resend.
//
// Required Supabase secrets:
//   RESEND_API_KEY     — your Resend API key
//   RESEND_FROM_EMAIL  — verified sender, e.g. "Beauty by Layla <bookings@beautybylayla.ie>"
//   CRON_SECRET        — random secret shared with pg_cron / pg_net for auth
//   PUBLIC_BASE_URL    — public site origin used to build claim links
//                        (falls back to https://laylabookv2.vercel.app)

const RESEND_API_KEY   = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL       = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Beauty by Layla <bookings@beautybylayla.ie>'
const CRON_SECRET      = Deno.env.get('CRON_SECRET') ?? ''
const PUBLIC_BASE_URL  = Deno.env.get('PUBLIC_BASE_URL') ?? 'https://laylabookv2.vercel.app'

// Mirrors the services_snapshot shape stored on waitlist rows. Only `name`
// and `is_primary` are read here; service_id and price are present so the
// type matches the wire payload faithfully (and so this stays a drop-in
// replacement if we ever want to render the price breakdown per service).
interface Service {
  service_id: string
  name:       string
  price:      number
  is_primary: boolean
}

interface Payload {
  clientName:  string
  clientEmail: string
  startTime:   string  // ISO 8601 — when the freed appointment starts
  expiresAt:   string  // ISO 8601 — when the claim link expires
  totalPrice:  number
  services:    Service[]
  claimToken:  string
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
  const { clientName, startTime, expiresAt, services, totalPrice, claimToken } = payload
  const date = formatDate(startTime)
  const time = formatTime(startTime)
  const claimBy = formatTime(expiresAt)
  const primary = services.find((s) => s.is_primary)?.name ?? 'Appointment'
  const addons = services.filter((s) => !s.is_primary)
  const claimUrl = `${PUBLIC_BASE_URL}/claim/${claimToken}`

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
  <title>Slot just opened – Beauty by Layla</title>
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
              <h1 style="margin:8px 0 0;font-size:22px;font-weight:600;color:#ffffff;">A slot just opened up</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 6px;font-size:14px;color:#2c2c2c;">Hi ${clientName},</p>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.65;color:#6b6b6b;">
                Good news — a spot has just opened up that matches the time you were waiting for.
                It's yours if you can claim it within the next 15 minutes.
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

              <!-- Claim CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td align="center">
                    <a href="${claimUrl}"
                       style="display:inline-block;padding:14px 32px;background:#6f875f;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;border-radius:999px;">
                      Claim this appointment
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;font-size:12px;line-height:1.6;color:#9a9a9a;text-align:center;">
                This link expires at <strong style="color:#2c2c2c;">${claimBy}</strong> Dublin time.
                If it isn't claimed in time, it'll be offered to the next person waiting.
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
    return new Response('ok', { status: 200 })
  }

  // Verify the shared secret passed by pg_net.
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
    const payload: Payload = await req.json()
    const { clientName, clientEmail, startTime, expiresAt, services, claimToken } = payload

    if (!clientEmail || !clientName || !startTime || !expiresAt || !services || !claimToken) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const html = buildHtml(payload)
    const subjectDate = formatDate(startTime)

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [clientEmail],
        subject: `⏰ Slot just opened — ${subjectDate} – Beauty by Layla`,
        html,
      }),
    })

    if (!resendRes.ok) {
      const detail = await resendRes.text()
      console.error('[send-waitlist-notification] Resend error:', detail)
      return new Response(JSON.stringify({ error: detail }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[send-waitlist-notification] error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
