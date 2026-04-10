const LIFF_ID = "YOUR_LIFF_ID";
const API = "YOUR_GAS_URL";

let user={}, role="user", lat=0, lng=0;
const app = document.getElementById("app");

init();

async function init(){
  await liff.init({ liffId: LIFF_ID });

  if(!liff.isLoggedIn()) return liff.login();

  const p = await liff.getProfile();
  user = { userId:p.userId, name:p.displayName };

  const res = await api("getUser",{userId:user.userId});
  role = res.role;

  home();
}

// ===== API =====
async function api(action,data={}){
  const res = await fetch(API,{
    method:"POST",
    body:JSON.stringify({action,...data})
  });
  return res.json();
}

// ===== HOME =====
function home(){
  app.innerHTML=`
  <div class="header-bg">
    <div class="header-overlay"></div>
  </div>

  <div class="card">
    <h3>${user.name}</h3>
    <div class="btn btn-green" onclick="repair()">แจ้งซ่อม</div>
  </div>`;
}

// ===== REPAIR =====
function repair(){
  app.innerHTML=`
  <div class="header-bg"></div>

  <div class="card">
    <textarea id="detail" placeholder="รายละเอียด"></textarea>
    <input type="file" onchange="preview(event)">
    <img id="img" class="preview">
    <div id="map"></div>
    <div class="btn btn-blue" onclick="submit()">ส่ง</div>
  </div>`;

  navigator.geolocation.getCurrentPosition(p=>{
    lat=p.coords.latitude;
    lng=p.coords.longitude;

    const map=new google.maps.Map(document.getElementById("map"),{
      center:{lat,lng},zoom:15
    });

    new google.maps.Marker({position:{lat,lng},map});
  });
}

// ===== SUBMIT =====
async function submit(){
  const detail=document.getElementById("detail").value;
  const file=document.querySelector("input[type=file]").files[0];

  let img="";
  if(file) img=await base64(file);

  await api("createRepair",{userId:user.userId,detail,lat,lng,image:img});
  alert("สำเร็จ");
  home();
}

// ===== LIST =====
async function list(){
  const data=await api("getRepairs");

  let html=`<div class="header-bg"></div><div class="card">`;

  data.forEach(r=>{
    html+=`
    <div class="list">
      ${r.detail}
      <div class="status ${r.status}">${r.status}</div>
      ${role==="admin"?`<div class="btn btn-orange" onclick="update('${r.id}')">ปิดงาน</div>`:""}
    </div>`;
  });

  html+=`</div>`;
  app.innerHTML=html;
}

// ===== ADMIN =====
function admin(){
  if(role!=="admin") return alert("No Permission");
  list();
}

// ===== UPDATE =====
async function update(id){
  await api("update",{id});
  list();
}

// ===== HELPER =====
function preview(e){
  const r=new FileReader();
  r.onload=()=>document.getElementById("img").src=r.result;
  r.readAsDataURL(e.target.files[0]);
}

function base64(file){
  return new Promise(r=>{
    const reader=new FileReader();
    reader.onload=()=>r(reader.result);
    reader.readAsDataURL(file);
  });
}