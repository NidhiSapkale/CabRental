import { NavLink } from 'react-router-dom';

export default function HomePage() {
  return (
    <section className="page-shell">
      <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <span className="inline-flex rounded-full border border-brand/20 bg-brand/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-brand">
            Smart mobility
          </span>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Rent a cab that feels effortless.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-slate-600">
            Book reliable rides, compare flexible vehicle options, and enjoy cleaner, smarter travel for work, weekends, and everything in between.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <NavLink to="/booking" className="primary-btn">
              Book a ride
            </NavLink>
            <NavLink to="/services" className="secondary-btn">
              Explore vehicles
            </NavLink>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-brand/5 via-white to-emerald-50 p-6 shadow-soft">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm font-medium uppercase tracking-[0.12em] text-slate-500">Today</p>
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.1em] text-slate-500">From</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">Downtown</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.1em] text-slate-500">To</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">Airport</p>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-2xl border border-brand/10 bg-brand/5 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Estimated</p>
                  <p className="text-xl font-bold text-slate-900">$78</p>
                </div>
                <span className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white">Available</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
