export default function SuccessView() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-brand-bg">
      <div className="bg-white rounded-3xl p-10 max-w-md w-full text-center shadow-sm">
        <img
          src="/laylalogo.jpg"
          alt="Beauty by Layla"
          className="w-24 mx-auto mb-6 opacity-80"
        />
        <h2 className="text-xl font-light text-gray-800 mb-3">Request received</h2>
        <p className="text-sm leading-relaxed text-brand-muted">
          Thank you for booking with Beauty by Layla. You'll receive a text once your appointment is
          confirmed.
        </p>
      </div>
    </div>
  )
}