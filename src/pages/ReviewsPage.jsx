import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../contract';

export default function ReviewsPage() {
  const [walletAddress, setWalletAddress] = useState('');
  const [averageRating, setAverageRating] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const syncRating = async () => {
      try {
        setLoading(true);

        if (typeof window === 'undefined' || !window.ethereum) {
          setWalletAddress('');
          setAverageRating(null);
          setLoading(false);
          return;
        }

        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (!Array.isArray(accounts) || accounts.length === 0) {
          setWalletAddress('');
          setAverageRating(null);
          setLoading(false);
          return;
        }

        const connectedAddress = accounts[0];
        setWalletAddress(connectedAddress);

        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
        const rating = await contract.getAverageRating(connectedAddress);
        setAverageRating(Number(rating));
      } catch (error) {
        setAverageRating(null);
      } finally {
        setLoading(false);
      }
    };

    syncRating();

    if (window.ethereum && window.ethereum.on) {
      const handleAccountsChanged = () => syncRating();
      window.ethereum.on('accountsChanged', handleAccountsChanged);

      return () => {
        window.ethereum.removeListener?.('accountsChanged', handleAccountsChanged);
      };
    }
  }, []);

  return (
    <section className="page-shell">
      <div className="max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Reviews</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">Your on-chain rating</h1>

        {loading ? (
          <p className="mt-5 text-slate-600">Loading your rating...</p>
        ) : !walletAddress ? (
          <p className="mt-5 text-slate-600">Please connect your wallet to view your rating.</p>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="text-lg font-semibold text-slate-800">
              {averageRating === null || averageRating === 0
                ? 'No rating recorded yet.'
                : `Your average rating: ${averageRating} / 5`}
            </p>
            <p className="text-sm text-slate-600">
              Ratings are given by renters and vehicle owners after each completed rental, and stored permanently on the blockchain — they cannot be edited or deleted by either party.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
