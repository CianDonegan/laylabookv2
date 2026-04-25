export default function Hero() {
  return (
    <div className="mb-6 rounded-3xl overflow-hidden shadow-sm bg-white">
      <div
        className="relative h-56 flex items-end px-6 pb-0"
        style={{
          background: 'linear-gradient(160deg, #b8c9ac 0%, #8fa882 40%, #c5d4bc 100%)',
        }}
      >
        <div className="relative z-10 translate-y-12">
          <img
            src="/profile.jpg"
            alt="Layla"
            className="w-28 h-28 rounded-full object-cover object-top shadow-lg border-4 border-white"
          />
        </div>
      </div>
      <div className="px-6 pt-16 pb-7">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold tracking-tight mb-1 text-brand-text">
            Layla Donegan
          </h1>
          <p className="text-xs font-medium uppercase tracking-widest text-brand-sage">
            Beauty by Layla · Dublin · Est. 2022
          </p>
        </div>
        <p className="text-sm leading-relaxed mb-5 text-brand-muted">
          Welcome to Beauty by Layla. I'm a Dublin-based beauty professional specialising in
          nails, waxing, lashes, brows, makeup, and spray tans. Book your appointment below.
        </p>
        <div className="flex gap-4 text-xs font-medium text-brand-sage">
          <span>💅 Nails</span>
          <span>✨ Lashes & Brows</span>
          <span>🌿 Waxing</span>
          <span>💄 Makeup</span>
        </div>
      </div>
    </div>
  )
}