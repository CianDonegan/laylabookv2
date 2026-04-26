export default function Hero() {
  return (
    <div className="mb-6 overflow-hidden rounded-[2rem] border border-white bg-white shadow-[0_18px_50px_rgba(44,44,44,0.07)]">
      <div className="bg-brand-bg px-6 py-8 sm:px-8">
        <img
          src="/laylalogo.jpg"
          alt="Beauty by Layla"
          className="mx-auto h-28 w-auto object-contain sm:h-32"
        />
      </div>

      <div className="px-6 pb-7 pt-6 sm:px-8">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-end sm:text-left">
          <img
            src="/profile.png"
            alt="Layla"
            className="h-24 w-24 rounded-full object-cover object-top shadow-[0_14px_35px_rgba(44,44,44,0.12)] ring-4 ring-white"
          />

          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-brand-text">
              Layla Donegan
            </h1>
            <p className="mt-1 text-xs font-medium uppercase tracking-widest text-brand-sage">
              Beauty by Layla - Dublin - Est. 2022
            </p>
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-brand-muted">
          Welcome to Beauty by Layla. I'm a Dublin-based beauty professional specialising in
          nails, waxing, lashes, brows, makeup, and spray tans. Book your appointment below.
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-3 text-xs font-medium text-brand-sage sm:justify-start">
          <span>Nails</span>
          <span>Lashes & Brows</span>
          <span>Waxing</span>
          <span>Makeup</span>
        </div>
      </div>
    </div>
  )
}
