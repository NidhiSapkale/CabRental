import { useEffect, useState } from 'react';
import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { ethers } from 'ethers';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { getContract, ensureSepoliaNetwork, CONTRACT_ABI, CONTRACT_ADDRESS } from '../contract';
import { formatInrFromEth, getEthPriceDisplay } from '../priceUtils';
import BookingTicket from '../components/BookingTicket';

const THANE_LOCATION_OPTIONS = [
  'Thane Railway Station (West)',
  'Korum Mall, Eastern Express Highway',
  'Lake Shore Mall (formerly Viviana Mall), Eastern Express Highway',
  'Talao Pali Lake, Ghantali',
  'NaMo Grand Central Park, Kolshet Road',
  'Anand Nagar Chowk, Ghodbunder Road',
  'Balkum Naka, Old Agra Road',
  'Chatrapati Shivaji Maharaj Chowk, near R Mall',
];

const DEFAULT_PRICE_PER_DAY_ETH = 0.001;
const DEFAULT_DEPOSIT_ETH = 0.0005;

export default function BookingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedVehicle = location.state?.selectedVehicle || null;
  const [user, setUser] = useState(auth.currentUser);
  const [authReady, setAuthReady] = useState(false);
  const [days, setDays] = useState(1);
  const [pickupLocation, setPickupLocation] = useState(THANE_LOCATION_OPTIONS[0]);
  const [dropLocation, setDropLocation] = useState(THANE_LOCATION_OPTIONS[0]);
  const [pickupDateTime, setPickupDateTime] = useState('');
  const [error, setError] = useState('');
  const [booking, setBooking] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const [liveVehiclePricing, setLiveVehiclePricing] = useState({
    pricePerDay: Number(selectedVehicle?.pricePerDay) || DEFAULT_PRICE_PER_DAY_ETH,
    deposit: Number(selectedVehicle?.deposit) || DEFAULT_DEPOSIT_ETH,
  });
  const pricePerDayEth = liveVehiclePricing.pricePerDay;
  const depositEth = liveVehiclePricing.deposit;
  const totalEthDue = pricePerDayEth * Math.max(1, Number(days || 1)) + depositEth;
  const selectedVehiclePriceDisplay = getEthPriceDisplay(pricePerDayEth);
  const totalPriceDisplay = getEthPriceDisplay(totalEthDue);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const syncLiveVehiclePricing = async () => {
      if (!selectedVehicle?.onChainId) {
        return;
      }

      try {
        const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
        const vehicleDetails = await contract.getVehicle(Number(selectedVehicle.onChainId));
        setLiveVehiclePricing({
          pricePerDay: Number(ethers.formatEther(vehicleDetails[2])),
          deposit: Number(ethers.formatEther(vehicleDetails[3])),
        });
      } catch (err) {
        setLiveVehiclePricing({
          pricePerDay: Number(selectedVehicle?.pricePerDay) || DEFAULT_PRICE_PER_DAY_ETH,
          deposit: Number(selectedVehicle?.deposit) || DEFAULT_DEPOSIT_ETH,
        });
      }
    };

    syncLiveVehiclePricing();
  }, [selectedVehicle?.onChainId, selectedVehicle?.pricePerDay, selectedVehicle?.deposit]);

  useEffect(() => {
    if (!authReady) return;

    if (!user && selectedVehicle) {
      navigate('/login', {
        state: {
          from: '/booking',
          selectedVehicle,
        },
      });
    }
  }, [authReady, user, selectedVehicle, navigate]);

  const handleConfirmBooking = async (event) => {
    event.preventDefault();
    setError('');

    if (!selectedVehicle) {
      setError('Please choose a vehicle from the services page before booking.');
      navigate('/services');
      return;
    }

    if (!user) {
      navigate('/login', {
        state: {
          from: '/booking',
          selectedVehicle,
        },
      });
      return;
    }

    const safeDays = Number(days);
    if (!Number.isInteger(safeDays) || safeDays < 1) {
      setError('Please enter a rental period of at least 1 day.');
      return;
    }

    if (!pickupLocation) {
      setError('Please choose a pickup location.');
      return;
    }

    if (!dropLocation) {
      setError('Please choose a drop location.');
      return;
    }

    if (!pickupDateTime) {
      setError('Please select a pickup date and time.');
      return;
    }

    const pickupMoment = new Date(pickupDateTime);
    if (Number.isNaN(pickupMoment.getTime())) {
      setError('The selected pickup date and time are invalid. Please choose a valid value.');
      return;
    }

    const vehicleIdAsNumber = Number(selectedVehicle.onChainId);
    if (!Number.isFinite(vehicleIdAsNumber)) {
      setError('This vehicle is missing a valid on-chain ID. Please choose another vehicle.');
      return;
    }

    const expectedDropDeadline = new Date(pickupMoment.getTime() + safeDays * 24 * 60 * 60 * 1000);

    try {
      setBooking(true);

      await ensureSepoliaNetwork();
      const contract = await getContract();
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const walletAddress = (await signer.getAddress()).toLowerCase();
      const vehicleDetails = await contract.getVehicle(vehicleIdAsNumber);
      const pricePerDayWei = vehicleDetails[2];
      const depositWei = vehicleDetails[3];
      const totalRequiredWei = (pricePerDayWei * BigInt(safeDays)) + depositWei;

      const tx = await contract.rentVehicle(vehicleIdAsNumber, safeDays, { value: totalRequiredWei });
      await tx.wait();

      await runTransaction(db, async (transaction) => {
        const vehicleRef = doc(db, 'vehicles', selectedVehicle.id);
        const vehicleSnapshot = await transaction.get(vehicleRef);

        if (!vehicleSnapshot.exists()) {
          throw new Error('This vehicle is no longer available. Please choose another option.');
        }

        if (vehicleSnapshot.data().isAvailable !== true) {
          throw new Error('This vehicle was just booked by someone else. Please choose another option.');
        }

        const bookingRef = doc(collection(db, 'bookings'));
        const bookingData = {
          vehicleId: selectedVehicle.id,
          onChainId: vehicleIdAsNumber,
          vehicleModel: selectedVehicle.model,
          userId: user.uid,
          userEmail: user.email || '',
          userWalletAddress: walletAddress,
          numDays: safeDays,
          totalCost: Number(ethers.formatEther(totalRequiredWei)),
          startDate: new Date(),
          pickupLocation: pickupLocation.trim(),
          dropLocation: dropLocation.trim(),
          pickupDateTime: pickupDateTime,
          expectedDropDateTime: expectedDropDeadline.toISOString(),
          actualDropDateTime: null,
          isActive: true,
          txHash: tx.hash,
          createdAt: serverTimestamp(),
        };

        transaction.set(bookingRef, bookingData);
        transaction.update(vehicleRef, { isAvailable: false });
      });

      setConfirmedBooking({
        vehicleModel: selectedVehicle.model,
        userWalletAddress: walletAddress,
        numDays: safeDays,
        startDate: new Date(),
        pickupLocation: pickupLocation.trim(),
        dropLocation: dropLocation.trim(),
        pickupDateTime: pickupDateTime,
        expectedDropDateTime: expectedDropDeadline.toISOString(),
        txHash: tx.hash,
      });
    } catch (err) {
      const message = err?.code === 4001 || err?.message?.includes('rejected')
        ? 'MetaMask transaction was cancelled. No booking was created.'
        : err?.message || 'We could not complete your booking. Please try again.';

      setError(message);
    } finally {
      setBooking(false);
    }
  };

  if (!selectedVehicle) {
    return (
      <section className="page-shell text-center">
        <h1 className="text-3xl font-bold text-slate-900">Booking</h1>
        <p className="mt-4 text-slate-600">Please choose a vehicle from the services page to continue.</p>
        <button type="button" onClick={() => navigate('/services')} className="primary-btn mt-6">
          View vehicles
        </button>
      </section>
    );
  }

  if (confirmedBooking) {
    return (
      <section className="flex justify-center">
        <div className="w-full max-w-2xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Confirmed</p>
              <h1 className="mt-3 text-3xl font-bold text-slate-900">Booking ticket</h1>
            </div>
            <button type="button" onClick={() => navigate('/my-bookings')} className="secondary-btn px-4 py-2.5 text-sm">
              View bookings
            </button>
          </div>

          <BookingTicket
            booking={confirmedBooking}
            vehicleModel={confirmedBooking.vehicleModel}
            renterAddress={confirmedBooking.userWalletAddress}
            txHash={confirmedBooking.txHash}
            numDays={confirmedBooking.numDays}
            startDate={confirmedBooking.startDate}
            pickupLocation={confirmedBooking.pickupLocation}
            dropLocation={confirmedBooking.dropLocation}
            pickupDateTime={confirmedBooking.pickupDateTime}
            expectedDropDateTime={confirmedBooking.expectedDropDateTime}
            vehicleImage={selectedVehicle.imageUrl}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="flex justify-center">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-soft">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Reserve your ride</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">Booking</h1>
        </div>

        <div className="mb-6 rounded-2xl border border-brand/10 bg-brand/5 p-4">
          <p className="text-sm text-slate-500">Selected vehicle</p>
          <div className="mt-2 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{selectedVehicle.model}</h2>
              <div className="mt-1">
                <p className="text-lg font-bold text-slate-900">{selectedVehiclePriceDisplay.inrValue} / day</p>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleConfirmBooking} className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-700">
              Number of rental days
              <input
                type="number"
                min="1"
                step="1"
                value={days}
                onChange={(event) => setDays(Math.max(1, Number(event.target.value) || 1))}
                className="input-field"
              />
            </label>
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-700">
              Pickup location
              <select
                value={pickupLocation}
                onChange={(event) => setPickupLocation(event.target.value)}
                className="input-field"
              >
                {THANE_LOCATION_OPTIONS.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-700">
              Drop location
              <select
                value={dropLocation}
                onChange={(event) => setDropLocation(event.target.value)}
                className="input-field"
              >
                {THANE_LOCATION_OPTIONS.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Pickup date & time
              <input
                type="datetime-local"
                value={pickupDateTime}
                onChange={(event) => setPickupDateTime(event.target.value)}
                className="input-field"
              />
            </label>
          </div>

          <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Expected drop-off window</p>
            <p className="mt-2 text-base font-semibold text-slate-900">
              {(() => {
                if (!pickupDateTime) {
                  return 'Choose a pickup date and time to preview the expected drop-off window.';
                }

                const pickupMoment = new Date(pickupDateTime);
                if (Number.isNaN(pickupMoment.getTime())) {
                  return 'Choose a valid pickup date and time.';
                }

                const safeDaysValue = Math.max(1, Number(days) || 1);
                const deadline = new Date(pickupMoment.getTime() + safeDaysValue * 24 * 60 * 60 * 1000);
                const windowStart = new Date(deadline.getTime() - 2.5 * 60 * 60 * 1000);

                const dateLabel = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(deadline);
                const startLabel = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(windowStart);
                const endLabel = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(deadline);
                return `Expected drop-off: ${dateLabel}, between ${startLabel} and ${endLabel}`;
              })()}
            </p>
          </div>

          <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Total</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{totalPriceDisplay.inrValue}</p>
            <p className="mt-1 text-sm text-slate-600">Includes {formatInrFromEth(depositEth)} deposit</p>
          </div>

          {error && <p className="form-error md:col-span-2">{error}</p>}

          <div className="md:col-span-2">
            <button type="submit" disabled={booking} className="primary-btn w-full">
              {booking ? 'Confirming booking...' : 'Confirm Booking'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
