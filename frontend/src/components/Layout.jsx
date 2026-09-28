import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { startSocket, stopSocket, onStatus } from '../services/socket';
import { who } from '../services/utils';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [live, setLive] = useState('offline');
  const [busy, setBusy] = useState(false);

  useEffect(() => { startSocket(); const off = onStatus(setLive); return () => { off(); stopSocket(); }; }, []);

  const link = ({ isActive }) => (isActive ? 'font-semibold text-blue-600' : 'text-gray-600 hover:text-gray-900');
  const doLogout = async () => { setBusy(true); try { await logout(); } finally { setBusy(false); navigate('/login'); } };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="flex items-center gap-6 border-b bg-white px-6 py-3">
        <span className="text-lg font-bold">TaskFlow</span>
        <NavLink to="/dashboard" className={link}>Dashboard</NavLink>
        <NavLink to="/projects" className={link}>Projects</NavLink>
        <NavLink to="/assigned" className={link}>Assigned to me</NavLink>
        <span className="ml-auto flex items-center gap-4 text-sm">
          <span className={live === 'live' ? 'text-green-600' : 'text-amber-600'}>
            ● {live === 'live' ? 'Live' : 'Reconnecting…'}
          </span>
          <span className="text-gray-600">{who(user)}</span>
          <button onClick={doLogout} disabled={busy} className="rounded border px-3 py-1 disabled:opacity-50">
            {busy ? 'Logging out…' : 'Log out'}
          </button>
        </span>
      </nav>
      <main className="mx-auto max-w-6xl p-6"><Outlet /></main>
    </div>
  );
}