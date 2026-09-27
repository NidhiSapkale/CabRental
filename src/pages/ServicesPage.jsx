import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Contract, ethers } from 'ethers';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../contract';
import { getEthPriceDisplay } from '../priceUtils';

const SEPOLIA_RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';

function VehicleImage({ src, alt, className = '' }) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 text-4xl text-slate-600 ${className}`}>
        🚗
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      className={className}
    />
  );
}

export default function ServicesPage() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const q = query(collection(db, 'vehicles'), where('isAvailable', '==', true));
        const snapshot = await getDocs(q);

        const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
        const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

        const vehicleList = await Promise.all(
          snapshot.docs.map(async (document) => {
            const data = document.data();
            const onChainId = Number(data.onChainId);
            let pricePerDay = 0.001;
            let deposit = 0.0005;

            if (Number.isFinite(onChainId)) {
              try {
                const vehicleDetails = await contract.getVehicle(onChainId);
                pricePerDay = Number(ethers.formatEther(vehicleDetails[2]));
                deposit = Number(ethers.formatEther(vehicleDetails[3]));
              } catch (contractError) {
                console.warn('Unable to read on-chain pricing for vehicle', onChainId, contractError);
              }
            }

            return {
              id: document.id,
              onChainId,
              ...data,
              pricePerDay,
              deposit,
            };
          })
        );

        setVehicles(vehicleList);
      } catch (err) {
        setError('Unable to load vehicles right now. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchVehicles();
  }, []);

  const handleVehicleSelect = (vehicle) => {
    navigate('/booking', {
      state: {
        selectedVehicle: {
          id: vehicle.id,
          onChainId: Number(vehicle.onChainId),
          model: vehicle.model,
          imageUrl: vehicle.imageUrl || '',
          pricePerDay: Number(vehicle.pricePerDay) || 0.001,
          deposit: Number(vehicle.deposit) || 0.0005,
        },
      },
    });
  };

  return (
    <section className="page-shell">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Fleet</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">Services</h1>
      </div>

      {loading && <p className="text-slate-600">Loading vehicles...</p>}
      {error && <p className="form-error">{error}</p>}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {vehicles.map((vehicle) => {
          const displayPrice = getEthPriceDisplay(Number(vehicle.pricePerDay) || 0.001);

          return (
            <div
              key={vehicle.id}
              role="button"
              tabIndex={0}
              onClick={() => handleVehicleSelect(vehicle)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleVehicleSelect(vehicle);
                }
              }}
              className="group cursor-pointer overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft transition duration-200 hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-brand/10"
            >
              <VehicleImage src={vehicle.imageUrl} alt={vehicle.model} className="h-52 w-full object-cover" />
              <div className="p-5">
                <h3 className="text-xl font-semibold text-slate-900">{vehicle.model}</h3>
                <p className="mt-2 text-sm text-slate-600">Premium everyday transport</p>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xl font-bold text-slate-900">{displayPrice.inrValue}</div>
                  </div>
                  <button type="button" className="primary-btn px-4 py-2.5 text-sm">
                    Book Now
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
