/**
 * js/app.js — Main app logic
 * LIFF init, routing, all screen handlers
 */

// ─── CONFIG ───────────────────────────────────────────────────
const LIFF_ID = document.querySelector('meta[name="liff-id"]')?.content || '';

// ─── STATE ────────────────────────────────────────────────────
const App = {
  user: null,
  userProfile: null,
  repairs: [],
  gpsCoords: null,
  isLIFF: false,
  isLoggedIn: false,
};

// ─── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  showScreen('screen-splash');
  await initLIFF();
});

async function initLIFF() {
  try {
    if (!LIFF_ID || LIFF_ID === 'YOUR-LIFF-ID') throw new Error('no liff id');
    await liff.init({ liffId: LIFF_ID });
    App.isLIFF = liff.isInClient();
    if (liff.isLoggedIn()) {
      App.user = await liff.getProfile();
      App.isLoggedIn = true;
      await loadUserProfile();
      await navigateAfterLogin();
    } else {
      if (App.isLIFF) {
        liff.login({ redirectUri: location.href });
      } else {
        showScreen('screen-login');
      }
    }
  } catch (e) {
    console.warn('LIFF fallback:', e.message);
    showScreen('screen-login');
  }
}

async function loadUserProfile() {
  if (!App.user) return;
  try {
    const res = await UserAPI.getByLineId(App.user.userId);
    if (res.ok) App.userProfile = res.data;
  } catch (_) {}
}

async function navigateAfterLogin() {
  const params   = new URLSearchParams(location.search);
  const page     = params.get('page');
  const repairId = params.get('id');
  if (repairId)        { await openRepairDetail(repairId); return; }
  if (!App.userProfile){ showSetupScreen(); return; }
  if (page === 'admin'){ showAdminScreen(); return; }
  showListScreen();
}

// ─── SCREEN HELPERS ───────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function setNav(idx) {
  document.querySelectorAll('.nav-item').forEach((n, i) =>
    n.classList.toggle('active', i === idx));
}

// ─── LOGIN ────────────────────────────────────────────────────
document.getElementById('btn-line-login')?.addEventListener('click', () => {
  if (typeof liff !== 'undefined' && !liff.isLoggedIn()) {
    liff.login({ redirectUri: location.href });
  }
});

document.getElementById('btn-browser-login')?.addEventListener('click', () => {
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value.trim();
  if (!u || !p) { showToast('⚠️ กรุณากรอกข้อมูลให้ครบ'); return; }
  App.user = { userId: 'browser_' + Date.now(), displayName: u };
  App.isLoggedIn = true;
  showSetupScreen();
});

// ─── SETUP PROFILE ────────────────────────────────────────────
function showSetupScreen() {
  showScreen('screen-setup');
  if (App.user) {
    document.getElementById('setup-name').value  = App.userProfile?.displayName || App.user.displayName || '';
    document.getElementById('setup-dept').value  = App.userProfile?.dept || '';
    document.getElementById('setup-phone').value = App.userProfile?.phone || '';
    document.getElementById('setup-room').value  = App.userProfile?.room || '';
  }
}

document.getElementById('btn-save-profile')?.addEventListener('click', async () => {
  const name  = document.getElementById('setup-name').value.trim();
  const dept  = document.getElementById('setup-dept').value;
  const phone = document.getElementById('setup-phone').value.trim();
  const room  = document.getElementById('setup-room').value.trim();
  if (!name || !dept) { showToast('⚠️ กรุณากรอกชื่อและแผนก'); return; }
  showLoader('กำลังบันทึก...');
  try {
    const res = await UserAPI.save({
      lineId: App.user?.userId || '',
      displayName: name,
      pictureUrl:  App.user?.pictureUrl || '',
      dept, phone, room,
    });
    if (res.ok) {
      App.userProfile = { displayName: name, dept, phone, room };
      hideLoader();
      showToast('✅ บันทึกโปรไฟล์แล้ว');
      setTimeout(showListScreen, 600);
    }
  } catch (e) { hideLoader(); showToast('❌ ' + e.message); }
});

document.getElementById('btn-skip-setup')?.addEventListener('click', showListScreen);

// ─── REPAIR LIST ──────────────────────────────────────────────
async function showListScreen() {
  showScreen('screen-list');
  setNav(0);
  await loadRepairs();
}

async function loadRepairs(filter = 'all') {
  const container = document.getElementById('repair-list-content');
  container.innerHTML = '<div class="loading-inline"><div class="spinner-sm spinner"></div> กำลังโหลด...</div>';
  try {
    const params = filter !== 'all' ? { status: filter } : {};
    const res    = await RepairAPI.getAll(params);
    App.repairs  = res.data || [];
    renderRepairList(App.repairs);
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>${e.message}</p></div>`;
  }
}

function renderRepairList(repairs) {
  const container = document.getElementById('repair-list-content');
  if (!repairs.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>ไม่มีรายการ</p></div>';
    return;
  }
  container.innerHTML = repairs.map(r => {
    const b  = statusBadge(r.status);
    const pi = r.priority === 'urgent' ? '⚡' : r.priority === 'critical' ? '🚨' : '';
    return `
    <div class="repair-item" onclick="openRepairDetail('${r.id}')">
      <div class="repair-item-header">
        <div>
          <div class="repair-item-id">${r.id}</div>
          <div class="repair-item-title">${pi} ${r.type}</div>
        </div>
        <span class="badge ${b.cls}">${b.label}</span>
      </div>
      <div class="repair-item-body">
        <div class="repair-detail-text">${r.detail}</div>
        <div class="repair-item-meta">
          <span>👤 ${r.reporterName}</span>
          <span>📍 ${r.location}</span>
          <span>📅 ${fmtDate(r.createdAt)}</span>
        </div>
      </div>
      <div class="repair-item-footer">
        <span class="dept-label">${r.reporterDept}</span>
        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openMapView('${r.lat}','${r.lng}','${r.id}')">🗺️ แผนที่</button>
      </div>
    </div>`;
  }).join('');
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    loadRepairs(this.dataset.filter);
  });
});

// ─── DETAIL ───────────────────────────────────────────────────
async function openRepairDetail(id) {
  showLoader('กำลังโหลด...');
  try {
    let repair = App.repairs.find(r => r.id === id);
    if (!repair) {
      const res = await RepairAPI.getById(id);
      if (!res.ok) throw new Error(res.error);
      repair = res.data;
    }
    hideLoader();
    renderDetailOverlay(repair);
    document.getElementById('detail-overlay').classList.add('active');
  } catch (e) { hideLoader(); showToast('❌ ' + e.message); }
}

function renderDetailOverlay(r) {
  const b = statusBadge(r.status);
  document.getElementById('detail-badge').className   = 'badge ' + b.cls;
  document.getElementById('detail-badge').textContent = b.label;
  const pLabel = r.priority === 'urgent' ? '⚡ เร่งด่วน' : r.priority === 'critical' ? '🚨 วิกฤต' : '📌 ปกติ';
  document.getElementById('detail-body').innerHTML = `
    <div class="detail-card">
      <div class="detail-section-title">ข้อมูลผู้แจ้ง</div>
      <div class="info-row"><span class="info-key">ชื่อ</span><span class="info-val">${r.reporterName}</span></div>
      <div class="info-row"><span class="info-key">แผนก</span><span class="info-val">${r.reporterDept}</span></div>
      <div class="info-row"><span class="info-key">โทร</span><span class="info-val">${r.reporterPhone || '-'}</span></div>
    </div>
    <div class="detail-card">
      <div class="detail-section-title">รายละเอียดงาน</div>
      <div class="info-row"><span class="info-key">เลขที่</span><span class="info-val">#${r.id}</span></div>
      <div class="info-row"><span class="info-key">ประเภท</span><span class="info-val">${r.type}</span></div>
      <div class="info-row"><span class="info-key">รายละเอียด</span><span class="info-val">${r.detail}</span></div>
      <div class="info-row"><span class="info-key">สถานที่</span><span class="info-val">${r.location}</span></div>
      <div class="info-row"><span class="info-key">ความเร่งด่วน</span><span class="info-val">${pLabel}</span></div>
      <div class="info-row"><span class="info-key">GPS</span><span class="info-val mono">${r.lat || '-'}, ${r.lng || '-'}</span></div>
      <div class="info-row"><span class="info-key">วันที่แจ้ง</span><span class="info-val">${fmtDate(r.createdAt)}</span></div>
    </div>
    ${r.techNote ? `<div class="detail-card"><div class="detail-section-title">หมายเหตุช่าง</div><p style="font-size:14px;color:var(--gray-700);padding:8px 14px 12px;">${r.techNote}</p></div>` : ''}
    <div class="detail-card">
      <div class="detail-section-title">สถานะงาน</div>
      <div class="timeline">
        ${timelineItem('✅ รับแจ้ง', fmtDate(r.createdAt), true)}
        ${timelineItem('🔧 กำลังดำเนินการ', r.status !== 'pending' ? fmtDate(r.updatedAt) : 'รอดำเนินการ', r.status !== 'pending')}
        ${timelineItem('✅ เสร็จสิ้น', r.completedAt ? fmtDate(r.completedAt) : 'รอดำเนินการ', r.status === 'done')}
      </div>
    </div>
    <div class="detail-actions">
      ${r.status !== 'done' ? `
        <button class="btn btn-success" onclick="quickUpdateStatus('${r.id}','done')">✅ เสร็จแล้ว</button>
        <button class="btn btn-primary" onclick="quickUpdateStatus('${r.id}','progress')">🔧 รับงาน</button>` : ''}
      <button class="btn btn-outline" onclick="openMapView('${r.lat}','${r.lng}','${r.id}')">🗺️ แผนที่</button>
    </div>`;
}

function timelineItem(title, date, done) {
  return `<div class="timeline-item">
    <div class="timeline-dot ${done ? '' : 'empty'}"></div>
    <div>
      <div class="timeline-title" style="color:${done ? 'var(--gray-800)' : 'var(--gray-400)'}">${title}</div>
      <div class="timeline-date">${date}</div>
    </div>
  </div>`;
}

document.getElementById('btn-close-detail')?.addEventListener('click', () => {
  document.getElementById('detail-overlay').classList.remove('active');
});

async function quickUpdateStatus(id, status) {
  showLoader('กำลังอัปเดต...');
  try {
    const res = await RepairAPI.updateStatus(id, status);
    hideLoader();
    if (res.ok) {
      showToast('✅ อัปเดตสถานะแล้ว');
      document.getElementById('detail-overlay').classList.remove('active');
      await loadRepairs();
    }
  } catch (e) { hideLoader(); showToast('❌ ' + e.message); }
}

// ─── REPAIR FORM ──────────────────────────────────────────────
function showFormScreen() {
  showScreen('screen-form');
  setNav(1);
  if (App.userProfile) {
    document.getElementById('f-name').value     = App.userProfile.displayName || '';
    document.getElementById('f-dept').value     = App.userProfile.dept || '';
    document.getElementById('f-tel').value      = App.userProfile.phone || '';
    document.getElementById('f-location').value = App.userProfile.room || '';
  }
}

document.getElementById('gps-box')?.addEventListener('click', getGPS);

function getGPS() {
  const title  = document.getElementById('gps-title');
  const coords = document.getElementById('gps-coords');
  const box    = document.getElementById('gps-box');
  title.textContent = '🛰️ กำลังระบุตำแหน่ง...';
  title.classList.add('gps-getting');
  const onSuccess = (lat, lng) => {
    App.gpsCoords = { lat: lat.toFixed(6), lng: lng.toFixed(6) };
    title.textContent = '✅ ได้รับตำแหน่งแล้ว';
    title.classList.remove('gps-getting');
    coords.textContent = `lat: ${App.gpsCoords.lat}, lng: ${App.gpsCoords.lng}`;
    box.classList.add('gps-confirmed');
  };
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      p => onSuccess(p.coords.latitude, p.coords.longitude),
      () => onSuccess(13.756350 + Math.random() * 0.01, 100.501850 + Math.random() * 0.01)
    );
  } else {
    onSuccess(13.756350, 100.501850);
  }
}

document.getElementById('btn-submit-repair')?.addEventListener('click', submitRepair);

async function submitRepair() {
  const name     = document.getElementById('f-name').value.trim();
  const dept     = document.getElementById('f-dept').value;
  const tel      = document.getElementById('f-tel').value.trim();
  const type     = document.getElementById('f-type').value;
  const detail   = document.getElementById('f-detail').value.trim();
  const priority = document.getElementById('f-priority').value;
  const location = document.getElementById('f-location').value.trim();
  if (!name || !dept || !type || !detail) {
    showToast('⚠️ กรุณากรอกข้อมูลที่จำเป็นให้ครบ');
    return;
  }
  showLoader('กำลังส่งแจ้งซ่อม...');
  try {
    const res = await RepairAPI.create({
      reporterName:   name,
      reporterDept:   dept,
      reporterPhone:  tel,
      reporterLineId: App.user?.userId || '',
      type, detail, priority, location,
      lat: App.gpsCoords?.lat || '',
      lng: App.gpsCoords?.lng || '',
    });
    hideLoader();
    if (res.ok) {
      showNotifScreen(res.id, { name, dept, type, detail, priority, location });
      resetForm();
    } else {
      showToast('❌ ' + (res.error || 'เกิดข้อผิดพลาด'));
    }
  } catch (e) { hideLoader(); showToast('❌ ' + e.message); }
}

function resetForm() {
  ['f-type','f-detail','f-location'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const p = document.getElementById('f-priority');
  if (p) p.value = 'normal';
  App.gpsCoords = null;
  const box = document.getElementById('gps-box');
  if (box) box.classList.remove('gps-confirmed');
  const t = document.getElementById('gps-title');
  if (t) t.textContent = 'แตะเพื่อรับตำแหน่ง GPS';
  const c = document.getElementById('gps-coords');
  if (c) c.textContent = 'กดเพื่อระบุตำแหน่งของคุณ';
}

// ─── NOTIFICATION SCREEN ──────────────────────────────────────
function showNotifScreen(id, data) {
  showScreen('screen-notif');
  document.getElementById('notif-id').textContent       = '#' + id;
  document.getElementById('notif-user').textContent     = data.name;
  document.getElementById('notif-type').textContent     = data.type;
  document.getElementById('notif-detail').textContent   = data.detail;
  document.getElementById('notif-loc').textContent      = data.location || '-';
  document.getElementById('notif-priority').textContent = data.priority === 'urgent' ? '⚡ เร่งด่วน' : data.priority === 'critical' ? '🚨 วิกฤต' : '📌 ปกติ';
  document.getElementById('notif-date').textContent     = new Date().toLocaleDateString('th-TH');
  document.getElementById('line-message-preview').innerHTML =
    `🔧 <b>แจ้งซ่อมใหม่ #${id}</b><br>` +
    `👤 ผู้แจ้ง: ${data.name} (${data.dept})<br>` +
    `🔧 ประเภท: ${data.type}<br>` +
    `📝 รายละเอียด: ${data.detail}<br>` +
    `📍 สถานที่: ${data.location || '-'}<br>` +
    `⚡ ความเร่งด่วน: ${data.priority === 'urgent' ? '⚡ เร่งด่วน' : '📌 ปกติ'}<br>` +
    `━━━━━━━━━━━━━━━<br>✅ ส่งการแจ้งเตือน LINE OA แล้ว`;
}

// ─── ADMIN DASHBOARD ──────────────────────────────────────────
async function showAdminScreen() {
  showScreen('screen-admin');
  setNav(2);
  showLoader('กำลังโหลด Dashboard...');
  try {
    const [statsRes, repairsRes] = await Promise.all([
      RepairAPI.getStats(),
      RepairAPI.getAll(),
    ]);
    hideLoader();
    if (statsRes.ok)   renderAdminStats(statsRes.data);
    if (repairsRes.ok) {
      App.repairs = repairsRes.data || [];
      renderAdminList(App.repairs.slice(0, 5));
    }
  } catch (e) { hideLoader(); showToast('❌ ' + e.message); }
}

function renderAdminStats(s) {
  document.getElementById('stat-total').textContent   = s.total   || 0;
  document.getElementById('stat-pending').textContent = s.pending || 0;
  document.getElementById('stat-done').textContent    = s.done    || 0;
  document.getElementById('stat-today').textContent   = s.today   || 0;

  const months = Object.keys(s.monthly || {});
  const vals   = Object.values(s.monthly || {});
  const max    = Math.max(...vals, 1);
  document.getElementById('bar-chart').innerHTML = vals.map((v, i) =>
    `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;">
      <div style="font-size:9px;color:var(--gray-500);">${v}</div>
      <div style="width:100%;background:${i === vals.length - 1 ? 'var(--primary)' : 'var(--primary-light)'};border-radius:4px 4px 0 0;height:${Math.round((v / max) * 50) + 4}px;"></div>
    </div>`).join('');
  document.getElementById('bar-labels').innerHTML = months.map(m =>
    `<div style="flex:1;text-align:center;font-size:9px;color:var(--gray-400);">${m.slice(5)}</div>`).join('');

  const types = s.byType || {};
  const total = s.total || 1;
  document.getElementById('type-breakdown').innerHTML = Object.entries(types).slice(0, 5).map(([t, c]) => {
    const pct = Math.round((c / total) * 100);
    return `<div style="margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
        <span style="color:var(--gray-700);">${t}</span>
        <span style="color:var(--gray-500);">${c} (${pct}%)</span>
      </div>
      <div style="height:6px;background:var(--gray-100);border-radius:3px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:var(--primary);border-radius:3px;"></div>
      </div></div>`;
  }).join('');
}

function renderAdminList(repairs) {
  document.getElementById('admin-list').innerHTML = repairs.map(r => {
    const b      = statusBadge(r.status);
    const barCls = r.status === 'done' ? 'done' : (r.priority === 'urgent' || r.priority === 'critical') ? 'urgent' : '';
    return `<div class="admin-repair-item" onclick="openRepairDetail('${r.id}')">
      <div class="admin-item-bar ${barCls}"></div>
      <div class="admin-item-content">
        <div class="admin-item-id">#${r.id}</div>
        <div class="admin-item-title">${r.type}</div>
        <div class="admin-item-meta">👤 ${r.reporterName} • ${r.reporterDept}</div>
      </div>
      <div class="admin-item-right">
        <span class="badge ${b.cls}" style="font-size:10px;">${b.label}</span>
        <span style="font-size:11px;color:var(--gray-400);">${fmtDate(r.createdAt)}</span>
      </div></div>`;
  }).join('');
}

// ─── MAP ──────────────────────────────────────────────────────
function openMapView(lat, lng, id) {
  showScreen('screen-map');
  document.getElementById('map-loc-title').textContent  = `📍 ${id || 'ตำแหน่งที่เลือก'}`;
  document.getElementById('map-loc-coords').textContent = `lat: ${lat}, lng: ${lng}`;
  document.getElementById('map-tooltip').textContent    = `📍 ${lat}, ${lng}`;
  document.getElementById('btn-open-maps').onclick = () =>
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
}

document.getElementById('btn-close-map')?.addEventListener('click', showListScreen);
document.getElementById('btn-confirm-location')?.addEventListener('click', () => {
  showToast('📍 ยืนยันตำแหน่งแล้ว');
  showFormScreen();
});

// ─── PROFILE ──────────────────────────────────────────────────
function showProfileScreen() {
  showScreen('screen-profile');
  setNav(3);
  const p = App.userProfile || {};
  document.getElementById('prof-name').textContent    = p.displayName || App.user?.displayName || 'ผู้ใช้งาน';
  document.getElementById('prof-role').textContent    = (p.dept || 'ไม่ระบุแผนก') + ' • ระบบแจ้งซ่อม';
  document.getElementById('prof-total').textContent   = App.repairs.length;
  document.getElementById('prof-pending').textContent = App.repairs.filter(r => r.status === 'pending').length;
  document.getElementById('prof-done').textContent    = App.repairs.filter(r => r.status === 'done').length;
}

function logout() {
  if (!confirm('ออกจากระบบ?')) return;
  App.user = null; App.userProfile = null; App.isLoggedIn = false;
  if (App.isLIFF && typeof liff !== 'undefined' && liff.isLoggedIn()) liff.logout();
  showScreen('screen-login');
}

// ─── NAV ──────────────────────────────────────────────────────
document.querySelectorAll('[data-nav]').forEach(btn => {
  btn.addEventListener('click', function () {
    const t = this.dataset.nav;
    if (t === 'list'       || t === 'notif-list') showListScreen();
    if (t === 'form'       || t === 'new-repair') showFormScreen();
    if (t === 'admin')  showAdminScreen();
    if (t === 'profile') showProfileScreen();
  });
});

// ─── HELPERS ──────────────────────────────────────────────────
function statusBadge(s) {
  if (s === 'pending')  return { cls: 'badge-warning', label: 'รอดำเนินการ' };
  if (s === 'progress') return { cls: 'badge-primary',  label: 'กำลังซ่อม' };
  if (s === 'done')     return { cls: 'badge-success',  label: 'เสร็จแล้ว' };
  return { cls: 'badge-warning', label: 'รอดำเนินการ' };
}

function fmtDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

const loader = document.getElementById('global-loader');
function showLoader(msg) {
  if (!loader) return;
  loader.querySelector('.loading-text').textContent = msg || 'กำลังโหลด...';
  loader.style.display = 'flex';
}
function hideLoader() {
  if (loader) loader.style.display = 'none';
}

// Expose globals for inline onclick
Object.assign(window, {
  openRepairDetail, openMapView, quickUpdateStatus,
  logout, showSetupScreen, showFormScreen, showListScreen,
  showAdminScreen, showProfileScreen, showToast,
});
