import { Link } from 'react-router-dom';
import api from '../services/api';
import useFetch from '../hooks/useFetch';
import useLiveEvents from '../hooks/useLiveEvents';
import { Spinner, ErrorBox } from '../components/ui';

const list = (d) => (Array.isArray(d) ? d : d?.results ?? []);

export default function AssignedToMe() {
  const { data, loading, error, reload } = useFetch(async () => {
    const [t, p] = await Promise.all([
      api.get('/tasks/assigned-to-me/', { params: { page_size: 100 } }),
      api.get('/projects/'),
    ]);
    const names = Object.fromEntries(list(p.data).map((x) => [x.id, x.title ?? x.name]));
    return list(t.data).map((task) => ({ ...task, projectName: names[task.project] ?? `Project ${task.project}` }));
  }, 'assigned-to-me');

  useLiveEvents(() => reload(true), () => reload(true));

  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorBox message={error} onRetry={reload} />;
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Assigned to me</h1>
      {data.length === 0 && <p className="text-gray-500">Nothing assigned to you right now.</p>}
      {data.map((t) => (
        <Link key={t.id} to={`/projects/${t.project}`} className="flex items-center justify-between rounded border bg-white p-3 hover:shadow">
          <span><span className="font-medium">{t.title}</span> <span className="text-sm text-gray-500">in {t.projectName}</span></span>
          <span className="text-sm text-gray-600">{t.status.replace('_', ' ')} · {t.priority}{t.due_date ? ` · due ${t.due_date}` : ''}</span>
        </Link>
      ))}
    </div>
  );
}