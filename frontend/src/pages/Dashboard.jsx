import { Link } from 'react-router-dom';
import api from '../services/api';
import useFetch from '../hooks/useFetch';
import useLiveEvents from '../hooks/useLiveEvents';
import { who } from '../services/utils';
import { Spinner, ErrorBox } from '../components/ui';

const Stat = ({ label, value }) => (
  <div className="rounded border bg-white p-4"><p className="text-sm text-gray-500">{label}</p><p className="text-2xl font-bold">{value}</p></div>
);

export default function Dashboard() {
  const { data, loading, error, reload } = useFetch(() => api.get('/dashboard/').then((r) => r.data), 'dashboard');
  useLiveEvents(() => reload(true), () => reload(true));

  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorBox message={error} onRetry={reload} />;
  const bp = data.busiest_project;
  const s = data.tasks_by_status;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Projects" value={data.project_count} />
        <Stat label="To Do (mine)" value={s.todo} />
        <Stat label="In Progress (mine)" value={s.in_progress} />
        <Stat label="Done (mine)" value={s.done} />
        <Stat label="Completed this week" value={data.completed_this_week} />
        <div className="rounded border bg-white p-4">
          <p className="text-sm text-gray-500">Most open tasks</p>
          {bp ? <Link to={`/projects/${bp.id}`} className="font-semibold text-blue-600">{bp.title ?? bp.name} ({bp.open_tasks})</Link>
              : <p className="text-gray-400">None</p>}
        </div>
      </div>
      <div className="rounded border bg-white p-4">
        <h2 className="mb-2 font-semibold">My recent activity</h2>
        {data.recent_activity.length === 0 && <p className="text-gray-500">No activity yet.</p>}
        <ul className="space-y-1 text-sm">
          {data.recent_activity.map((a) => (
            <li key={a.id}>{who(a.actor)} {a.description}
              <span className="ml-2 text-xs text-gray-400">{new Date(a.created_at).toLocaleString()}</span></li>
          ))}
        </ul>
      </div>
    </div>
  );
}