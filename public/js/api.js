/**
 * js/api.js — API client สำหรับเรียก /api/proxy → GAS
 */

async function apiCall(method, params = {}, body = null) {
  const url = new URL('/api/proxy', location.origin);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(url.toString(), opts);
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  return resp.json();
}

const RepairAPI = {
  getAll:       (f = {})            => apiCall('GET',  { action: 'getRepairs', ...f }),
  getById:      (id)                => apiCall('GET',  { action: 'getRepair', id }),
  create:       (data)              => apiCall('POST', { action: 'createRepair' }, { action: 'createRepair', ...data }),
  update:       (data)              => apiCall('POST', { action: 'updateRepair' }, { action: 'updateRepair', ...data }),
  delete:       (id)                => apiCall('POST', { action: 'deleteRepair' }, { action: 'deleteRepair', id }),
  updateStatus: (id, status, note)  => apiCall('POST', { action: 'updateStatus' }, { action: 'updateStatus', id, status, note: note || '' }),
  getStats:     ()                  => apiCall('GET',  { action: 'getStats' }),
};

const UserAPI = {
  save:        (data)   => apiCall('POST', { action: 'saveUser' }, { action: 'saveUser', ...data }),
  getByLineId: (lineId) => apiCall('GET',  { action: 'getUser', lineId }),
};

window.RepairAPI = RepairAPI;
window.UserAPI   = UserAPI;
