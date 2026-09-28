import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const passwordRule = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export default function Signup() {
  const { signup, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', name: '', password: '', password_confirm: '' });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email.';
    if (!passwordRule.test(form.password)) {
      errs.password = 'Min 8 chars, 1 uppercase, 1 number, 1 special character.';
    }
    if (form.password !== form.password_confirm) {
      errs.password_confirm = 'Passwords do not match.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      await signup({ email: form.email, name: form.name, password: form.password });
      navigate('/login');
    } catch (err) {
      const responseErrors = err.response?.data;
      setErrors({
        form: responseErrors?.email?.[0]
          || responseErrors?.name?.[0]
          || responseErrors?.password?.[0]
          || 'Signup failed.',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-sm mx-auto mt-20 space-y-4">
      <h1 className="text-2xl font-semibold">Sign up</h1>
      <input required placeholder="Name" className="w-full border rounded px-3 py-2"
        value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <div>
        <input type="email" required placeholder="Email" className="w-full border rounded px-3 py-2"
          value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        {errors.email && <p className="text-red-600 text-sm">{errors.email}</p>}
      </div>
      <div>
        <input type="password" required placeholder="Password" className="w-full border rounded px-3 py-2"
          value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {errors.password && <p className="text-red-600 text-sm">{errors.password}</p>}
      </div>
      <div>
        <input type="password" required placeholder="Confirm password" className="w-full border rounded px-3 py-2"
          value={form.password_confirm} onChange={(e) => setForm({ ...form, password_confirm: e.target.value })} />
        {errors.password_confirm && <p className="text-red-600 text-sm">{errors.password_confirm}</p>}
      </div>
      {errors.form && <p className="text-red-600 text-sm">{errors.form}</p>}
      <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white rounded py-2 disabled:opacity-50">
        {loading ? 'Creating account…' : 'Sign up'}
      </button>
      <p className="text-sm">Have an account? <Link to="/login" className="text-blue-600">Log in</Link></p>
    </form>
  );
}