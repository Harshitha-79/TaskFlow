
export const who = (u) => u?.name || u?.first_name || u?.email || 'Unknown';

// Turns a DRF error response into { field: message, form: message }
export function toErrors(e) {
  const d = e.response?.data;
  if (!d) return { form: 'Network error. Is the server running?' };
  if (typeof d !== 'object') return { form: 'Something went wrong on the server.' };
  if (d.detail) return { form: d.detail };
  const out = {};
  Object.entries(d).forEach(([k, v]) => {
    out[k === 'non_field_errors' ? 'form' : k] = [].concat(v).join(' ');
  });
  return out;
}
export const errMsg = (e) => Object.values(toErrors(e)).join(' ');