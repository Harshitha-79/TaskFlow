import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import useFetch from '../hooks/useFetch';
import useLiveEvents from '../hooks/useLiveEvents';
import { toErrors } from '../services/utils';
import { Spinner, ErrorBox } from '../components/ui';

const list = (d) => (Array.isArray(d) ? d : d?.results ?? []);

export default function Projects() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useFetch(() => api.get('/projects/').then((r) => r.data), 'projects');
  const [form, setForm] = useState({ title: '', description: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useLiveEvents(() => reload(true), () => reload(true));

  const create = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setErrors({ title: 'Project title is required.' }); return; }
    setSaving(true); setErrors({});
    try {
      const { data: p } = await api.post('/projects/', form);
      navigate(`/projects/${p.id}`);
    } catch (err) { setErrors(toErrors(err)); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="space-y-2 rounded border bg-white p-4">
        <h2 className="font-semibold">New project</h2>
        <input className="w-full rounded border px-3 py-2" placeholder="Title" value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })} />
        {errors.title && <p className="text-sm text-red-600">{errors.title}</p>}
        <input className="w-full rounded border px-3 py-2" placeholder="Description (optional)" value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })} />
        {errors.form && <p className="text-sm text-red-600">{errors.form}</p>}
        <button disabled={saving} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
          {saving ? 'Creating…' : 'Create project'}
        </button>
      </form>

      {loading && !data ? <Spinner /> : error && !data ? <ErrorBox message={error} onRetry={reload} /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list(data).length === 0 && <p className="text-gray-500">No projects yet. Create one above.</p>}
          {list(data).map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`} className="block rounded border bg-white p-4 hover:shadow">
              <h3 className="font-semibold">{p.title ?? p.name}</h3>
              <p className="text-sm text-gray-500">{p.description}</p>
              <p className="mt-2 text-xs text-gray-400">{p.member_count ?? p.memberships?.length ?? 0} members</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}