import { useState } from 'react';
import api from '../services/api';
import { errMsg, toErrors, who } from '../services/utils';

const today = () => new Date().toISOString().slice(0, 10);

const FieldError = ({ message }) => (
  message ? <p className="text-sm text-red-600">{message}</p> : null
);

export default function TaskModal({ pid, members, task, onClose, onSaved }) {
  const isNew = !task;
  const [form, setForm] = useState({
    title: task?.title ?? '', description: task?.description ?? '', status: task?.status ?? 'todo',
    priority: task?.priority ?? 'medium', due_date: task?.due_date ?? '', assignee_id: task?.assignee?.id ?? '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [comment, setComment] = useState('');
  const [commenting, setCommenting] = useState(false);
  const [commentError, setCommentError] = useState('');

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const local = {};
    if (!form.title.trim()) local.title = 'Title is required.';
    if (isNew && form.due_date && form.due_date < today()) local.due_date = 'Due date cannot be in the past.';
    if (Object.keys(local).length) { setErrors(local); return; }
    setSaving(true); setErrors({});
    const body = {
      title: form.title, description: form.description, status: form.status, priority: form.priority,
      due_date: form.due_date || null, assignee_id: form.assignee_id ? Number(form.assignee_id) : null,
    };
    try {
      if (isNew) await api.post('/tasks/', { ...body, project: pid });
      else await api.patch(`/tasks/${task.id}/`, body);
      await onSaved();
      onClose();
    } catch (err) { setErrors(toErrors(err)); } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!window.confirm('Delete this task?')) return;
    setDeleting(true);
    try { await api.delete(`/tasks/${task.id}/`); await onSaved(); onClose(); }
    catch (err) { setErrors({ form: errMsg(err) }); } finally { setDeleting(false); }
  };

  const addComment = async () => {
    if (!comment.trim()) return;
    setCommenting(true); setCommentError('');
    try { await api.post(`/tasks/${task.id}/comments/`, { body: comment }); setComment(''); await onSaved(); }
    catch (err) { setCommentError(errMsg(err)); } finally { setCommenting(false); }
  };

  const field = 'w-full rounded border px-3 py-2';

  return (
    <div className="fixed inset-0 z-10 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="w-full max-w-lg space-y-4 rounded bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{isNew ? 'New task' : 'Edit task'}</h2>
          <button onClick={onClose} className="text-gray-500">✕</button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div><input className={field} placeholder="Title" value={form.title} onChange={set('title')} /><FieldError message={errors.title} /></div>
          <textarea className={field} rows={3} placeholder="Description" value={form.description} onChange={set('description')} />
          <div className="grid grid-cols-2 gap-3">
            <select className={field} value={form.status} onChange={set('status')}>
              <option value="todo">To Do</option><option value="in_progress">In Progress</option><option value="done">Done</option>
            </select>
            <select className={field} value={form.priority} onChange={set('priority')}>
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
            <div><input type="date" className={field} value={form.due_date} onChange={set('due_date')} /><FieldError message={errors.due_date} /></div>
            <div>
              <select className={field} value={form.assignee_id} onChange={set('assignee_id')}>
                <option value="">Unassigned</option>
                {members.map((u) => <option key={u.id} value={u.id}>{who(u)}</option>)}
              </select>
              <FieldError message={errors.assignee_id} />
            </div>
          </div>
          <FieldError message={errors.status} /><FieldError message={errors.form} />
          <div className="flex gap-2">
            <button disabled={saving || deleting} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
            {!isNew && (
              <button type="button" onClick={remove} disabled={saving || deleting}
                className="rounded border border-red-300 px-4 py-2 text-red-600 disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>
        </form>

        {!isNew && (
          <div className="space-y-2 border-t pt-4">
            <h3 className="font-semibold">Comments</h3>
            {(task.comments ?? []).length === 0 && <p className="text-sm text-gray-500">No comments yet.</p>}
            {(task.comments ?? []).map((c) => (
              <div key={c.id} className="rounded bg-gray-50 p-2 text-sm">
                <p><span className="font-medium">{who(c.author)}</span>
                  <span className="ml-2 text-xs text-gray-400">{new Date(c.created_at).toLocaleString()}</span></p>
                <p>{c.body}</p>
              </div>
            ))}
            <div className="flex gap-2">
              <input className={field} placeholder="Add a comment" value={comment} onChange={(e) => setComment(e.target.value)} />
              <button onClick={addComment} disabled={commenting || !comment.trim()}
                className="rounded bg-gray-800 px-3 text-white disabled:opacity-50">{commenting ? '…' : 'Post'}</button>
            </div>
            {commentError && <p className="text-sm text-red-600">{commentError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}