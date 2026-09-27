import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { ethers } from 'ethers';
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

function getBookingSortTimestamp(booking) {
  const candidates = [
    booking?.pickupDateTime,
    booking?.startDate,
    booking?.createdAt,
    booking?.expectedDropDateTime,
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    if (typeof candidate === 'number') {
      return candidate * 1000;
    }

    if (typeof candidate?.toDate === 'function') {
      return candidate.toDate().getTime();
    }

    if (typeof candidate?.seconds === 'number') {
      return candidate.seconds * 1000;
    }

    const parsed = new Date(candidate).getTime();
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

export default function MyVehiclesPage() {
  const [user, setUser] = useState(auth.currentUser);
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ratingDrafts, setRatingDrafts] = useState({});
  const [ratingId, setRatingId] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchMyVehicles = async () => {
      if (!user) {
        setVehicles([]);
        setBookings([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        if (typeof window === 'undefined' || !window.ethereum) {
          setVehicles([]);
          setBookings([]);
          setLoading(false);
          return;
        }

        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        const walletAddress = accounts?.[0];
        const normalizedWalletAddress = walletAddress?.toLowerCase();

        console.log('Connected wallet address:', walletAddress);

        if (!walletAddress) {
          setVehicles([]);
          setBookings([]);
          setLoading(false);
          return;
        }

        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

        const vehicleSnapshot = await getDocs(collection(db, 'vehicles'));
        console.log('Raw vehicle ownerAddress values:', vehicleSnapshot.docs.map((document) => ({
          id: document.id,
          ownerAddress: document.data().ownerAddress,
        })));

        const ownerVehicles = vehicleSnapshot.docs
          .filter((document) => {
            const storedOwnerAddress = (document.data().ownerAddress || '').toLowerCase();
            return storedOwnerAddress === normalizedWalletAddress;
          })
          .map((document) => ({
            id: document.id,
            ...document.data(),
          }));

        const bookingsSnapshot = await getDocs(collection(db, 'bookings'));
        const ownerBookings = await Promise.all(
          bookingsSnapshot.docs
            .map((document) => ({ id: document.id, ...document.data() }))
            .filter((booking) => {
              const matchesVehicleId = ownerVehicles.some((vehicle) => vehicle.id === booking.vehicleId);
              const matchesOnChainId = ownerVehicles.some((vehicle) => Number(vehicle.onChainId) === Number(booking.onChainId));
              return matchesVehicleId || matchesOnChainId;
            })
            .map(async (booking) => {
              let expectedReturnTime = null;
              let penaltyWei = 0n;

              if (Number.isFinite(Number(booking.onChainId))) {
                try {
                  const rental = await contract.getRental(Number(booking.onChainId));
                  expectedReturnTime = Number(rental[2] ?? 0);
                  penaltyWei = await contract.calculatePenalty(Number(booking.onChainId));
                } catch (contractError) {
                  console.warn('Unable to read on-chain rental status for booking', booking.id, contractError);
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
                expectedReturnTime,
                penaltyWei,
                penaltyInr: penaltySummary.penaltyInr,
                penaltyEth: penaltySummary.penaltyEth,
                isOverdue,
              };
            })
        );

        const sortedOwnerBookings = [...ownerBookings].sort((a, b) => {
          const aTimestamp = getBookingSortTimestamp(a);
          const bTimestamp = getBookingSortTimestamp(b);
          return bTimestamp - aTimestamp;
        });

        setVehicles(ownerVehicles);
        setBookings(sortedOwnerBookings);
      } catch (err) {
        setError('Unable to load your vehicles and bookings right now. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchMyVehicles();
    const refreshInterval = window.setInterval(fetchMyVehicles, 30000);

    return () => window.clearInterval(refreshInterval);
  }, [user]);

  const handleRateRenter = async (booking) => {
    const score = Number(ratingDrafts[booking.id]);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      setError('Please choose a valid rating between 1 and 5.');
      return;
    }

    if (!booking.userWalletAddress) {
      setError('This renter does not have a wallet address recorded, so they cannot be rated yet.');
      return;
    }

    try {
      setRatingId(booking.id);
      setError('');

      await ensureSepoliaNetwork();
      const contract = await getContract();
      const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
      const connectedWallet = (await signer.getAddress()).toLowerCase();
      const targetRenterAddress = (booking.userWalletAddress || '').toLowerCase();

      if (connectedWallet === targetRenterAddress) {
        setError('You cannot rate your own wallet address. Please switch to the owner wallet before rating the renter.');
        return;
      }

      const tx = await contract.rateUser(booking.userWalletAddress, score);
      await tx.wait();

      await updateDoc(doc(db, 'bookings', booking.id), {
        ownerHasRated: true,
        ownerRating: score,
        ownerRatedAt: serverTimestamp(),
      });

      setBookings((currentBookings) => currentBookings.map((item) => {
        if (item.id !== booking.id) {
          return item;
        }

        return { ...item, ownerHasRated: true, ownerRating: score };
      }));
    } catch (err) {
      const message = err?.code === 4001 || err?.message?.includes('rejected')
        ? 'MetaMask transaction was cancelled. No rating was submitted.'
        : err?.message || 'We could not submit the renter rating. Please try again.';
      setError(message);
    } finally {
      setRatingId(null);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <section className="page-shell">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Owners</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">My Vehicles</h1>
      </div>

      {loading && <p className="text-slate-600">Loading your vehicles...</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && vehicles.length === 0 && !error && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-lg font-semibold text-slate-800">No vehicles listed yet.</p>
          <p className="mt-2 text-slate-600">List a vehicle from your connected wallet to start receiving bookings.</p>
        </div>
      )}

      <div className="space-y-8">
        {vehicles.map((vehicle) => {
          const vehicleBookings = [...bookings]
            .filter((booking) => {
              const matchesVehicleId = booking.vehicleId === vehicle.id;
              const matchesOnChainId = Number(booking.onChainId) === Number(vehicle.onChainId);
              return matchesVehicleId || matchesOnChainId;
            })
            .sort((a, b) => {
              const aTimestamp = getBookingSortTimestamp(a);
              const bTimestamp = getBookingSortTimestamp(b);
              return bTimestamp - aTimestamp;
            });

          const completedBookings = vehicleBookings.filter((booking) => booking.isActive === false);

          return (
            <div key={vehicle.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">Vehicle</p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">{vehicle.model}</h2>
                </div>
              </div>

              {vehicleBookings.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  No bookings yet for this vehicle.
                </div>
              ) : (
                <div className="space-y-4">
                  {vehicleBookings.map((booking) => (
                    <div key={booking.id} className="space-y-4">
                      {booking.isActive !== false && (
                        <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                          <p>
                            <span className="font-medium">Expected return:</span>{' '}
                            {formatExpectedReturn(booking.expectedReturnTime)}
                          </p>
                          <p>
                            <span className="font-medium">Current penalty if returned now:</span>{' '}
                            {booking.penaltyInr || '₹0'}
                          </p>
                          {booking.isOverdue && (
                            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                              This rental is overdue — a penalty will be deducted from the renter deposit upon return.
                            </p>
                          )}
                        </div>
                      )}

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
                        vehicleModel={vehicle.model}
                        renterAddress={booking.userWalletAddress || booking.userEmail || 'Unknown wallet'}
                        txHash={booking.txHash}
                        numDays={booking.numDays}
                        startDate={booking.startDate}
                        pickupLocation={booking.pickupLocation}
                        dropLocation={booking.dropLocation}
                        pickupDateTime={booking.pickupDateTime}
                        expectedDropDateTime={booking.expectedDropDateTime ?? (booking.expectedReturnTime ? new Date(booking.expectedReturnTime * 1000).toISOString() : null)}
                        actualDropDateTime={booking.actualDropDateTime}
                        vehicleImage={booking.vehicleImage || vehicle.imageUrl}
                      />

                      {booking.isActive === false && booking.ownerHasRated ? (
                        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                          You already submitted a rating for this renter.
                        </p>
                      ) : booking.isActive === false ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-sm font-semibold text-slate-800">Rate this renter</p>
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
                              onClick={() => handleRateRenter(booking)}
                              disabled={ratingId === booking.id}
                              className="primary-btn px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              {ratingId === booking.id ? 'Submitting...' : 'Submit rating'}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}

                  {completedBookings.length === 0 && (
                    <p className="text-sm text-slate-600">No completed bookings yet for this vehicle.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
