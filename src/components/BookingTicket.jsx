import { QRCodeSVG } from 'qrcode.react';

function shortenAddress(address) {
  if (!address) {
    return 'Unknown wallet';
  }

  if (address.length <= 10) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'number') {
    return new Date(value * 1000);
  }

  if (value?.toDate) {
    return value.toDate();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value) {
  const dateValue = parseDate(value);
  if (!dateValue) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(dateValue);
}

function formatDateTime(value) {
  const dateValue = parseDate(value);
  if (!dateValue) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(dateValue);
}

function formatExpectedWindow(value) {
  const deadline = parseDate(value);
  if (!deadline) {
    return 'Not available';
  }

  const windowStart = new Date(deadline.getTime() - 2.5 * 60 * 60 * 1000);
  const dateLabel = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(deadline);
  const startLabel = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(windowStart);
  const endLabel = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(deadline);

  return `Expected drop-off: ${dateLabel}, between ${startLabel} and ${endLabel}`;
}

export default function BookingTicket({
  booking,
  vehicleModel,
  renterAddress,
  txHash,
  numDays,
  startDate,
  pickupLocation,
  dropLocation,
  pickupDateTime,
  expectedDropDateTime,
  actualDropDateTime,
  vehicleImage,
  className = '',
}) {
  const resolvedTxHash = txHash || booking?.txHash || '';
  const bookingUrl = resolvedTxHash ? `https://sepolia.etherscan.io/tx/${resolvedTxHash}` : '#';
  const resolvedVehicleModel = vehicleModel || booking?.vehicleModel || 'Vehicle booking';
  const resolvedRenterAddress = renterAddress || booking?.userWalletAddress || booking?.userEmail || 'Unknown wallet';
  const resolvedNumDays = numDays ?? booking?.numDays ?? 1;
  const resolvedStartDate = startDate ?? booking?.startDate ?? new Date();
  const resolvedPickupLocation = pickupLocation ?? booking?.pickupLocation ?? 'Not provided';
  const resolvedDropLocation = dropLocation ?? booking?.dropLocation ?? 'Not provided';
  const resolvedPickupDateTime = pickupDateTime ?? booking?.pickupDateTime ?? null;
  const resolvedExpectedDropDateTime = expectedDropDateTime ?? booking?.expectedDropDateTime ?? null;
  const resolvedActualDropDateTime = actualDropDateTime ?? booking?.actualDropDateTime ?? null;

  return (
    <div className={`rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-amber-50 p-5 shadow-soft ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {vehicleImage ? (
            <img src={vehicleImage} alt={resolvedVehicleModel} className="h-14 w-14 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-200 text-2xl text-slate-600">🚗</div>
          )}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Booking record</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">{resolvedVehicleModel}</h3>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
          <span aria-hidden="true">🔒</span>
          Secured by Blockchain
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Renter</p>
          <p className="mt-2 text-sm font-semibold text-slate-800">{shortenAddress(resolvedRenterAddress)}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Days</p>
          <p className="mt-2 text-sm font-semibold text-slate-800">{resolvedNumDays} day{resolvedNumDays > 1 ? 's' : ''}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Pickup location</p>
          <p className="mt-2 text-sm font-semibold text-slate-800">{resolvedPickupLocation}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Drop location</p>
          <p className="mt-2 text-sm font-semibold text-slate-800">{resolvedDropLocation}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Pickup</p>
          <p className="mt-2 text-sm font-semibold text-slate-800">{formatDateTime(resolvedPickupDateTime)}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Expected window</p>
          <p className="mt-2 text-sm font-semibold text-slate-800">{formatExpectedWindow(resolvedExpectedDropDateTime)}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 sm:col-span-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Actual drop-off</p>
          <p className="mt-2 text-sm font-semibold text-slate-800">
            {resolvedActualDropDateTime ? formatDateTime(resolvedActualDropDateTime) : 'Not yet completed'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 sm:col-span-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Rental start</p>
          <p className="mt-2 text-sm font-semibold text-slate-800">{formatDate(resolvedStartDate)}</p>
        </div>
      </div>

      <div className="mt-6 flex justify-center">
        <a
          href={bookingUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:scale-[1.01] hover:shadow-md"
          aria-label="Verify the booking on Etherscan"
        >
          <QRCodeSVG value={bookingUrl} size={120} bgColor="#ffffff" fgColor="#0f172a" level="M" />
        </a>
      </div>

      <p className="mt-4 text-center text-[10px] font-medium text-slate-500">
        Scan or click to verify this booking's record.
      </p>
    </div>
  );
}
