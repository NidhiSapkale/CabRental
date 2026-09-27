export default function AboutPage() {
  return (
    <section className="page-shell">
      <div className="max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">About</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">CabRental</h1>
        <p className="mt-5 text-lg leading-8 text-slate-700">
          CabRental is a peer-to-peer vehicle rental platform where bookings, payments, and rental history are secured using blockchain technology. Every booking and vehicle record is designed to be transparent, verifiable, and tamper-resistant, making the rental history easier to trust and easier to audit.
        </p>
        <p className="mt-4 text-lg leading-8 text-slate-700">
          This project was built as a mini project for a Blockchain Technology course, combining a modern web app with blockchain-backed verification for booking and ownership records.
        </p>
      </div>
    </section>
  );
}
