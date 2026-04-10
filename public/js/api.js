/**
 * api.js v2 — API client
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

async function uploadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64 = e.target.result.split(',')[1];
        const resp = await fetch('/api/upload', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name, mimeType: file.type, base64Data: base64 }),
        });
        resolve(await resp.json());
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const RepairAPI = {
  getAll:       (f = {})           => apiCall('GET',  { action: 'getRepairs', ...f }),
  getById:      (id)               => apiCall('GET',  { action: 'getRepair', id }),
  create:       (data)             => apiCall('POST', { action: 'createRepair' }, { action: 'createRepair', ...data }),
  update:       (data)             => apiCall('POST', { action: 'updateRepair' }, { action: 'updateRepair', ...data }),
  delete:       (id)               => apiCall('POST', { action: 'deleteRepair' }, { action: 'deleteRepair', id }),
  updateStatus: (id, status, note) => apiCall('POST', { action: 'updateStatus' }, { action: 'updateStatus', id, status, note: note || '' }),
  getStats:     ()                 => apiCall('GET',  { action: 'getStats' }),
};

const UserAPI = {
  save:        (data)   => apiCall('POST', { action: 'saveUser' }, { action: 'saveUser', ...data }),
  getByLineId: (lineId) => apiCall('GET',  { action: 'getUser', lineId }),
};

const AdminAuth = {
  login:      (u, p) => apiCall('POST', { action: 'adminLogin' },      { action: 'adminLogin', username: u, password: p }),
  verify:     (tok)  => apiCall('POST', { action: 'verifyAdminToken' }, { action: 'verifyAdminToken', token: tok }),
  changePass: (tok, np) => apiCall('POST', { action: 'changeAdminPass' }, { action: 'changeAdminPass', token: tok, newPassword: np }),
};

window.RepairAPI = RepairAPI; window.UserAPI = UserAPI;
window.AdminAuth = AdminAuth; window.uploadImage = uploadImage;
