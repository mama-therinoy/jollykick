const cfg = window.APP_CONFIG;
const client = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY);
const types = { movement: 'ลูกดิ้น', kick: 'เตะ', jab: 'กระทุ้ง', stretch: 'โก่งตัว', burst: 'ดิ้นต่อเนื่องกันเป็นชุดสั้น ๆ' };
const detailTypes = ['kick', 'jab', 'stretch', 'burst'];
let user = null, pregnancy = null, todayEvents = [], pendingMovementId = null, editingId = null;
const $ = id => document.getElementById(id);

function dayBounds(date = new Date()) { const s = new Date(date.getFullYear(), date.getMonth(), date.getDate()), e = new Date(date.getFullYear(), date.getMonth(), date.getDate()+1); return [s.toISOString(), e.toISOString()] }
function dateFromInput(v){ const [y,m,d]=v.split('-').map(Number); return new Date(y,m-1,d) }
function inputDate(d=new Date()){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function fmtTime(v){ return new Intl.DateTimeFormat('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(v)) }
function labelType(t){ return t ? types[t] || t : 'ยังไม่ระบุลักษณะ' }
function setStatus(s){ $('status').textContent=s }
function showOnly(id){ ['loginView','setupView','appView'].forEach(x => $(x).hidden = x !== id) }
function isPlus(){ return pregnancy?.plan === 'plus' }
function minFreeHistoryDate(){ const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-2); return d }

function gestationalText(due){
  const dueDate = dateFromInput(due), today = new Date(); today.setHours(0,0,0,0);
  const conceptionBase = new Date(dueDate); conceptionBase.setDate(conceptionBase.getDate()-280);
  const days = Math.floor((today-conceptionBase)/86400000);
  if(days < 0) return 'ยังไม่ถึงช่วงอายุครรภ์ที่คำนวณได้';
  if(days > 294) return 'เลยกำหนดคลอดที่บันทึกไว้แล้ว';
  const weeks=Math.floor(days/7), rem=days%7;
  const left=Math.max(0,Math.ceil((dueDate-today)/86400000));
  return `${weeks} สัปดาห์ ${rem} วัน · เหลือประมาณ ${left} วันถึงกำหนดคลอด`;
}

async function boot(){
  $('logDate').value=inputDate(); renderMovementOptions(); bindTabs();
  const {data:{session}}=await client.auth.getSession();
  if(!session){ showOnly('loginView'); return; }
  user=session.user; await routeAfterLogin();
}
async function routeAfterLogin(){
  const {data,error}=await client.from('pregnancies').select('*').eq('user_id',user.id).eq('status','active').order('created_at',{ascending:false}).limit(1);
  if(error){ $('loginError').textContent='โหลดข้อมูลไม่สำเร็จ: '+error.message; showOnly('loginView'); return; }
  if(!data?.length){ pregnancy=null; showOnly('setupView'); return; }
  pregnancy=data[0]; showApp(); await loadToday();
}
function showApp(){
  showOnly('appView'); $('babyTitle').textContent=pregnancy.baby_nickname?.trim() || 'เจ้าตัวน้อย'; $('pregnancyAge').textContent=gestationalText(pregnancy.due_date); $('planBadge').textContent=pregnancy.plan.toUpperCase();
  $('historyHint').textContent=isPlus()?'JollyKick Plus · ประวัติทั้งหมดของการตั้งครรภ์':'JollyKick Free · วันนี้ + 2 วันย้อนหลัง';
  configureHistoryAccess();
}

$('loginForm').addEventListener('submit',async e=>{ e.preventDefault(); $('loginError').textContent=''; const {data,error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value}); if(error){$('loginError').textContent='เข้าสู่ระบบไม่สำเร็จ: '+error.message;return} user=data.user; await routeAfterLogin(); });
async function logout(){ await client.auth.signOut(); user=null; pregnancy=null; todayEvents=[]; showOnly('loginView') }
$('logoutBtn').onclick=logout; $('setupLogoutBtn').onclick=logout;

$('pregnancyForm').addEventListener('submit',async e=>{
  e.preventDefault(); $('setupError').textContent='';
  const due=$('dueDate').value, nick=$('babyNickname').value.trim();
  if(!due){$('setupError').textContent='กรุณาระบุกำหนดคลอด';return}
  const {data,error}=await client.from('pregnancies').insert({user_id:user.id,baby_nickname:nick||null,due_date:due}).select('*').single();
  if(error){$('setupError').textContent='สร้างข้อมูลการตั้งครรภ์ไม่สำเร็จ: '+error.message;return}
  pregnancy=data; showApp(); await loadToday();
});

function bindTabs(){ document.querySelectorAll('.tab').forEach(btn=>btn.onclick=async()=>{ document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===btn)); document.querySelectorAll('.view').forEach(x=>x.hidden=true); $(btn.dataset.view+'View').hidden=false; if(btn.dataset.view==='logs')await loadLogDate(); if(btn.dataset.view==='activity')await loadActivity(); }); }

async function loadToday(){ const [start,end]=dayBounds(); const {data,error}=await client.from('kick_events').select('id,occurred_at,movement_type,note,created_at').eq('pregnancy_id',pregnancy.id).gte('occurred_at',start).lt('occurred_at',end).order('occurred_at',{ascending:false}); if(error){setStatus('โหลดข้อมูลไม่สำเร็จ: '+error.message);return} todayEvents=data||[]; renderToday(); }
$('kickBtn').onclick=async()=>{ if(!user||!pregnancy)return; $('kickBtn').disabled=true; const now=new Date().toISOString(); const {data,error}=await client.from('kick_events').insert({pregnancy_id:pregnancy.id,movement_type:'movement',occurred_at:now}).select('id,occurred_at,movement_type,note,created_at').single(); $('kickBtn').disabled=false; if(error){setStatus('บันทึกไม่สำเร็จ: '+error.message);return} todayEvents.unshift(data); pendingMovementId=data.id; $('savedAt').textContent='บันทึก '+fmtTime(data.occurred_at)+' แล้ว'; $('movementPanel').hidden=false; renderToday(); setStatus(''); };
$('skipMovementBtn').onclick=()=>{pendingMovementId=null;$('movementPanel').hidden=true;setStatus('บันทึกเวลาเรียบร้อยแล้ว')};

function renderMovementOptions(){ const html=detailTypes.map(k=>[k,types[k]]).map(([k,v])=>`<button class="chip" type="button" data-type="${k}">${v}</button>`).join(''); $('movementOptions').innerHTML=html; $('editMovementOptions').innerHTML=html; $('movementOptions').onclick=async e=>{const b=e.target.closest('[data-type]');if(!b||!pendingMovementId)return;if(await updateMovement(pendingMovementId,b.dataset.type)){pendingMovementId=null;$('movementPanel').hidden=true;setStatus('เพิ่มลักษณะการดิ้นแล้ว')}}; $('editMovementOptions').onclick=async e=>{const b=e.target.closest('[data-type]');if(!b||!editingId)return;if(await updateMovement(editingId,b.dataset.type)){$('editDialog').close();await refreshVisibleData()}}; }
async function updateMovement(id,type){ const {error}=await client.from('kick_events').update({movement_type:type}).eq('id',id).eq('pregnancy_id',pregnancy.id); if(error){setStatus('บันทึกลักษณะไม่สำเร็จ: '+error.message);return false} const ev=todayEvents.find(x=>x.id===id);if(ev)ev.movement_type=type;renderToday();return true }
$('undoBtn').onclick=async()=>{if(!todayEvents.length)return;const ev=todayEvents[0];if(!confirm(`ยกเลิกรายการ ${fmtTime(ev.occurred_at)} ใช่หรือไม่?`))return;if(await deleteEvent(ev.id))setStatus('ยกเลิกรายการล่าสุดแล้ว')};
async function deleteEvent(id){ const {error}=await client.from('kick_events').delete().eq('id',id).eq('pregnancy_id',pregnancy.id);if(error){setStatus('ลบไม่สำเร็จ: '+error.message);return false}todayEvents=todayEvents.filter(x=>x.id!==id);if(pendingMovementId===id){pendingMovementId=null;$('movementPanel').hidden=true}renderToday();return true }
function renderToday(){ $('todayCount').textContent=todayEvents.length;$('lastKick').textContent=todayEvents.length?fmtTime(todayEvents[0].occurred_at):'—';$('undoBtn').disabled=!todayEvents.length;$('emptyState').hidden=!!todayEvents.length;$('eventList').innerHTML=todayEvents.map(ev=>eventRow(ev,true)).join('');bindEventActions($('eventList')); }
function eventRow(ev,allowDelete=false){return `<div class="event" data-id="${ev.id}"><span class="time">${fmtTime(ev.occurred_at)}</span><span class="tag">${labelType(ev.movement_type)}</span><span class="event-actions"><button class="icon-btn edit">แก้ไข</button>${allowDelete?'':'<button class="icon-btn delete">ลบ</button>'}</span></div>`}
function bindEventActions(root){root.onclick=async e=>{const row=e.target.closest('.event');if(!row)return;const id=Number(row.dataset.id);if(e.target.closest('.edit'))openEdit(id);if(e.target.closest('.delete')&&confirm('ลบรายการนี้ใช่หรือไม่?')){if(await deleteEvent(id))await loadLogDate()}}}
function findEvent(id){return todayEvents.find(x=>x.id===id)||window.currentLogEvents?.find(x=>x.id===id)}
function openEdit(id){const ev=findEvent(id);if(!ev)return;editingId=id;$('editTime').textContent=fmtTime(ev.occurred_at)+' · '+labelType(ev.movement_type);document.querySelectorAll('#editMovementOptions .chip').forEach(x=>x.classList.toggle('active',x.dataset.type===ev.movement_type));$('editDialog').showModal()}
$('clearMovementBtn').onclick=async e=>{e.preventDefault();if(!editingId)return;if(await updateMovement(editingId,'movement')){$('editDialog').close();await refreshVisibleData()}};

function thaiShortDate(d){ return new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short'}).format(d) }
function historyDays(){
  return [0,1,2].map(offset=>{ const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-offset); return d; });
}
function configureHistoryAccess(){
  const date=$('logDate'); date.max=inputDate();
  if(isPlus()){ date.removeAttribute('min'); $('freeHistoryFooter').hidden=true; }
  else { date.min=inputDate(minFreeHistoryDate()); $('freeHistoryFooter').hidden=false; }
  renderQuickDays();
}
function renderQuickDays(){
  const selected=$('logDate').value;
  $('quickDays').innerHTML=historyDays().map((d,i)=>{
    const value=inputDate(d), title=i===0?'วันนี้':i===1?'เมื่อวาน':'2 วันที่แล้ว';
    return `<button type="button" class="quick-day ${selected===value?'active':''}" data-date="${value}"><span>${title}</span><strong>${thaiShortDate(d)}</strong><small id="quickCount${i}">— ครั้ง</small></button>`;
  }).join('');
  $('quickDays').onclick=async e=>{ const b=e.target.closest('[data-date]'); if(!b)return; $('logDate').value=b.dataset.date; renderQuickDays(); await loadLogDate(); };
  loadQuickDayCounts();
}
async function loadQuickDayCounts(){
  if(!pregnancy)return;
  const days=historyDays();
  await Promise.all(days.map(async(d,i)=>{
    const [start,end]=dayBounds(d);
    const {count,error}=await client.from('kick_events').select('id',{count:'exact',head:true}).eq('pregnancy_id',pregnancy.id).gte('occurred_at',start).lt('occurred_at',end);
    const el=$(`quickCount${i}`); if(el)el.textContent=error?'—':`${count||0} ครั้ง`;
  }));
}
$('logDate').onchange=async()=>{ renderQuickDays(); await loadLogDate(); };
async function loadLogDate(){
  const value=$('logDate').value || inputDate(); $('logDate').value=value;
  const d=dateFromInput(value);
  if(!isPlus()&&d<minFreeHistoryDate()){
    $('historyLocked').hidden=false;$('logCount').textContent='—';$('logEmpty').hidden=true;$('logList').innerHTML='';window.currentLogEvents=[];return;
  }
  $('historyLocked').hidden=true;
  const [start,end]=dayBounds(d);
  const {data,error}=await client.from('kick_events').select('id,occurred_at,movement_type,note,created_at').eq('pregnancy_id',pregnancy.id).gte('occurred_at',start).lt('occurred_at',end).order('occurred_at',{ascending:false});
  if(error){$('logList').innerHTML='<p class="error">'+error.message+'</p>';return}
  window.currentLogEvents=data||[];$('logCount').textContent=window.currentLogEvents.length;$('logEmpty').hidden=!!window.currentLogEvents.length;$('logList').innerHTML=window.currentLogEvents.map(ev=>eventRow(ev,false)).join('');bindEventActions($('logList'));
}

async function loadActivity(){ const [start,end]=dayBounds(); const {data,error}=await client.from('kick_events').select('occurred_at').eq('pregnancy_id',pregnancy.id).gte('occurred_at',start).lt('occurred_at',end).order('occurred_at'); if(error){$('activityMeta').textContent='โหลดกราฟไม่สำเร็จ: '+error.message;return} const counts=Array(24).fill(0);(data||[]).forEach(x=>counts[new Date(x.occurred_at).getHours()]++);const max=Math.max(1,...counts);$('activityChart').innerHTML=counts.map((n,h)=>`<div class="bar-wrap"><div class="bar" style="height:${n?Math.max(5,(n/max)*100):1}%" data-tip="${String(h).padStart(2,'0')}:00–${String(h).padStart(2,'0')}:59 · ${n} ครั้ง"></div></div>`).join('');$('activityMeta').textContent=(data||[]).length?`รวม ${(data||[]).length} รายการวันนี้`:'ยังไม่มีข้อมูลวันนี้'; }
async function refreshVisibleData(){await loadToday();if(!$('logsView').hidden)await loadLogDate();if(!$('activityView').hidden)await loadActivity()}
boot();
