import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Check your credentials.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-sm mx-auto mt-20 space-y-4">
      <h1 className="text-2xl font-semibold">Log in</h1>
      <input
        type="email" required placeholder="Email"
        className="w-full border rounded px-3 py-2"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      <input
        type="password" required placeholder="Password"
        className="w-full border rounded px-3 py-2"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit" disabled={loading}
        className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-50"
      >
        {loading ? 'Logging in…' : 'Log in'}
      </button>
      <p className="text-sm">No account? <Link to="/register" className="text-blue-600">Sign up</Link></p>
    </form>
  );
}