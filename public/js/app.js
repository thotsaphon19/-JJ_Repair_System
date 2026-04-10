/**
 * app.js v2 — JJ22 Repair System
 * - Admin login ด้วย username/password
 * - User login ด้วย LINE LIFF
 * - แยกสิทธิ์ admin/user ชัดเจน
 */

const LIFF_ID = document.querySelector('meta[name="liff-id"]')?.content || '';
const ADMIN_TOKEN_KEY = 'jj22_admin_token';

const App = {
  user: null, userProfile: null, repairs: [],
  gpsCoords: null, isLIFF: false, isLoggedIn: false,
  role: 'user', adminToken: null,
  uploadedImageUrl: null, uploadedImageId: null,
};

// ─── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  showScreen('screen-splash');
  // ตรวจสอบ admin token ที่บันทึกไว้
  const savedToken = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  if (savedToken) {
    try {
      const res = await AdminAuth.verify(savedToken);
      if (res.ok) {
        App.adminToken = savedToken;
        App.role = 'admin';
        App.user = { userId: 'admin', displayName: 'Administrator', pictureUrl: '' };
        App.isLoggedIn = true;
        showAdminScreen();
        return;
      }
    } catch (_) {}
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  }
  await initLIFF();
});

async function initLIFF() {
  try {
    if (!LIFF_ID || LIFF_ID === 'YOUR-LIFF-ID') throw new Error('no liff id');
    await liff.init({ liffId: LIFF_ID });
    App.isLIFF = liff.isInClient();
    if (liff.isLoggedIn()) {
      App.user = await liff.getProfile();
      App.isLoggedIn = true; App.role = 'user';
      await loadUserProfile();
      await navigateAfterLogin();
    } else {
      if (App.isLIFF) liff.login({ redirectUri: location.href });
      else showScreen('screen-login');
    }
  } catch (e) {
    console.warn('LIFF fallback:', e.message);
    showScreen('screen-login');
  }
}

async function loadUserProfile() {
  if (!App.user?.userId) return;
  try {
    const res = await UserAPI.getByLineId(App.user.userId);
    if (res.ok) App.userProfile = res.data;
  } catch (_) {}
}

async function navigateAfterLogin() {
  const params = new URLSearchParams(location.search);
  const page = params.get('page');
  const repairId = params.get('id');
  if (repairId) { await openRepairDetail(repairId); return; }
  if (!App.userProfile) { showSetupScreen(); return; }
  if (page === 'admin' && isAdmin()) { showAdminScreen(); return; }
  showListScreen();
}

// ─── HELPERS ──────────────────────────────────────────────────
function isAdmin() { return App.role === 'admin'; }
function getRoleLabel() { return isAdmin() ? '👨‍💼 Administrator' : '👤 User'; }

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}
function setNav(idx) {
  document.querySelectorAll('.nav-item').forEach((n,i) => n.classList.toggle('active', i===idx));
}
function statusBadge(s) {
  if (s==='pending')  return { cls:'badge-warning', label:'รอดำเนินการ' };
  if (s==='progress') return { cls:'badge-primary',  label:'กำลังซ่อม' };
  if (s==='done')     return { cls:'badge-success',  label:'เสร็จแล้ว' };
  return { cls:'badge-warning', label:'รอดำเนินการ' };
}
function fmtDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'numeric'});
}
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}
const loader = document.getElementById('global-loader');
function showLoader(msg) {
  if (!loader) return;
  loader.querySelector('.loading-text').textContent = msg || 'กำลังโหลด...';
  loader.style.display = 'flex';
}
function hideLoader() { if (loader) loader.style.display = 'none'; }

// ─── LOGIN (USER via LINE) ────────────────────────────────────
document.getElementById('btn-line-login')?.addEventListener('click', () => {
  if (typeof liff !== 'undefined' && !liff.isLoggedIn()) liff.login({ redirectUri: location.href });
});

// Browser fallback login
document.getElementById('btn-browser-login')?.addEventListener('click', () => {
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value.trim();
  if (!u || !p) { showToast('⚠️ กรุณากรอกข้อมูลให้ครบ'); return; }
  App.user = { userId: 'browser_'+u, displayName: u, pictureUrl: '' };
  App.isLoggedIn = true; App.role = 'user';
  showSetupScreen();
});

// ─── ADMIN LOGIN ──────────────────────────────────────────────
document.getElementById('btn-go-admin-login')?.addEventListener('click', () => {
  showScreen('screen-admin-login');
  document.getElementById('admin-username').value = '';
  document.getElementById('admin-password').value = '';
  document.getElementById('admin-login-error').textContent = '';
});

document.getElementById('btn-back-to-login')?.addEventListener('click', () => {
  showScreen('screen-login');
});

document.getElementById('btn-admin-submit')?.addEventListener('click', doAdminLogin);
document.getElementById('admin-password')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') doAdminLogin();
});

async function doAdminLogin() {
  const u = document.getElementById('admin-username').value.trim();
  const p = document.getElementById('admin-password').value.trim();
  const errEl = document.getElementById('admin-login-error');
  if (!u || !p) { errEl.textContent = '⚠️ กรุณากรอก username และ password'; return; }

  const btn = document.getElementById('btn-admin-submit');
  btn.textContent = '⏳ กำลังตรวจสอบ...';
  btn.disabled = true;
  errEl.textContent = '';

  try {
    const res = await AdminAuth.login(u, p);
    if (res.ok) {
      App.adminToken = res.token;
      App.role = 'admin';
      App.user = { userId: 'admin', displayName: 'Administrator', pictureUrl: '' };
      App.isLoggedIn = true;
      sessionStorage.setItem(ADMIN_TOKEN_KEY, res.token);
      showToast('✅ เข้าสู่ระบบ Admin สำเร็จ');
      setTimeout(() => showAdminScreen(), 400);
    } else {
      errEl.textContent = '❌ ' + (res.error || 'username หรือ password ไม่ถูกต้อง');
    }
  } catch (e) {
    errEl.textContent = '❌ ไม่สามารถเชื่อมต่อได้: ' + e.message;
  } finally {
    btn.textContent = '🔐 เข้าสู่ระบบ Admin';
    btn.disabled = false;
  }
}

// ─── SETUP PROFILE ────────────────────────────────────────────
function showSetupScreen() {
  showScreen('screen-setup');
  const picEl = document.getElementById('profile-pic-preview');
  const picSrc = App.user?.pictureUrl || '';
  if (picEl) {
    picEl.innerHTML = picSrc
      ? `<img src="${picSrc}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:4px solid white;box-shadow:0 4px 12px rgba(0,0,0,.15);" onerror="this.parentElement.innerHTML='<div class=\\'avatar-upload\\'>👤</div>'">`
      : '<div class="avatar-upload">👤</div>';
  }
  if (App.userProfile) {
    document.getElementById('setup-name').value    = App.userProfile.displayName || App.user?.displayName || '';
    document.getElementById('setup-dept').value    = App.userProfile.dept || '';
    document.getElementById('setup-phone').value   = App.userProfile.phone || '';
    document.getElementById('setup-project').value = App.userProfile.project || '';
    document.getElementById('setup-houseno').value = App.userProfile.houseNo || '';
  } else {
    document.getElementById('setup-name').value = App.user?.displayName || '';
  }
}

document.getElementById('btn-save-profile')?.addEventListener('click', async () => {
  const name    = document.getElementById('setup-name').value.trim();
  const dept    = document.getElementById('setup-dept').value;
  const phone   = document.getElementById('setup-phone').value.trim();
  const project = document.getElementById('setup-project').value.trim();
  const houseNo = document.getElementById('setup-houseno').value.trim();
  if (!name) { showToast('⚠️ กรุณากรอกชื่อ'); return; }
  showLoader('กำลังบันทึก...');
  try {
    const res = await UserAPI.save({
      lineId: App.user?.userId || '', displayName: name,
      pictureUrl: App.user?.pictureUrl || '', dept, phone, project, houseNo, role: 'user',
    });
    if (res.ok) {
      App.userProfile = { displayName:name, dept, phone, project, houseNo, role:'user', pictureUrl:App.user?.pictureUrl||'' };
      hideLoader(); showToast('✅ บันทึกโปรไฟล์แล้ว');
      setTimeout(showListScreen, 600);
    } else { hideLoader(); showToast('❌ '+(res.error||'เกิดข้อผิดพลาด')); }
  } catch (e) { hideLoader(); showToast('❌ '+e.message); }
});

document.getElementById('btn-skip-setup')?.addEventListener('click', showListScreen);

// ─── REPAIR LIST ──────────────────────────────────────────────
async function showListScreen() {
  showScreen('screen-list');
  setNav(0);
  const adminBtn = document.querySelector('[data-nav="admin"]');
  if (adminBtn) adminBtn.style.display = isAdmin() ? '' : 'none';
  await loadRepairs();
}

async function loadRepairs(filter = 'all') {
  const container = document.getElementById('repair-list-content');
  container.innerHTML = '<div class="loading-inline"><div class="spinner"></div> กำลังโหลด...</div>';
  try {
    const params = {};
    if (filter !== 'all') params.status = filter;
    if (!isAdmin() && App.user?.userId) params.lineId = App.user.userId;
    const res = await RepairAPI.getAll(params);
    App.repairs = res.data || [];
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
    const b = statusBadge(r.status);
    const pi = r.priority==='urgent'?'⚡':r.priority==='critical'?'🚨':'';
    const imgHtml = r.imageUrl
      ? `<img src="${r.imageUrl}" style="width:100%;height:120px;object-fit:cover;border-radius:8px;margin-top:8px;" onerror="this.style.display='none'">`
      : '';
    return `<div class="repair-item" onclick="openRepairDetail('${r.id}')">
      <div class="repair-item-header">
        <div><div class="repair-item-id">${r.id}</div><div class="repair-item-title">${pi} ${r.type}</div></div>
        <span class="badge ${b.cls}">${b.label}</span>
      </div>
      <div class="repair-item-body">
        <div class="repair-detail-text">${r.detail}</div>${imgHtml}
        <div class="repair-item-meta" style="margin-top:6px;">
          <span>👤 ${r.reporterName}</span>
          <span>🏠 ${r.project||'-'} ${r.houseNo||''}</span>
          <span>📅 ${fmtDate(r.createdAt)}</span>
        </div>
      </div>
      <div class="repair-item-footer">
        <span class="dept-label">${r.reporterDept||''}</span>
        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openMapView('${r.lat}','${r.lng}','${r.id}')">🗺️ แผนที่</button>
      </div>
    </div>`;
  }).join('');
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active'); loadRepairs(this.dataset.filter);
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
  } catch (e) { hideLoader(); showToast('❌ '+e.message); }
}

function renderDetailOverlay(r) {
  const b = statusBadge(r.status);
  document.getElementById('detail-badge').className   = 'badge '+b.cls;
  document.getElementById('detail-badge').textContent = b.label;
  const pLabel = r.priority==='urgent'?'⚡ เร่งด่วน':r.priority==='critical'?'🚨 วิกฤต':'📌 ปกติ';
  const imgSection = r.imageUrl
    ? `<div class="detail-card"><div class="detail-section-title">รูปภาพ</div>
        <img src="${r.imageUrl}" style="width:100%;border-radius:8px;margin:8px 0;" onerror="this.style.display='none'"></div>`
    : '';
  const actionBtns = isAdmin()
    ? `${r.status!=='done'?`
        <button class="btn btn-success" onclick="quickUpdateStatus('${r.id}','done')">✅ เสร็จแล้ว</button>
        <button class="btn btn-primary" onclick="quickUpdateStatus('${r.id}','progress')">🔧 รับงาน</button>
        <button class="btn btn-danger" onclick="doDeleteRepair('${r.id}')">🗑️ ลบ</button>`
      : `<button class="btn btn-gray" onclick="quickUpdateStatus('${r.id}','pending')">↩ เปิดใหม่</button>`}
       <button class="btn btn-outline" onclick="openMapView('${r.lat}','${r.lng}','${r.id}')">🗺️ แผนที่</button>`
    : `<button class="btn btn-outline" onclick="openMapView('${r.lat}','${r.lng}','${r.id}')">🗺️ แผนที่</button>`;

  document.getElementById('detail-body').innerHTML = `
    <div class="detail-card">
      <div class="detail-section-title">ข้อมูลผู้แจ้ง</div>
      <div class="info-row"><span class="info-key">ชื่อ</span><span class="info-val">${r.reporterName}</span></div>
      <div class="info-row"><span class="info-key">แผนก</span><span class="info-val">${r.reporterDept||'-'}</span></div>
      <div class="info-row"><span class="info-key">โครงการ</span><span class="info-val">${r.project||'-'}</span></div>
      <div class="info-row"><span class="info-key">บ้านเลขที่</span><span class="info-val">${r.houseNo||'-'}</span></div>
      <div class="info-row"><span class="info-key">โทร</span><span class="info-val">${r.reporterPhone||'-'}</span></div>
    </div>
    <div class="detail-card">
      <div class="detail-section-title">รายละเอียดงาน</div>
      <div class="info-row"><span class="info-key">เลขที่</span><span class="info-val">#${r.id}</span></div>
      <div class="info-row"><span class="info-key">ประเภท</span><span class="info-val">${r.type}</span></div>
      <div class="info-row"><span class="info-key">รายละเอียด</span><span class="info-val">${r.detail}</span></div>
      <div class="info-row"><span class="info-key">สถานที่</span><span class="info-val">${r.location||'-'}</span></div>
      <div class="info-row"><span class="info-key">ความเร่งด่วน</span><span class="info-val">${pLabel}</span></div>
      <div class="info-row"><span class="info-key">GPS</span><span class="info-val mono">${r.lat||'-'}, ${r.lng||'-'}</span></div>
      <div class="info-row"><span class="info-key">วันที่แจ้ง</span><span class="info-val">${fmtDate(r.createdAt)}</span></div>
    </div>
    ${imgSection}
    ${r.techNote?`<div class="detail-card"><div class="detail-section-title">หมายเหตุช่าง</div><p style="font-size:14px;color:var(--gray-700);padding:8px 14px 12px;">${r.techNote}</p></div>`:''}
    <div class="detail-card">
      <div class="detail-section-title">สถานะงาน</div>
      <div class="timeline">
        ${timelineItem('✅ รับแจ้ง', fmtDate(r.createdAt), true)}
        ${timelineItem('🔧 กำลังดำเนินการ', r.status!=='pending'?fmtDate(r.updatedAt):'รอดำเนินการ', r.status!=='pending')}
        ${timelineItem('✅ เสร็จสิ้น', r.completedAt?fmtDate(r.completedAt):'รอดำเนินการ', r.status==='done')}
      </div>
    </div>
    <div class="detail-actions">${actionBtns}</div>`;
}

function timelineItem(title, date, done) {
  return `<div class="timeline-item">
    <div class="timeline-dot ${done?'':'empty'}"></div>
    <div>
      <div class="timeline-title" style="color:${done?'var(--gray-800)':'var(--gray-400)'}">${title}</div>
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
  } catch (e) { hideLoader(); showToast('❌ '+e.message); }
}

async function doDeleteRepair(id) {
  if (!confirm('ลบรายการนี้?')) return;
  showLoader('กำลังลบ...');
  try {
    const res = await RepairAPI.delete(id);
    hideLoader();
    if (res.ok) {
      showToast('🗑️ ลบเรียบร้อย');
      document.getElementById('detail-overlay').classList.remove('active');
      await loadRepairs();
    }
  } catch (e) { hideLoader(); showToast('❌ '+e.message); }
}

// ─── REPAIR FORM ──────────────────────────────────────────────
function showFormScreen() {
  showScreen('screen-form'); setNav(1);
  App.uploadedImageUrl = null; App.uploadedImageId = null;
  document.getElementById('upload-preview').style.display = 'none';
  document.getElementById('upload-placeholder').style.display = 'flex';
  const us = document.getElementById('upload-status');
  if (us) us.textContent = '';
  if (App.userProfile) {
    document.getElementById('f-name').value     = App.userProfile.displayName||'';
    document.getElementById('f-dept').value     = App.userProfile.dept||'';
    document.getElementById('f-tel').value      = App.userProfile.phone||'';
    document.getElementById('f-project').value  = App.userProfile.project||'';
    document.getElementById('f-houseno').value  = App.userProfile.houseNo||'';
  }
}

document.getElementById('gps-box')?.addEventListener('click', getGPS);

function getGPS() {
  const title = document.getElementById('gps-title');
  const coords = document.getElementById('gps-coords');
  const box = document.getElementById('gps-box');
  title.textContent = '🛰️ กำลังระบุตำแหน่ง...';
  title.classList.add('gps-getting');
  const ok = (lat, lng) => {
    App.gpsCoords = { lat: lat.toFixed(6), lng: lng.toFixed(6) };
    title.textContent = '✅ ได้รับตำแหน่งแล้ว';
    title.classList.remove('gps-getting');
    coords.textContent = `lat: ${App.gpsCoords.lat}, lng: ${App.gpsCoords.lng}`;
    box.classList.add('gps-confirmed');
  };
  if (navigator.geolocation) navigator.geolocation.getCurrentPosition(
    p => ok(p.coords.latitude, p.coords.longitude),
    () => ok(13.7563+Math.random()*.01, 100.5018+Math.random()*.01)
  );
  else ok(13.756350, 100.501850);
}

document.getElementById('photo-input')?.addEventListener('change', async function() {
  const file = this.files[0]; if (!file) return;
  if (file.size > 5*1024*1024) { showToast('⚠️ ไฟล์ใหญ่เกิน 5MB'); return; }
  const preview = document.getElementById('upload-preview');
  const ph = document.getElementById('upload-placeholder');
  const us = document.getElementById('upload-status');
  const reader = new FileReader();
  reader.onload = e => { preview.src = e.target.result; preview.style.display='block'; ph.style.display='none'; };
  reader.readAsDataURL(file);
  us.textContent = '⏳ กำลังอัปโหลดไป Google Drive...';
  us.style.color = 'var(--warning)';
  try {
    const res = await uploadImage(file);
    if (res.ok) {
      App.uploadedImageUrl = res.viewUrl; App.uploadedImageId = res.fileId;
      us.textContent = '✅ อัปโหลดสำเร็จ — บันทึกใน Google Drive';
      us.style.color = 'var(--success)';
      showToast('✅ อัปโหลดรูปสำเร็จ');
    } else {
      us.textContent = '❌ '+(res.error||'อัปโหลดไม่สำเร็จ');
      us.style.color = 'var(--danger)';
    }
  } catch (e) { us.textContent = '❌ '+e.message; us.style.color='var(--danger)'; }
});

document.getElementById('btn-submit-repair')?.addEventListener('click', submitRepair);

async function submitRepair() {
  const name    = document.getElementById('f-name').value.trim();
  const dept    = document.getElementById('f-dept').value;
  const tel     = document.getElementById('f-tel').value.trim();
  const type    = document.getElementById('f-type').value;
  const detail  = document.getElementById('f-detail').value.trim();
  const priority= document.getElementById('f-priority').value;
  const location= document.getElementById('f-location').value.trim();
  const project = document.getElementById('f-project').value.trim();
  const houseNo = document.getElementById('f-houseno').value.trim();
  if (!name||!type||!detail) { showToast('⚠️ กรุณากรอกชื่อ, ประเภท, และรายละเอียด'); return; }
  showLoader('กำลังส่งแจ้งซ่อม...');
  try {
    const res = await RepairAPI.create({
      reporterName: name, reporterDept: dept, reporterPhone: tel,
      reporterLineId: App.user?.userId||'',
      project, houseNo, type, detail, priority, location,
      lat: App.gpsCoords?.lat||'', lng: App.gpsCoords?.lng||'',
      imageUrl: App.uploadedImageUrl||'', imageId: App.uploadedImageId||'',
    });
    hideLoader();
    if (res.ok) { showNotifScreen(res.id,{name,dept,type,detail,priority,location,project,houseNo}); resetForm(); }
    else showToast('❌ '+(res.error||'เกิดข้อผิดพลาด'));
  } catch (e) { hideLoader(); showToast('❌ '+e.message); }
}

function resetForm() {
  ['f-type','f-detail','f-location','f-project','f-houseno'].forEach(id => { const el=document.getElementById(id); if(el)el.value=''; });
  const p=document.getElementById('f-priority'); if(p)p.value='normal';
  App.gpsCoords=null; App.uploadedImageUrl=null; App.uploadedImageId=null;
  const box=document.getElementById('gps-box'); if(box)box.classList.remove('gps-confirmed');
  const t=document.getElementById('gps-title'); if(t)t.textContent='แตะเพื่อรับตำแหน่ง GPS';
  const c=document.getElementById('gps-coords'); if(c)c.textContent='กดเพื่อระบุตำแหน่งของคุณ';
  const prev=document.getElementById('upload-preview'); if(prev)prev.style.display='none';
  const ph=document.getElementById('upload-placeholder'); if(ph)ph.style.display='flex';
  const us=document.getElementById('upload-status'); if(us)us.textContent='';
}

// ─── NOTIFICATION ─────────────────────────────────────────────
function showNotifScreen(id, data) {
  showScreen('screen-notif');
  document.getElementById('notif-id').textContent      = '#'+id;
  document.getElementById('notif-user').textContent    = data.name;
  document.getElementById('notif-type').textContent    = data.type;
  document.getElementById('notif-detail').textContent  = data.detail;
  document.getElementById('notif-loc').textContent     = data.location||'-';
  document.getElementById('notif-project').textContent = data.project?`${data.project} ${data.houseNo||''}`:'-';
  document.getElementById('notif-priority').textContent= data.priority==='urgent'?'⚡ เร่งด่วน':data.priority==='critical'?'🚨 วิกฤต':'📌 ปกติ';
  document.getElementById('notif-date').textContent    = new Date().toLocaleDateString('th-TH');
  document.getElementById('line-message-preview').innerHTML =
    `🔧 <b>แจ้งซ่อมใหม่ #${id}</b><br>👤 ${data.name}<br>🏠 ${data.project||'-'} ${data.houseNo||''}<br>🔧 ${data.type}<br>📝 ${data.detail}<br>━━━━━━━━━━━━━━━<br>✅ ส่ง LINE OA แล้ว`;
}

// ─── ADMIN DASHBOARD ──────────────────────────────────────────
async function showAdminScreen() {
  if (!isAdmin()) { showToast('⛔ ไม่มีสิทธิ์เข้าถึง Admin'); showListScreen(); return; }
  showScreen('screen-admin'); setNav(2);
  // อัปเดต header ชื่อ admin
  const adminNameEl = document.getElementById('admin-display-name');
  if (adminNameEl) adminNameEl.textContent = 'ยินดีต้อนรับ, Administrator';
  showLoader('กำลังโหลด Dashboard...');
  try {
    const [sRes, rRes] = await Promise.all([RepairAPI.getStats(), RepairAPI.getAll()]);
    hideLoader();
    if (sRes.ok)  renderAdminStats(sRes.data);
    if (rRes.ok) { App.repairs=rRes.data||[]; renderAdminList(App.repairs.slice(0,6)); }
  } catch (e) { hideLoader(); showToast('❌ '+e.message); }
}

function renderAdminStats(s) {
  document.getElementById('stat-total').textContent   = s.total||0;
  document.getElementById('stat-pending').textContent = s.pending||0;
  document.getElementById('stat-done').textContent    = s.done||0;
  document.getElementById('stat-today').textContent   = s.today||0;
  const vals=Object.values(s.monthly||{}), months=Object.keys(s.monthly||{});
  const max=Math.max(...vals,1);
  document.getElementById('bar-chart').innerHTML = vals.map((v,i)=>
    `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;">
      <div style="font-size:9px;color:var(--gray-500);">${v}</div>
      <div style="width:100%;background:${i===vals.length-1?'var(--primary)':'var(--primary-light)'};border-radius:4px 4px 0 0;height:${Math.round((v/max)*50)+4}px;"></div>
    </div>`).join('');
  document.getElementById('bar-labels').innerHTML = months.map(m=>
    `<div style="flex:1;text-align:center;font-size:9px;color:var(--gray-400);">${m.slice(5)}</div>`).join('');
  const types=s.byType||{}, total=s.total||1;
  document.getElementById('type-breakdown').innerHTML = Object.entries(types).slice(0,5).map(([t,c])=>{
    const pct=Math.round((c/total)*100);
    return `<div style="margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
        <span style="color:var(--gray-700);">${t}</span><span style="color:var(--gray-500);">${c}(${pct}%)</span>
      </div>
      <div style="height:6px;background:var(--gray-100);border-radius:3px;overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:var(--primary);border-radius:3px;"></div>
      </div></div>`;
  }).join('');
}

function renderAdminList(repairs) {
  document.getElementById('admin-list').innerHTML = repairs.map(r=>{
    const b=statusBadge(r.status);
    const bc=r.status==='done'?'done':(r.priority==='urgent'||r.priority==='critical')?'urgent':'';
    return `<div class="admin-repair-item" onclick="openRepairDetail('${r.id}')">
      <div class="admin-item-bar ${bc}"></div>
      <div class="admin-item-content">
        <div class="admin-item-id">#${r.id}</div>
        <div class="admin-item-title">${r.type}</div>
        <div class="admin-item-meta">👤 ${r.reporterName} • 🏠 ${r.project||'-'} ${r.houseNo||''}</div>
      </div>
      <div class="admin-item-right">
        <span class="badge ${b.cls}" style="font-size:10px;">${b.label}</span>
        <span style="font-size:11px;color:var(--gray-400);">${fmtDate(r.createdAt)}</span>
      </div></div>`;
  }).join('');
}

// Admin change password
document.getElementById('btn-change-pass')?.addEventListener('click', async () => {
  const np = prompt('กรอกรหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร):');
  if (!np) return;
  if (np.length < 6) { showToast('⚠️ รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return; }
  try {
    const res = await AdminAuth.changePass(App.adminToken, np);
    if (res.ok) showToast('✅ เปลี่ยนรหัสผ่านสำเร็จ');
    else showToast('❌ '+(res.error||'ไม่สำเร็จ'));
  } catch (e) { showToast('❌ '+e.message); }
});

// ─── MAP ──────────────────────────────────────────────────────
function openMapView(lat, lng, id) {
  showScreen('screen-map');
  document.getElementById('map-loc-title').textContent  = `📍 ${id||'ตำแหน่งที่เลือก'}`;
  document.getElementById('map-loc-coords').textContent = `lat: ${lat}, lng: ${lng}`;
  document.getElementById('map-tooltip').textContent    = `📍 ${lat}, ${lng}`;
  document.getElementById('btn-open-maps').onclick = () =>
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
}
document.getElementById('btn-close-map')?.addEventListener('click', showListScreen);
document.getElementById('btn-confirm-location')?.addEventListener('click', () => {
  showToast('📍 ยืนยันตำแหน่งแล้ว'); showFormScreen();
});

// ─── PROFILE ──────────────────────────────────────────────────
function showProfileScreen() {
  showScreen('screen-profile'); setNav(3);
  const p = App.userProfile||{};
  const picUrl = p.pictureUrl||App.user?.pictureUrl||'';
  const profPic = document.getElementById('prof-avatar');
  if (profPic) {
    profPic.innerHTML = picUrl
      ? `<img src="${picUrl}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:4px solid white;box-shadow:0 4px 12px rgba(0,0,0,.2);" onerror="this.parentElement.innerHTML='👤'">`
      : '👤';
  }
  document.getElementById('prof-name').textContent     = isAdmin() ? 'Administrator' : (p.displayName||App.user?.displayName||'ผู้ใช้งาน');
  document.getElementById('prof-role-label').textContent = getRoleLabel();
  document.getElementById('prof-dept').textContent     = isAdmin() ? '🔐 Admin System' : (p.dept||'ไม่ระบุแผนก');
  document.getElementById('prof-project').textContent  = isAdmin() ? '' : (p.project?`🏠 ${p.project} ${p.houseNo||''}`:'🏠 ไม่ระบุโครงการ');
  document.getElementById('prof-total').textContent    = isAdmin() ? App.repairs.length : App.repairs.filter(r=>r.reporterLineId===App.user?.userId).length;
  document.getElementById('prof-pending').textContent  = App.repairs.filter(r=>r.status==='pending').length;
  document.getElementById('prof-done').textContent     = App.repairs.filter(r=>r.status==='done').length;
  const adminMenu = document.getElementById('menu-admin');
  if (adminMenu) adminMenu.style.display = isAdmin()?'flex':'none';
  const changePassMenu = document.getElementById('menu-change-pass');
  if (changePassMenu) changePassMenu.style.display = isAdmin()?'flex':'none';
}

function logout() {
  if (!confirm('ออกจากระบบ?')) return;
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  App.user=null; App.userProfile=null; App.isLoggedIn=false; App.role='user'; App.adminToken=null;
  if (App.isLIFF && typeof liff!=='undefined' && liff.isLoggedIn()) liff.logout();
  showScreen('screen-login');
}

// ─── NAV ──────────────────────────────────────────────────────
document.querySelectorAll('[data-nav]').forEach(btn => {
  btn.addEventListener('click', function() {
    const t = this.dataset.nav;
    if (t==='list'||t==='notif-list') showListScreen();
    if (t==='form'||t==='new-repair') showFormScreen();
    if (t==='admin')   showAdminScreen();
    if (t==='profile') showProfileScreen();
  });
});

Object.assign(window, {
  openRepairDetail, openMapView, quickUpdateStatus, doDeleteRepair,
  logout, showSetupScreen, showFormScreen, showListScreen,
  showAdminScreen, showProfileScreen, showToast, isAdmin, doAdminLogin,
});
