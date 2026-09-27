import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { addDoc, collection } from 'firebase/firestore';
import { ethers } from 'ethers';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { ensureSepoliaNetwork, getContract } from '../contract';
import { getEthPriceDisplay } from '../priceUtils';

const MAX_COMPRESSED_DATA_URL_LENGTH = 700 * 1024;

function compressVehicleImageToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve('');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const image = new Image();
      image.onload = () => {
        const maxWidth = 600;
        const scaleFactor = Math.min(1, maxWidth / image.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scaleFactor));
        canvas.height = Math.max(1, Math.round(image.height * scaleFactor));

        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(dataUrl);
      };
      image.onerror = () => reject(new Error('Unable to read the selected image. Please try a different file.'));
      image.src = event.target.result;
    };
    reader.onerror = () => reject(new Error('Unable to process the selected image. Please try another file.'));
    reader.readAsDataURL(file);
  });
}

export default function ListVehiclePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(auth.currentUser);
  const [form, setForm] = useState({
    model: '',
    pricePerDay: '0.001',
    deposit: '0.0005',
  });
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const dailyPriceDisplay = getEthPriceDisplay(Number(form.pricePerDay) || 0);
  const depositDisplay = getEthPriceDisplay(Number(form.deposit) || 0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      navigate('/login', { state: { from: '/list-vehicle' } });
      return;
    }

    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.request({ method: 'eth_accounts' }).then((accounts) => {
        if (!accounts || accounts.length === 0) {
          navigate('/services');
        }
      });
    }
  }, [navigate, user]);

  const handleImageSelection = async (event) => {
    const selectedFile = event.target.files?.[0] || null;
    setError('');
    setSuccess('');

    if (!selectedFile) {
      setImageDataUrl('');
      return;
    }

    try {
      const compressedDataUrl = await compressVehicleImageToDataUrl(selectedFile);
      const compressedSize = compressedDataUrl.length;

      if (compressedSize > MAX_COMPRESSED_DATA_URL_LENGTH) {
        setImageDataUrl('');
        setError(
          `This image is still too large after compression (${Math.round(compressedSize / 1024)} KB). Please choose a smaller or simpler image before listing the vehicle.`
        );
        event.target.value = '';
        return;
      }

      setImageDataUrl(compressedDataUrl);
    } catch (err) {
      setError(err?.message || 'Unable to process the selected image. Please try another file.');
      setImageDataUrl('');
      event.target.value = '';
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const model = form.model.trim();
    const pricePerDay = Number(form.pricePerDay);
    const deposit = Number(form.deposit);

    if (!model) {
      setError('Please enter a vehicle model.');
      return;
    }

    if (!Number.isFinite(pricePerDay) || pricePerDay <= 0) {
      setError('Please enter a valid price per day greater than zero.');
      return;
    }

    if (!Number.isFinite(deposit) || deposit <= 0) {
      setError('Please enter a valid deposit greater than zero.');
      return;
    }

    try {
      setLoading(true);

      await ensureSepoliaNetwork();
      const contract = await getContract();
      const signer = await new ethers.BrowserProvider(window.ethereum).getSigner();
      const ownerAddress = (await signer.getAddress()).toLowerCase();

      const tx = await contract.listVehicle(
        model,
        ethers.parseEther(pricePerDay.toString()),
        ethers.parseEther(deposit.toString()),
      );

      await tx.wait();

      const onChainId = Number(await contract.vehicleCount());

      await addDoc(collection(db, 'vehicles'), {
        model,
        imageUrl: imageDataUrl,
        isAvailable: true,
        onChainId,
        ownerAddress,
      });

      setSuccess(`Vehicle listed successfully. On-chain ID: ${onChainId}`);
      setForm({ model: '', pricePerDay: '0.001', deposit: '0.0005' });
      setImageDataUrl('');
      const imageInput = document.getElementById('vehicle-image');
      if (imageInput) {
        imageInput.value = '';
      }
    } catch (err) {
      const message = err?.code === 4001 || err?.message?.includes('rejected')
        ? 'MetaMask transaction was cancelled. No vehicle was listed.'
        : err?.message || 'Unable to list your vehicle right now. Please try again.';

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <section className="flex justify-center">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-soft">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">List vehicle</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">List Your Vehicle</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-sm font-medium text-slate-700">
              Model
              <input
                type="text"
                value={form.model}
                onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
                className="input-field"
                placeholder="Honda Civic"
              />
            </label>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Price per day
              <input
                type="number"
                min="0.0001"
                step="0.0001"
                value={form.pricePerDay}
                onChange={(event) => setForm((current) => ({ ...current, pricePerDay: event.target.value }))}
                className="input-field"
              />
            </label>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Deposit
              <input
                type="number"
                min="0.0001"
                step="0.0001"
                value={form.deposit}
                onChange={(event) => setForm((current) => ({ ...current, deposit: event.target.value }))}
                className="input-field"
              />
            </label>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Vehicle photo
              <input
                id="vehicle-image"
                type="file"
                accept="image/*"
                onChange={handleImageSelection}
                className="input-field file:mr-4 file:rounded-full file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Estimated pricing</p>
            <div className="mt-2 flex flex-col gap-2">
              <div>
                <p className="text-lg font-bold text-slate-900">{dailyPriceDisplay.inrValue} / day</p>
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900">Deposit: {depositDisplay.inrValue}</p>
              </div>
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}
          {success && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{success}</p>}

          <button type="submit" disabled={loading} className="primary-btn w-full">
            {loading ? 'Listing vehicle...' : 'List Vehicle'}
          </button>
        </form>
      </div>
    </section>
  );
}
