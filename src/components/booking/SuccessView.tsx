export default function SuccessView() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f8f4] p-6">
      <div className="w-full max-w-md rounded-[2rem] border border-white bg-white p-10 text-center shadow-[0_24px_80px_rgba(44,44,44,0.10)]">
        <img
          src="/laylalogo.jpg"
          alt="Beauty by Layla"
          className="mx-auto mb-6 w-24 opacity-90"
        />
        <h2 className="mb-3 text-2xl font-semibold text-brand-text">Request received</h2>
        <p className="text-sm leading-relaxed text-brand-muted">
          Thank you for booking with Beauty by Layla. You'll receive a text once your appointment is
          confirmed.
        </p>
      </div>
    </div>
  )
}
