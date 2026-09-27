import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { ethers } from 'ethers';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { ensureSepoliaNetwork, getContract, CONTRACT_ABI, CONTRACT_ADDRESS } from '../contract';
import { formatInrFromEth } from '../priceUtils';
import BookingTicket from '../components/BookingTicket';

function formatExpectedReturn(unixTimestamp) {
  if (!Number.isFinite(Number(unixTimestamp)) || Number(unixTimestamp) <= 0) {
    return 'Not available';
  }

  return new Date(Number(unixTimestamp) * 1000).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function buildPenaltySummary(penaltyWei) {
  const penaltyEth = Number(ethers.formatEther(penaltyWei ?? 0n));
  return {
    penaltyEth,
    penaltyInr: formatInrFromEth(penaltyEth),
  };
}

export default function MyBookingsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(auth.currentUser);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState(null);
  const [ratingDrafts, setRatingDrafts] = useState({});
  const [ratingId, setRatingId] = useState(null);
  const [returnConfirmation, setReturnConfirmation] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      navigate('/login', { state: { from: '/my-bookings' } });
      return;
    }

    const fetchBookings = async () => {
      try {
        setLoading(true);
        setError('');

        const q = query(collection(db, 'bookings'), where('userId', '==', user.uid));
        const snapshot = await getDocs(q);

        let contract = null;
        if (typeof window !== 'undefined' && window.ethereum) {
          const provider = new ethers.BrowserProvider(window.ethereum);
          contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
        }

        const userBookings = (await Promise.all(
          snapshot.docs.map(async (document) => {
            const booking = { id: document.id, ...document.data() };

            let ownerAddress = booking.ownerAddress || null;
            if (booking.vehicleId) {
              const vehicleDoc = await getDoc(doc(db, 'vehicles', booking.vehicleId));
              if (vehicleDoc.exists()) {
                ownerAddress = vehicleDoc.data().ownerAddress || ownerAddress;
              }
            }

            let liveTotalCost = Number(booking.totalCost) || 0;
            let expectedReturnTime = null;
            let expectedReturnDate = null;
            let penaltyWei = 0n;

            if (contract && Number.isFinite(Number(booking.onChainId))) {
              try {
                const vehicleDetails = await contract.getVehicle(Number(booking.onChainId));
                const pricePerDay = Number(ethers.formatEther(vehicleDetails[2]));
                const deposit = Number(ethers.formatEther(vehicleDetails[3]));
                liveTotalCost = (pricePerDay * Number(booking.numDays || 1)) + deposit;

                const rental = await contract.getRental(Number(booking.onChainId));
                expectedReturnTime = Number(rental[2] ?? 0);
                expectedReturnDate = expectedReturnTime > 0 ? new Date(expectedReturnTime * 1000) : null;
                penaltyWei = await contract.calculatePenalty(Number(booking.onChainId));
              } catch (contractError) {
                console.error('Unable to read on-chain status for booking', booking.id, contractError);
              }
            }

            const penaltySummary = buildPenaltySummary(penaltyWei);
            const isOverdue = Boolean(
              expectedReturnTime &&
              expectedReturnTime > 0 &&
              Date.now() > expectedReturnTime * 1000 &&
              penaltySummary.penaltyEth > 0
            );

            return {
              ...booking,
              ownerAddress,
              liveTotalCost,
              expectedReturnTime,
              expectedReturnDate,
              penaltyWei,
              penaltyInr: penaltySummary.penaltyInr,
              penaltyEth: penaltySummary.penaltyEth,
              isOverdue,
            };
          })
        )).sort((a, b) => {
          const aTime = a.createdAt?.seconds ?? 0;
          const bTime = b.createdAt?.seconds ?? 0;
          return bTime - aTime;
        });

        setBookings(userBookings);
      } catch (err) {
        console.error('MyBookings fetch failed:', err);
        setError(err?.message || 'Unable to load your bookings right now. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
    const refreshInterval = window.setInterval(fetchBookings, 30000);

    return () => window.clearInterval(refreshInterval);
  }, [navigate, user]);

  const handleReturnVehicle = async (booking) => {
    if (!booking || !booking.vehicleId) {
      setError('This booking is missing vehicle details. Please refresh and try again.');
      return;
    }

    try {
      setActionId(booking.id);
      setError('');
      setReturnConfirmation('');

      const vehicleIdAsNumber = Number(booking.onChainId ?? booking.vehicleId);
      if (!Number.isFinite(vehicleIdAsNumber)) {
        throw new Error('This booking is missing a valid on-chain vehicle ID.');
      }

      await ensureSepoliaNetwork();
      const contract = await getContract();
      const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
      const connectedWallet = (await signer.getAddress()).toLowerCase();
      const rental = await contract.getRental(vehicleIdAsNumber);
      const onChainRenter = (rental?.[0] || '').toLowerCase();

      if (connectedWallet !== onChainRenter) {
        const expectedAddress = rental?.[0] || 'unknown';
        setError(
          `This vehicle was rented using a different wallet address (${expectedAddress}). Please switch to that account in MetaMask to return it.`
        );
        return;
      }

      const vehicleDetails = await contract.getVehicle(vehicleIdAsNumber);
      const depositWei = vehicleDetails[3];
      const tx = await contract.returnVehicle(vehicleIdAsNumber);
      const receipt = await tx.wait();

      const returnedEvent = receipt.logs
        .map((log) => {
          try {
            return contract.interface.parseLog(log);
          } catch (parseError) {
            return null;
          }
        })
        .find((parsedLog) => parsedLog && parsedLog.name === 'VehicleReturned');

      const penaltyAppliedWei = returnedEvent?.args?.[3] ?? 0n;
      const penaltyAppliedEth = Number(ethers.formatEther(penaltyAppliedWei));
      const remainingDepositWei = depositWei > penaltyAppliedWei ? depositWei - penaltyAppliedWei : 0n;
      const remainingDepositEth = Number(ethers.formatEther(remainingDepositWei));
      const actualReturnTime = Number(rental[3] ?? 0n) || Math.floor(Date.now() / 1000);

      setReturnConfirmation(
        `Vehicle returned. Penalty applied: ${formatInrFromEth(penaltyAppliedEth)}. Remaining deposit refunded: ${formatInrFromEth(remainingDepositEth)}.`
      );

      await runTransaction(db, async (transaction) => {
        const bookingRef = doc(db, 'bookings', booking.id);
        const vehicleRef = doc(db, 'vehicles', booking.vehicleId);

        const bookingSnapshot = await transaction.get(bookingRef);
        if (!bookingSnapshot.exists()) {
          throw new Error('This booking could not be found.');
        }

        const vehicleSnapshot = await transaction.get(vehicleRef);
        if (!vehicleSnapshot.exists()) {
          throw new Error('The vehicle record is missing. Please contact support.');
        }

        transaction.update(bookingRef, {
          isActive: false,
          actualDropDateTime: new Date(actualReturnTime * 1000).toISOString(),
        });
        transaction.update(vehicleRef, { isAvailable: true });
      });

      setBookings((currentBookings) => currentBookings.map((item) => {
        if (item.id !== booking.id) {
          return item;
        }

        return { ...item, isActive: false, actualDropDateTime: new Date(actualReturnTime * 1000).toISOString() };
      }));
    } catch (err) {
      const message = err?.code === 4001 || err?.message?.includes('rejected')
        ? 'MetaMask transaction was cancelled. The vehicle was not returned.'
        : err?.message || 'We could not return this vehicle. Please try again.';
      setError(message);
    } finally {
      setActionId(null);
    }
  };

  const handleRateRental = async (booking) => {
    if (!booking?.ownerAddress) {
      setError('This booking is missing the vehicle owner address, so it cannot be rated yet.');
      return;
    }

    const score = Number(ratingDrafts[booking.id]);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      setError('Please choose a valid rating between 1 and 5.');
      return;
    }

    try {
      setRatingId(booking.id);
      setError('');

      await ensureSepoliaNetwork();
      const contract = await getContract();
      const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
      const connectedWallet = (await signer.getAddress()).toLowerCase();
      const targetOwnerAddress = (booking.ownerAddress || '').toLowerCase();

      if (connectedWallet === targetOwnerAddress) {
        setError('You cannot rate your own booking owner address. Please switch to the renter wallet before rating.');
        return;
      }

      const tx = await contract.rateUser(booking.ownerAddress, score);
      await tx.wait();

      await updateDoc(doc(db, 'bookings', booking.id), {
        renterHasRated: true,
        renterRating: score,
        renterRatedAt: serverTimestamp(),
      });

      setBookings((currentBookings) => currentBookings.map((item) => {
        if (item.id !== booking.id) {
          return item;
        }

        return { ...item, renterHasRated: true, renterRating: score };
      }));
    } catch (err) {
      const message = err?.code === 4001 || err?.message?.includes('rejected')
        ? 'MetaMask transaction was cancelled. No rating was submitted.'
        : err?.message || 'We could not submit your rating. Please try again.';
      setError(message);
    } finally {
      setRatingId(null);
    }
  };

  if (!user) {
    return null;
  }

  const activeBookings = bookings.filter((booking) => booking.isActive !== false);
  const completedBookings = bookings.filter((booking) => booking.isActive === false);

  return (
    <section className="page-shell">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Trips</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">My Bookings</h1>
        </div>
      </div>

      {loading && <p className="text-slate-600">Loading your bookings...</p>}
      {error && <p className="form-error">{error}</p>}
      {returnConfirmation && (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {returnConfirmation}
        </div>
      )}

      {!loading && bookings.length === 0 && !error && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-lg font-semibold text-slate-800">No bookings yet.</p>
          <p className="mt-2 text-slate-600">Book a vehicle from the services page to get started.</p>
        </div>
      )}

      <div className="space-y-6">
        {activeBookings.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">Active bookings</h2>
            {activeBookings.map((booking) => (
              <div key={booking.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <p className="text-xl font-semibold text-slate-900">{booking.vehicleModel}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {booking.numDays} day{booking.numDays > 1 ? 's' : ''}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleReturnVehicle(booking)}
                    disabled={actionId === booking.id}
                    className="primary-btn px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {actionId === booking.id ? 'Processing...' : 'Return Vehicle'}
                  </button>
                </div>

                <div className="space-y-2 text-sm text-slate-700">
                  <p>
                    <span className="font-medium">Expected return:</span>{' '}
                    {formatExpectedReturn(booking.expectedReturnTime)}
                  </p>
                  <p>
                    <span className="font-medium">Current penalty if returned now:</span>{' '}
                    {booking.penaltyInr || '₹0'}
                  </p>
                </div>

                {booking.isOverdue && (
                  <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                    This rental is overdue — a penalty will be deducted from your deposit upon return.
                  </p>
                )}

                <div className="mt-4">
                  <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 md:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Pickup</p>
                      <p className="mt-1 font-medium text-slate-800">{booking.pickupLocation || 'Not provided'}</p>
                      <p className="mt-1 text-slate-600">{booking.pickupDateTime ? new Date(booking.pickupDateTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not available'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Drop</p>
                      <p className="mt-1 font-medium text-slate-800">{booking.dropLocation || 'Not provided'}</p>
                      <p className="mt-1 text-slate-600">{booking.dropDateTime ? new Date(booking.dropDateTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not available'}</p>
                    </div>
                  </div>

                  <BookingTicket
                    booking={booking}
                    vehicleModel={booking.vehicleModel}
                    renterAddress={booking.userWalletAddress || user?.uid || 'Unknown wallet'}
                    txHash={booking.txHash}
                    numDays={booking.numDays}
                    startDate={booking.startDate}
                    pickupLocation={booking.pickupLocation}
                    dropLocation={booking.dropLocation}
                    pickupDateTime={booking.pickupDateTime}
                    expectedDropDateTime={booking.expectedDropDateTime ?? (booking.expectedReturnTime ? new Date(booking.expectedReturnTime * 1000).toISOString() : null)}
                    actualDropDateTime={booking.actualDropDateTime}
                    vehicleImage={booking.vehicleImage}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {completedBookings.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">Completed rentals</h2>
            {completedBookings.map((booking) => (
              <div key={booking.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
                <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 md:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Pickup</p>
                    <p className="mt-1 font-medium text-slate-800">{booking.pickupLocation || 'Not provided'}</p>
                    <p className="mt-1 text-slate-600">{booking.pickupDateTime ? new Date(booking.pickupDateTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not available'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Drop</p>
                    <p className="mt-1 font-medium text-slate-800">{booking.dropLocation || 'Not provided'}</p>
                    <p className="mt-1 text-slate-600">{booking.dropDateTime ? new Date(booking.dropDateTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not available'}</p>
                  </div>
                </div>

                <BookingTicket
                  booking={booking}
                  vehicleModel={booking.vehicleModel}
                  renterAddress={booking.userWalletAddress || user?.uid || 'Unknown wallet'}
                  txHash={booking.txHash}
                  numDays={booking.numDays}
                  startDate={booking.startDate}
                  pickupLocation={booking.pickupLocation}
                  dropLocation={booking.dropLocation}
                  pickupDateTime={booking.pickupDateTime}
                  expectedDropDateTime={booking.expectedDropDateTime ?? (booking.expectedReturnTime ? new Date(booking.expectedReturnTime * 1000).toISOString() : null)}
                  actualDropDateTime={booking.actualDropDateTime}
                  vehicleImage={booking.vehicleImage}
                />

                {booking.renterHasRated ? (
                  <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                    You already submitted a rating for this rental.
                  </p>
                ) : (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-800">Rate this rental</p>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                      <label className="flex-1 text-sm font-medium text-slate-700">
                        Rating (1–5)
                        <input
                          type="number"
                          min="1"
                          max="5"
                          step="1"
                          value={ratingDrafts[booking.id] ?? ''}
                          onChange={(event) => setRatingDrafts((current) => ({
                            ...current,
                            [booking.id]: event.target.value,
                          }))}
                          className="input-field"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => handleRateRental(booking)}
                        disabled={ratingId === booking.id}
                        className="primary-btn px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {ratingId === booking.id ? 'Submitting...' : 'Submit rating'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
