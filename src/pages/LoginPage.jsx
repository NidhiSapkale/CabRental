import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../firebase';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);

      const redirectTo = location.state?.from || '/';
      const selectedVehicle = location.state?.selectedVehicle || null;

      navigate(redirectTo, {
        state: selectedVehicle ? { selectedVehicle } : undefined,
      });
    } catch (err) {
      const message = err.code === 'auth/user-not-found'
        ? 'No account was found with that email.'
        : err.code === 'auth/wrong-password'
          ? 'Incorrect password. Please try again.'
          : err.code === 'auth/invalid-email'
            ? 'Please enter a valid email address.'
            : 'Unable to sign in. Please check your details and try again.';

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-soft">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Welcome back</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">Login</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-sm font-medium text-slate-700">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-field"
              />
            </label>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input-field"
              />
            </label>
          </div>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" disabled={loading} className="primary-btn w-full">
            {loading ? 'Signing in...' : 'Log In'}
          </button>
        </form>
      </div>
    </section>
  );
}
