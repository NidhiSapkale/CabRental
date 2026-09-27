import { NavLink, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { fetchEthToInrRate } from './priceUtils';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import RidePage from './pages/RidePage';
import BookingPage from './pages/BookingPage';
import ServicesPage from './pages/ServicesPage';
import MyBookingsPage from './pages/MyBookingsPage';
import MyVehiclesPage from './pages/MyVehiclesPage';
import ListVehiclePage from './pages/ListVehiclePage';
import AboutPage from './pages/AboutPage';
import ReviewsPage from './pages/ReviewsPage';
import ContactPage from './pages/ContactPage';

const baseNavItems = [
  { to: '/', label: 'Home' },
  { to: '/services', label: 'Services' },
  { to: '/about', label: 'About' },
  { to: '/reviews', label: 'Reviews' },
  { to: '/contact', label: 'Contact' },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });

    fetchEthToInrRate();

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const syncWalletState = async () => {
      if (typeof window === 'undefined' || !window.ethereum) {
        setWalletConnected(false);
        return;
      }

      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        setWalletConnected(Array.isArray(accounts) && accounts.length > 0);
      } catch (error) {
        setWalletConnected(false);
      }
    };

    syncWalletState();

    if (window.ethereum && window.ethereum.on) {
      const handleAccountsChanged = (accounts) => setWalletConnected(Array.isArray(accounts) && accounts.length > 0);
      window.ethereum.on('accountsChanged', handleAccountsChanged);

      return () => {
        window.ethereum.removeListener?.('accountsChanged', handleAccountsChanged);
      };
    }
  }, []);

  const visibleNavItems = [
    ...baseNavItems,
    ...(user ? [{ to: '/my-bookings', label: 'My Bookings' }] : []),
    ...(walletConnected ? [{ to: '/list-vehicle', label: 'List Your Vehicle' }] : []),
    ...(walletConnected ? [{ to: '/my-vehicles', label: 'My Vehicles' }] : []),
  ];

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign-out failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#FAF7F0]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-lg font-bold text-white shadow-sm">
              C
            </div>
            <span className="text-lg font-semibold tracking-tight text-slate-900">CabRental</span>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-full px-3 py-2 text-sm font-medium transition duration-200 ${
                    isActive
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-slate-700 hover:bg-slate-200/80 hover:text-slate-900'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {authReady && user ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Sign out
              </button>
            ) : (
              <>
                <NavLink to="/login" className="primary-btn px-4 py-2.5 text-xs sm:text-sm">
                  Login
                </NavLink>
                <NavLink
                  to="/signup"
                  className="rounded-full border border-brand/20 bg-brand/5 px-4 py-2.5 text-xs font-semibold text-brand hover:bg-brand hover:text-white sm:text-sm"
                >
                  Sign Up
                </NavLink>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Routes>
          <Route path="/" element={<HomePage user={user} />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/ride" element={<RidePage />} />
          <Route path="/booking" element={<BookingPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/list-vehicle" element={<ListVehiclePage />} />
          <Route path="/my-vehicles" element={<MyVehiclesPage />} />
          <Route path="/my-bookings" element={<MyBookingsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Routes>
      </main>
    </div>
  );
}
