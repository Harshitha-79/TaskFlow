import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import useFetch from '../hooks/useFetch';
import useLiveEvents from '../hooks/useLiveEvents';
import { errMsg, who } from '../services/utils';
import { Spinner, ErrorBox } from '../components/ui';
import TaskModal from '../components/TaskModal';

const COLUMNS = [['todo', 'To Do'], ['in_progress', 'In Progress'], ['done', 'Done']];
const BADGE = { high: 'bg-red-100 text-red-700', medium: 'bg-yellow-100 text-yellow-700', low: 'bg-green-100 text-green-700' };
const list = (d) => (Array.isArray(d) ? d : d?.results ?? []);
const PAGE_SIZE = 10;

export default function ProjectBoard() {
  const pid = Number(useParams().id);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('board');
  const [filters, setFilters] = useState({ priority: '', assignee: '', ordering: '-created_at' });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalId, setModalId] = useState(null); // null | 'new' | task id
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteErr, setInviteErr] = useState('');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const isList = tab === 'list';
  const project = useFetch(() => api.get(`/projects/${pid}/`).then((r) => r.data), `project:${pid}`);
  const taskQueryKey = JSON.stringify({ pid, page, isList, filters, search });
  const tasks = useFetch(() => api.get('/tasks/', {
    params: {
      project: pid, page, page_size: isList ? PAGE_SIZE : 100, ordering: filters.ordering,
      ...(filters.priority && { priority: filters.priority }),
      ...(filters.assignee && { assignee: filters.assignee }),
      ...(search && { search }),
    },
  }).then((r) => r.data), taskQueryKey);
  const activity = useFetch(() => api.get(`/projects/${pid}/activity/`).then((r) => r.data), `activity:${pid}`);

  useLiveEvents((m) => {
    if (m.project_id !== pid) return;
    if (m.event === 'project.deleted' || m.event === 'membership.revoked') { navigate('/projects'); return; }
    tasks.reload(true); activity.reload(true);
    if (m.event.startsWith('member.')) project.reload(true);
  }, () => { tasks.reload(true); project.reload(true); activity.reload(true); });

  if (project.loading && !project.data) return <Spinner />;
  if (project.error && !project.data) return <ErrorBox message={project.error} onRetry={project.reload} />;

  const taskList = list(tasks.data);
  const members = (project.data?.memberships ?? []).map((m) => m.user);
  const ownerId = project.data?.owner?.id ?? project.data?.owner;
  const isOwner = ownerId === user?.id;
  const selected = modalId && modalId !== 'new' ? taskList.find((t) => t.id === modalId) : null;
  const total = tasks.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const refresh = async () => { await Promise.all([tasks.reload(true), activity.reload(true)]); };
  const setFilter = (k) => (e) => { setFilters({ ...filters, [k]: e.target.value }); setPage(1); };

  const moveTask = async (task, status) => {
    setBusyId(task.id); setActionError('');
    try { await api.patch(`/tasks/${task.id}/`, { status }); await refresh(); }
    catch (e) { setActionError(errMsg(e)); } finally { setBusyId(null); }
  };

  const invite = async (e) => {
    e.preventDefault(); setInviting(true); setInviteErr('');
    try { await api.post(`/projects/${pid}/invite/`, { email: inviteEmail }); setInviteEmail(''); await Promise.all([project.reload(true), activity.reload(true)]); }
    catch (err) { setInviteErr(errMsg(err)); } finally { setInviting(false); }
  };

  const removeMember = async (uid) => {
    if (!window.confirm('Remove this member?')) return;
    setBusyId(`m${uid}`); setActionError('');
    try { await api.delete(`/projects/${pid}/members/${uid}/`); await Promise.all([project.reload(true), refresh()]); }
    catch (e) { setActionError(errMsg(e)); } finally { setBusyId(null); }
  };

  const deleteProject = async () => {
    if (!window.confirm('Delete this project and all its tasks?')) return;
    setBusyId('project'); setActionError('');
    try { await api.delete(`/projects/${pid}/`); navigate('/projects'); }
    catch (e) { setActionError(errMsg(e)); setBusyId(null); }
  };

  const sel = 'rounded border px-2 py-1';
  const TaskCard = ({ t }) => (
    <div className="space-y-2 rounded border bg-white p-3 shadow-sm">
      <button onClick={() => setModalId(t.id)} className="text-left font-medium hover:underline">{t.title}</button>
      <div className="flex items-center gap-2 text-xs">
        <span className={`rounded px-2 py-0.5 ${BADGE[t.priority]}`}>{t.priority}</span>
        {t.due_date && <span className="text-gray-500">due {t.due_date}</span>}
        <span className="ml-auto text-gray-600">{t.assignee ? who(t.assignee) : 'Unassigned'}</span>
      </div>
      <select className={`${sel} w-full text-sm`} value={t.status} disabled={busyId === t.id}
        onChange={(e) => moveTask(t, e.target.value)}>
        {COLUMNS.map(([v, l]) => <option key={v} value={v}>{busyId === t.id ? 'Moving…' : l}</option>)}
      </select>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{project.data.title ?? project.data.name}</h1>
        <button onClick={() => setModalId('new')} className="ml-auto rounded bg-blue-600 px-4 py-2 text-white">+ New task</button>
        {isOwner && (
          <button onClick={deleteProject} disabled={busyId === 'project'}
            className="rounded border border-red-300 px-3 py-2 text-red-600 disabled:opacity-50">
            {busyId === 'project' ? 'Deleting…' : 'Delete project'}
          </button>
        )}
      </div>

      <div className="flex gap-4 border-b">
        {[['board', 'Board'], ['list', 'List'], ['members', 'Members'], ['activity', 'Activity']].map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k); setPage(1); }}
            className={`pb-2 ${tab === k ? 'border-b-2 border-blue-600 font-semibold' : 'text-gray-500'}`}>{l}</button>
        ))}
      </div>

      {actionError && <div className="rounded border border-red-200 bg-red-50 p-3 text-red-700">{actionError}</div>}

      {(tab === 'board' || tab === 'list') && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input className={`${sel} w-56`} placeholder="Search title…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
            <select className={sel} value={filters.priority} onChange={setFilter('priority')}>
              <option value="">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
            </select>
            <select className={sel} value={filters.assignee} onChange={setFilter('assignee')}>
              <option value="">All assignees</option>
              {members.map((u) => <option key={u.id} value={u.id}>{who(u)}</option>)}
            </select>
            {tab === 'list' && (
              <select className={sel} value={filters.ordering} onChange={setFilter('ordering')}>
                <option value="-created_at">Newest first</option>
                <option value="created_at">Oldest first</option>
                <option value="due_date">Due date (soonest)</option>
                <option value="-priority_rank,due_date">Priority high → low, then due date</option>
                <option value="priority_rank,due_date">Priority low → high, then due date</option>
              </select>
            )}
            {tasks.loading && tasks.data && <span className="text-sm text-gray-400">Updating…</span>}
          </div>

          {tasks.loading && !tasks.data ? <Spinner /> : tasks.error && !tasks.data ? <ErrorBox message={tasks.error} onRetry={tasks.reload} /> : tab === 'board' ? (
            <div className="grid gap-4 md:grid-cols-3">
              {COLUMNS.map(([status, label]) => {
                const col = taskList.filter((t) => t.status === status);
                return (
                  <div key={status} className="space-y-2 rounded bg-gray-100 p-3">
                    <h3 className="font-semibold">{label} <span className="text-sm text-gray-500">({col.length})</span></h3>
                    {col.length === 0 && <p className="text-sm text-gray-400">No tasks</p>}
                    {col.map((t) => <TaskCard key={t.id} t={t} />)}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded border bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50"><tr><th className="p-2">Title</th><th>Status</th><th>Priority</th><th>Due</th><th>Assignee</th></tr></thead>
                  <tbody>
                    {taskList.length === 0 && <tr><td colSpan={5} className="p-4 text-gray-500">No tasks match.</td></tr>}
                    {taskList.map((t) => (
                      <tr key={t.id} className="cursor-pointer border-t hover:bg-gray-50" onClick={() => setModalId(t.id)}>
                        <td className="p-2 font-medium">{t.title}</td><td>{t.status.replace('_', ' ')}</td>
                        <td><span className={`rounded px-2 py-0.5 ${BADGE[t.priority]}`}>{t.priority}</span></td>
                        <td>{t.due_date ?? '—'}</td><td>{t.assignee ? who(t.assignee) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <button disabled={!tasks.data?.previous} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-40">Prev</button>
                <span>Page {page} of {pages} · {total} tasks</span>
                <button disabled={!tasks.data?.next} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'members' && (
        <div className="space-y-4">
          <ul className="divide-y rounded border bg-white">
            {(project.data.memberships ?? []).map((m) => (
              <li key={m.id} className="flex items-center gap-3 p-3">
                <span className="font-medium">{who(m.user)}</span>
                <span className="text-sm text-gray-500">{m.user.email}</span>
                <span className="rounded bg-gray-100 px-2 text-xs">{m.role}</span>
                {isOwner && m.user.id !== ownerId && (
                  <button onClick={() => removeMember(m.user.id)} disabled={busyId === `m${m.user.id}`}
                    className="ml-auto rounded border border-red-300 px-3 py-1 text-sm text-red-600 disabled:opacity-50">
                    {busyId === `m${m.user.id}` ? 'Removing…' : 'Remove'}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {isOwner ? (
            <form onSubmit={invite} className="space-y-2">
              <div className="flex gap-2">
                <input type="email" required className="w-72 rounded border px-3 py-2" placeholder="Invite by email"
                  value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                <button disabled={inviting} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
                  {inviting ? 'Inviting…' : 'Invite'}
                </button>
              </div>
              {inviteErr && <p className="text-sm text-red-600">{inviteErr}</p>}
            </form>
          ) : <p className="text-sm text-gray-500">Only the project owner can invite or remove members.</p>}
        </div>
      )}

      {tab === 'activity' && (
        activity.loading && !activity.data ? <Spinner /> : activity.error && !activity.data ? <ErrorBox message={activity.error} onRetry={activity.reload} /> : (
          <ul className="divide-y rounded border bg-white">
            {list(activity.data).length === 0 && <li className="p-3 text-gray-500">No activity yet.</li>}
            {list(activity.data).map((a) => (
              <li key={a.id} className="p-3 text-sm">
                <span className="font-medium">{who(a.actor)}</span> {a.description}
                <span className="ml-2 text-xs text-gray-400">{new Date(a.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )
      )}

      {(modalId === 'new' || selected) && (
        <TaskModal key={modalId} pid={pid} members={members} task={selected} onClose={() => setModalId(null)} onSaved={refresh} />
      )}
    </div>
  );
}