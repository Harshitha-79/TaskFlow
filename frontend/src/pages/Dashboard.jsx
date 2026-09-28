import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-4">
        <h1 className="text-xl font-semibold">TaskFlow</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-stone-600">{user?.email}</span>
          <button type="button" onClick={handleLogout} className="rounded border border-stone-300 px-3 py-2 text-sm hover:bg-stone-100">
            Log out
          </button>
        </div>
      </header>
      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="text-2xl font-semibold">Your workspace</h2>
        <p className="mt-2 text-stone-600">You’re signed in. Your projects will appear here.</p>
      </section>
    </main>
  );
}