/* ========== সাহায্যকারী ফাংশন ========== */
/* DB (ডাটা সেভ/লোড) এখন cloud.js ফাইলে আছে */
const sum = (a,f) => a.reduce((s,x) => s + (+x[f] || 0), 0);
const fmt = n => (+n || 0).toFixed(2);
const pad = n => String(n).padStart(2,'0');
const ymd = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const today = () => ymd(new Date());
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate()-n); return ymd(d); };
const bn = s => String(s).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);
const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s);
function esc(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function val(id){ return document.getElementById(id).value.trim(); }
function raw(id){ return document.getElementById(id).value; }

const cookCharge = () => +(DB.obj('settings',{cook:220}).cook) || 0;
function cookFor(m){
  if(m.off) return 0;
  if(m.cook !== undefined && m.cook !== null && m.cook !== '') return +m.cook || 0;
  return cookCharge();
}
function rateAll(){
  const m = sum(DB.get('meals'),'count');
  return m ? sum(DB.get('expenses'),'amount')/m : 0;
}
function memberOpts(){
  return DB.get('members').map(m => `<option value="${m.id}">${esc(m.name)}${m.room?' - '+esc(m.room):''}</option>`).join('');
}
function memName(id){ const m = DB.get('members').find(x => x.id === id); return m ? m.name : '-'; }
function memRoom(id){ const m = DB.get('members').find(x => x.id === id); return m && m.room ? m.room : '-'; }

/* সব সময়ের হিসাব (সদস্য অনুযায়ী) */
function allStats(){
  const rate = rateAll(), meals = DB.get('meals'), pay = DB.get('payments'), fines = DB.get('fines');
  return DB.get('members').map(m => {
    const dep = sum(pay.filter(p => p.memberId === m.id),'amount');
    const ml = sum(meals.filter(x => x.memberId === m.id),'count');
    const fn = sum(fines.filter(f => f.memberId === m.id),'amount');
    const cost = ml*rate, ck = cookFor(m);
    return {m, dep, ml, cost, ck, fn, bal: dep-cost-ck-fn};
  });
}

/* ========== ডাউনলোড ========== */
function csvCell(v){ return '"' + String(v).replace(/"/g,'""') + '"'; }
function downloadFile(name, text, type, bom){
  try{
    const blob = new Blob([(bom ? '\ufeff' : '') + text], {type: type+';charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }catch(e){ alert('ডাউনলোড হয়নি। Chrome ব্রাউজারে খুলে চেষ্টা করুন।'); }
}
function downloadCSV(name, head, rows){
  const text = [head].concat(rows).map(r => r.map(csvCell).join(',')).join('\r\n');
  downloadFile(name, text, 'text/csv', true);
}

/* ========== কমন UI অংশ ========== */
function head(t){ return `<div class="ptitle">${t}</div><div class="rb"></div>`; }
function tools(id){
  return `<div class="tools">
    <label>Show <select id="${id}N" onchange="filt('${id}')"><option>10</option><option>25</option><option>50</option><option>100</option></select> entries</label>
    <label>Search: <input id="${id}S" oninput="filt('${id}')"></label></div>`;
}
function filt(id){
  const n = document.getElementById(id+'N'), s = document.getElementById(id+'S');
  if(!n || !s) return;
  const lim = +n.value, q = s.value.toLowerCase();
  let shown = 0;
  document.querySelectorAll('#'+id+' tbody tr').forEach(tr => {
    if(tr.textContent.toLowerCase().includes(q) && shown < lim){ tr.style.display = ''; shown++; }
    else tr.style.display = 'none';
  });
}
function table(id, heads, rows, cols){
  const empty = `<tr><td colspan="${cols}">কোনো তথ্য নেই</td></tr>`;
  return `<div class="box">${tools(id)}<div class="tw"><table class="dt" id="${id}">
    <thead><tr>${heads.map(h => '<th>'+h+'</th>').join('')}</tr></thead>
    <tbody>${rows || empty}</tbody></table></div></div>`;
}
function toggleForm(id){
  const e = document.getElementById(id);
  e.style.display = e.style.display === 'none' ? 'block' : 'none';
}
function needMembers(title){
  return head(title) + '<div class="box">আগে "সদস্য" পেজ থেকে সদস্য যোগ করুন</div>';
}
function actBtns(k, idf, id){
  return `<button class="b-go" onclick="editAmt('${k}','${idf}',${id})">✏️ Edit</button>
          <button class="b-r" onclick="delRec('${k}','${idf}',${id})">🗑️ Delete</button>`;
}
function editAmt(k, idf, id){
  const list = DB.get(k), r = list.find(x => x[idf] === id); if(!r) return;
  const a = prompt('নতুন পরিমাণ', r.amount); if(a === null) return;
  const v = parseFloat(a);
  if(isNaN(v)){ alert('সঠিক সংখ্যা দিন'); return; }
  r.amount = v; DB.set(k, list); show(cur);
}
function delRec(k, idf, id){
  if(!confirm('মুছে ফেলবেন?')) return;
  DB.set(k, DB.get(k).filter(x => x[idf] !== id)); show(cur);
}

const pages = {};
let cur = 'dashboard';

/* ========== থিম (ডার্ক মোড) ========== */
function applyTheme(){
  const d = localStorage.getItem('dark') === '1';
  document.body.classList.toggle('dark', d);
  const b = document.getElementById('themeBtn');
  if(b) b.textContent = d ? '☀️' : '🌙';
}
function toggleTheme(){
  localStorage.setItem('dark', localStorage.getItem('dark') === '1' ? '0' : '1');
  applyTheme();
}

/* ========== ড্যাশবোর্ড (তারিখ ফিল্টারসহ) ========== */
let dFrom = daysAgo(6), dTo = today();
pages.dashboard = function(){
  const f = dFrom, t = dTo;
  const inR = a => a.filter(x => x.date >= f && x.date <= t);
  const exp = inR(DB.get('expenses')), meals = inR(DB.get('meals')),
        pay = inR(DB.get('payments')), dp = inR(DB.get('duepaid')), ck = inR(DB.get('cookpaid'));
  const total = sum(exp,'amount');
  const due = sum(exp.filter(e => e.type === 'due'),'amount');
  const cash = total - due;
  const tm = sum(meals,'count');
  const rate = tm ? total/tm : 0;
  const col = sum(pay,'amount');
  const dpaid = sum(dp,'amount');
  const cards = [
    [fmt(total),'মোট খরচ'],[fmt(cash),'নগদ খরচ'],
    [fmt(due),'বাকি খরচ'],[fmt(dpaid),'বাকি আদায়'],
    [tm,'মোট মিল'],[fmt(rate),'মিল রেট'],
    [fmt(col),'মোট সংগ্রহ'],[fmt(col-cash-dpaid-sum(ck,'amount')),'ক্যাশ']
  ];
  const def = (f === daysAgo(6) && t === today());
  return `<h2>${def ? 'লাস্ট ৭ দিনের মিল' : 'নির্বাচিত সময়ের মিল'}</h2>
    <div class="box">
      <div class="two">
        <div><label>শুরুর তারিখ</label><input id="rFrom" type="date" value="${f}"></div>
        <div><label>শেষ তারিখ</label><input id="rTo" type="date" value="${t}"></div>
      </div>
      <div class="two">
        <button class="btn" onclick="applyRange()">দেখুন</button>
        <button class="btn gray" onclick="resetRange()">লাস্ট ৭ দিন</button>
      </div>
    </div>
    <p class="sub">${f} থেকে ${t}</p>
    <div class="grid">${cards.map(c => `<div class="card"><h2>${c[0]}</h2><p>${c[1]}</p></div>`).join('')}</div>`;
};
function applyRange(){
  const f = val('rFrom'), t = val('rTo');
  if(!validDate(f) || !validDate(t)){ alert('দুটো তারিখই দিন'); return; }
  if(f > t){ alert('শুরুর তারিখ শেষ তারিখের আগে হতে হবে'); return; }
  dFrom = f; dTo = t; show('dashboard');
}
function resetRange(){ dFrom = daysAgo(6); dTo = today(); show('dashboard'); }

/* ========== সদস্য ========== */
pages.members = function(){
  const rows = allStats().map((s,i) => {
    const m = s.m;
    return `<tr><td>${i+1}</td><td>${esc(m.name)}</td><td>${esc(m.room||'-')}</td>
      <td>${fmt(s.dep)}</td><td>${s.ml}</td>
      <td>${fmt(s.cost)} + ${fmt(s.ck)} = ${fmt(s.cost+s.ck)}</td>
      <td>${fmt(s.fn)}</td>
      <td class="${s.bal<0?'neg':'pos'}">${fmt(s.bal)}</td>
      <td><span class="st ${m.off?'off':'on'}" onclick="togMember(${m.id})">${m.off?'off':'on'}</span></td>
      <td><button class="b-g" onclick="editMember(${m.id})">এডিট</button>
          <button class="b-p" onclick="infoMember(${m.id})">বিস্তারিত</button>
          <button class="b-r" onclick="delMember(${m.id})">ডিলিট</button></td></tr>`;
  }).join('');
  return head('মোট সদস্য সমূহ') + `
    <div class="acts"><button class="p" onclick="exportMembers()">সম্পূর্ণ রিপোর্ট ডাউনলোড</button>
      <button onclick="toggleForm('mf')">Add Member</button></div>
    <div id="mf" class="box" style="display:none">
      <h3>নতুন সদস্য</h3>
      <input id="mName" placeholder="নাম">
      <input id="mRoom" placeholder="রুম নম্বর">
      <input id="mPhone" placeholder="মোবাইল নম্বর">
      <button class="btn" onclick="addMember()">যোগ করুন</button>
    </div>` +
    table('mt',['ইউজার আইডি','নাম','রুম নম্বর','মোট জমা','মোট মিল','মিলের দাম ও রান্নার খরচ','জরিমানা','ব্যালেন্স','স্ট্যাটাস','অ্যাকশন'], rows, 10);
};
function exportMembers(){
  const hd = ['ইউজার আইডি','নাম','রুম','মোট জমা','মোট মিল','মিলের দাম','রান্নার খরচ','জরিমানা','ব্যালেন্স','স্ট্যাটাস'];
  const rows = allStats().map((s,i) => [i+1, s.m.name, s.m.room||'', fmt(s.dep), s.ml, fmt(s.cost), fmt(s.ck), fmt(s.fn), fmt(s.bal), s.m.off?'off':'on']);
  if(!rows.length){ alert('কোনো সদস্য নেই'); return; }
  downloadCSV('members-report-'+today()+'.csv', hd, rows);
}
function addMember(){
  const name = val('mName');
  if(!name){ alert('নাম লিখুন'); return; }
  const list = DB.get('members');
  list.push({id: Date.now(), name, room: val('mRoom'), phone: val('mPhone'), off: false});
  DB.set('members', list); show('members');
}
function editMember(id){
  const list = DB.get('members'), m = list.find(x => x.id === id); if(!m) return;
  const n = prompt('নাম', m.name); if(n === null) return;
  const r = prompt('রুম নম্বর', m.room||''); if(r === null) return;
  const p = prompt('মোবাইল', m.phone||''); if(p === null) return;
  m.name = n.trim() || m.name; m.room = r.trim(); m.phone = p.trim();
  DB.set('members', list); show('members');
}
function togMember(id){
  const list = DB.get('members'), m = list.find(x => x.id === id);
  if(m){ m.off = !m.off; DB.set('members', list); show('members'); }
}
function infoMember(id){
  const s = allStats().find(x => x.m.id === id); if(!s) return;
  alert(s.m.name+'\nরুম: '+(s.m.room||'-')+'\nমোবাইল: '+(s.m.phone||'-')+
    '\nজমা: '+fmt(s.dep)+'\nমিল: '+s.ml+'\nমিলের দাম: '+fmt(s.cost)+
    '\nরান্নার খরচ: '+fmt(s.ck)+'\nজরিমানা: '+fmt(s.fn)+
    '\nব্যালেন্স: '+fmt(s.bal));
}
function delMember(id){
  if(!confirm('মুছে ফেলবেন?')) return;
  DB.set('members', DB.get('members').filter(m => m.id !== id)); show('members');
}

/* ========== মিল লিস্ট (দিন/রাত গ্রিড) ========== */
let mMonth = today().slice(0,7);
const mcls = v => v === 0 ? 'z' : (v >= 2 ? 'y' : 'o');
pages.meals = function(){
  const members = DB.get('members');
  if(!members.length) return needMembers('মিল লিস্ট');
  const [y,mo] = mMonth.split('-').map(Number);
  const days = new Date(y,mo,0).getDate();
  const wd = ['রবি','সোম','মঙ্গল','বুধ','বৃহস্পতি','শুক্র','শনি'];
  const map = {};
  DB.get('meals').filter(x => x.date && x.date.startsWith(mMonth)).forEach(x => {
    const k = x.memberId+'|'+x.date+'|'+(x.slot === 'n' ? 'n' : 'd');
    map[k] = (map[k]||0) + (+x.count||0);
  });
  let h1 = '<tr><th rowspan="2" class="fc">নাম</th>', h2 = '<tr>';
  for(let d=1; d<=days; d++){
    h1 += `<th colspan="2">${bn(pad(d))}-${wd[new Date(y,mo-1,d).getDay()]}</th>`;
    h2 += '<th>দিন</th><th>রাত</th>';
  }
  h1 += '<th rowspan="2">মোট</th></tr>'; h2 += '</tr>';
  const rows = members.map(m => {
    let tds = '', tot = 0;
    for(let d=1; d<=days; d++){
      const date = mMonth+'-'+pad(d);
      ['d','n'].forEach(s => {
        const v = map[m.id+'|'+date+'|'+s] || 0;
        tot += v;
        tds += `<td class="mc ${mcls(v)}" data-m="${m.id}" data-d="${date}" data-s="${s}">${v}</td>`;
      });
    }
    return `<tr><td class="fc">${esc(m.name)}${m.room?'-'+esc(m.room):''}</td>${tds}<td id="tot${m.id}"><b>${tot}</b></td></tr>`;
  }).join('');
  return head('মিল লিস্ট') + `
    <div class="box"><input type="month" value="${mMonth}" onchange="if(this.value){mMonth=this.value;show('meals')}">
      <p class="sub">ঘরে ট্যাপ করলে মিল বদলাবে (০→১→২→৩→৪→০)। লাল = ০, হলুদ = ২ বা বেশি।</p></div>
    <div class="tw"><table class="mg"><thead>${h1}${h2}</thead><tbody>${rows}</tbody></table></div>`;
};
document.addEventListener('click', e => {
  const c = e.target.closest ? e.target.closest('td.mc') : null;
  if(!c) return;
  const mid = +c.dataset.m, date = c.dataset.d, slot = c.dataset.s;
  const v = (+c.textContent + 1) % 5;
  const list = DB.get('meals').filter(x =>
    !(x.memberId === mid && x.date === date && (x.slot === 'n' ? 'n' : 'd') === slot));
  if(v > 0) list.push({id: Date.now()+Math.random(), memberId: mid, date, slot, count: v});
  DB.set('meals', list);
  c.textContent = v; c.className = 'mc ' + mcls(v);
  let t = 0;
  c.parentNode.querySelectorAll('td.mc').forEach(x => t += +x.textContent);
  document.getElementById('tot'+mid).innerHTML = '<b>'+t+'</b>';
});

/* ========== মিল মাইগ্রেশন ও ব্যাকআপ ========== */
pages.migrate = function(){
  return head('মিল মাইগ্রেশন') + `
    <div class="box"><h3>এক তারিখের মিল অন্য তারিখে কপি</h3>
      <label>যে তারিখ থেকে</label><input id="mgFrom" type="date" value="${daysAgo(1)}">
      <label>যে তারিখে</label><input id="mgTo" type="date" value="${today()}">
      <button class="btn" onclick="copyMeals()">কপি করুন</button></div>
    <div class="box"><h3>মাসের সব মিল মুছুন</h3>
      <input id="mgMonth" type="month" value="${today().slice(0,7)}">
      <button class="btn red" onclick="clearMonth()">মুছে ফেলুন</button></div>
    <div class="box"><h3>ব্যাকআপ / রিস্টোর</h3>
      <p class="sub">নিয়মিত ব্যাকআপ রাখুন। ফাইল ডাউনলোড না হলে নিচের লেখাটা কপি করে নোটে রাখুন।</p>
      <button class="btn" onclick="downloadBackup()">ব্যাকআপ ফাইল ডাউনলোড</button>
      <button class="btn gray" onclick="doBackup()">ব্যাকআপ লেখা আকারে দেখান</button>
      <textarea id="bk" rows="5" placeholder="ব্যাকআপ এখানে আসবে / রিস্টোরের লেখা এখানে বসান"></textarea>
      <button class="btn" onclick="doRestore()">লেখা থেকে রিস্টোর</button>
      <label>অথবা ব্যাকআপ ফাইল বেছে নিন</label>
      <input type="file" accept=".json,application/json" onchange="restoreFile(this)"></div>`;
};
function copyMeals(){
  const f = val('mgFrom'), t = val('mgTo');
  if(!f || !t || f === t){ alert('দুটো আলাদা তারিখ দিন'); return; }
  const all = DB.get('meals');
  const src = all.filter(x => x.date === f);
  if(!src.length){ alert('ওই তারিখে কোনো মিল নেই'); return; }
  const rest = all.filter(x => x.date !== t);
  src.forEach(x => rest.push({id: Date.now()+Math.random(), memberId: x.memberId, date: t, slot: x.slot, count: x.count}));
  DB.set('meals', rest);
  alert('কপি হয়েছে: '+src.length+' টি এন্ট্রি');
}
function clearMonth(){
  const m = val('mgMonth');
  if(!m) return;
  if(!confirm(m+' মাসের সব মিল মুছে যাবে। নিশ্চিত?')) return;
  DB.set('meals', DB.get('meals').filter(x => !(x.date && x.date.startsWith(m))));
  alert('মুছে ফেলা হয়েছে');
}
const KEYS = ['members','meals','payments','expenses','duepaid','cookpaid','fines'];
function backupObj(){
  const o = {};
  KEYS.forEach(k => o[k] = DB.get(k));
  o.settings = DB.obj('settings',{cook:220});
  return o;
}
function doBackup(){ document.getElementById('bk').value = JSON.stringify(backupObj()); }
function downloadBackup(){
  downloadFile('villa-backup-'+today()+'.json', JSON.stringify(backupObj()), 'application/json', false);
}
function applyBackup(text){
  try{
    const o = JSON.parse(text);
    if(typeof o !== 'object' || o === null || Array.isArray(o)) throw 0;
    if(!confirm('বর্তমান সব তথ্য বদলে যাবে। নিশ্চিত?')) return;
    KEYS.forEach(k => DB.set(k, Array.isArray(o[k]) ? o[k] : []));
    if(o.settings && typeof o.settings === 'object') DB.set('settings', o.settings);
    alert('রিস্টোর হয়েছে'); show('dashboard');
  }catch(e){ alert('ব্যাকআপের লেখাটা ঠিক নেই'); }
}
function doRestore(){ applyBackup(raw('bk')); }
function restoreFile(inp){
  const f = inp.files && inp.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = () => applyBackup(String(r.result));
  r.readAsText(f);
}

/* ========== পেমেন্ট ========== */
pages.payments = function(){
  const members = DB.get('members');
  if(!members.length) return needMembers('জমার বিস্তারিত');
  const pay = DB.get('payments').sort((a,b) => b.date.localeCompare(a.date) || b.no - a.no);
  const rows = pay.map(p => `<tr><td>${p.no}</td><td>${esc(memName(p.memberId))}</td><td>${esc(memRoom(p.memberId))}</td>
    <td>${fmt(p.amount)}</td><td>${p.date}</td><td>${esc(p.receiver||'-')}</td><td>${actBtns('payments','no',p.no)}</td></tr>`).join('');
  return head('জমার বিস্তারিত') + `
    <div class="acts"><button onclick="toggleForm('pf')">টাকা জমা দিন</button></div>
    <div id="pf" class="box" style="display:none">
      <h3>টাকা জমা</h3>
      <select id="pMember">${memberOpts()}</select>
      <input id="pAmount" type="number" placeholder="পরিমাণ">
      <input id="pDate" type="date" value="${today()}">
      <input id="pRecv" placeholder="রিসিভার">
      <button class="btn" onclick="addPay()">জমা করুন</button>
    </div>` +
    table('pt',['পেমেন্ট আইডি','নাম','রুম নম্বর','পরিমাণ','তারিখ','রিসিভার','অ্যাকশন'], rows, 7) +
    `<div class="tot">মোট জমা: ${fmt(sum(pay,'amount'))}</div>`;
};
function addPay(){
  const amount = parseFloat(val('pAmount')), date = val('pDate');
  if(isNaN(amount) || amount <= 0){ alert('পরিমাণ লিখুন'); return; }
  if(!date){ alert('তারিখ দিন'); return; }
  const list = DB.get('payments');
  const no = list.reduce((a,p) => Math.max(a, p.no||0), 0) + 1;
  list.push({no, memberId: +val('pMember'), amount, date, receiver: val('pRecv')});
  DB.set('payments', list); show('payments');
}

/* ========== বাজার ========== */
pages.expenses = function(){
  const list = DB.get('expenses').sort((a,b) => b.date.localeCompare(a.date) || b.id - a.id);
  const rows = list.map((x,i) => `<tr><td>${i+1}</td><td>${x.date}</td><td>${esc(x.item)}</td>
    <td>${fmt(x.amount)}</td><td>${x.type === 'due' ? 'বাকি' : 'নগদ'}</td><td>${esc(x.by||'-')}</td>
    <td>${actBtns('expenses','id',x.id)}</td></tr>`).join('');
  const total = sum(list,'amount'), due = sum(list.filter(x => x.type === 'due'),'amount');
  return head('বাজার খরচ') + `
    <div class="acts"><button onclick="toggleForm('ef')">বাজার যোগ করুন</button></div>
    <div id="ef" class="box" style="display:none">
      <h3>নতুন বাজার</h3>
      <input id="eDate" type="date" value="${today()}">
      <input id="eItem" placeholder="বাজারের বিবরণ (যেমন: চাল, মাছ)">
      <input id="eAmount" type="number" placeholder="টাকা">
      <select id="eType"><option value="cash">নগদ</option><option value="due">বাকি</option></select>
      <input id="eBy" placeholder="কে বাজার করেছে">
      <button class="btn" onclick="addExp()">সেভ করুন</button>
    </div>` +
    table('et',['#','তারিখ','বিবরণ','টাকা','ধরন','বাজারকারী','অ্যাকশন'], rows, 7) +
    `<div class="tot">মোট: ${fmt(total)} | নগদ: ${fmt(total-due)} | বাকি: ${fmt(due)}</div>`;
};
function addExp(){
  const amount = parseFloat(val('eAmount')), date = val('eDate');
  if(!date){ alert('তারিখ দিন'); return; }
  if(isNaN(amount) || amount <= 0){ alert('টাকার পরিমাণ লিখুন'); return; }
  const list = DB.get('expenses');
  list.push({id: Date.now(), date, item: val('eItem') || '-', amount, type: val('eType'), by: val('eBy')});
  DB.set('expenses', list); show('expenses');
}

/* ========== বাকি পরিশোধ ========== */
pages.dues = function(){
  const list = DB.get('duepaid').sort((a,b) => b.date.localeCompare(a.date) || b.id - a.id);
  const dueTotal = sum(DB.get('expenses').filter(e => e.type === 'due'),'amount');
  const paid = sum(list,'amount');
  const rows = list.map((x,i) => `<tr><td>${i+1}</td><td>${x.date}</td><td>${esc(x.name)}</td>
    <td>${fmt(x.amount)}</td><td>${actBtns('duepaid','id',x.id)}</td></tr>`).join('');
  return head('বাকি পরিশোধ') + `
    <div class="grid" style="margin-bottom:14px">
      <div class="card" style="background:linear-gradient(135deg,#a855f7,#7c3aed)"><h2>${fmt(dueTotal)}</h2><p>মোট বাকি</p></div>
      <div class="card" style="background:linear-gradient(135deg,#14b8a6,#06b6d4)"><h2>${fmt(paid)}</h2><p>পরিশোধ</p></div>
    </div>
    <div class="box"><h3>বাকি আছে</h3><h2 class="${dueTotal-paid>0?'neg':'pos'}">${fmt(dueTotal-paid)}</h2></div>
    <div class="acts"><button onclick="toggleForm('df')">বাকি পরিশোধ করুন</button></div>
    <div id="df" class="box" style="display:none">
      <h3>বাকি পরিশোধ</h3>
      <input id="dDate" type="date" value="${today()}">
      <input id="dName" placeholder="কাকে দেওয়া হলো (দোকান/ব্যক্তি)">
      <input id="dAmount" type="number" placeholder="টাকা">
      <button class="btn" onclick="addDue()">সেভ করুন</button>
    </div>` +
    table('dt2',['#','তারিখ','কাকে','টাকা','অ্যাকশন'], rows, 5);
};
function addDue(){
  const amount = parseFloat(val('dAmount')), date = val('dDate');
  if(!date){ alert('তারিখ দিন'); return; }
  if(isNaN(amount) || amount <= 0){ alert('টাকার পরিমাণ লিখুন'); return; }
  const list = DB.get('duepaid');
  list.push({id: Date.now(), date, name: val('dName') || '-', amount});
  DB.set('duepaid', list); show('dues');
}

/* ========== রান্নার খরচ ========== */
pages.cooks = function(){
  const all = DB.get('members');
  const cc = cookCharge();
  const needTotal = all.reduce((s,m) => s + cookFor(m), 0);
  const list = DB.get('cookpaid').sort((a,b) => b.date.localeCompare(a.date) || b.id - a.id);
  const paid = sum(list,'amount');

  const mrows = all.map((m,i) => {
    const custom = (m.cook !== undefined && m.cook !== null && m.cook !== '');
    return `<tr><td>${i+1}</td><td>${esc(m.name)}</td><td>${esc(m.room||'-')}</td>
      <td><span class="st ${m.off?'off':'on'}">${m.off?'off':'on'}</span></td>
      <td>${fmt(cookFor(m))}${custom && !m.off ? ' ✏️' : ''}</td>
      <td><button class="b-go" onclick="editMemberCook(${m.id})">✏️ Edit</button>
          ${custom ? `<button class="b-r" onclick="resetMemberCook(${m.id})">রিসেট</button>` : ''}</td></tr>`;
  }).join('');

  const prows = list.map((x,i) => `<tr><td>${i+1}</td><td>${x.date}</td><td>${esc(x.name)}</td>
    <td>${fmt(x.amount)}</td>
    <td><button class="b-go" onclick="editCook(${x.id})">✏️ Edit</button>
        <button class="b-r" onclick="delRec('cookpaid','id',${x.id})">🗑️ Delete</button></td></tr>`).join('');

  return head('রান্নার খরচ পরিশোধ') + `
    <div class="box"><h3>সবার জন্য সাধারণ রান্নার খরচ</h3>
      <input id="ccAmt" type="number" value="${cc}">
      <button class="btn" onclick="saveCook()">সেভ করুন</button>
      <p class="sub" style="margin-top:8px">কারও জন্য আলাদা অঙ্ক না দিলে এই অঙ্কই ধরা হবে।</p></div>
    <div class="grid" style="margin-bottom:14px">
      <div class="card" style="background:linear-gradient(135deg,#f97316,#ef4444)"><h2>${fmt(needTotal)}</h2><p>মোট রান্নার খরচ</p></div>
      <div class="card" style="background:linear-gradient(135deg,#22c55e,#16a34a)"><h2>${fmt(paid)}</h2><p>পরিশোধ</p></div>
    </div>
    <div class="box"><h3>বাকি আছে</h3><h2 class="${needTotal-paid>0?'neg':'pos'}">${fmt(needTotal-paid)}</h2></div>
    <h3 style="margin:6px 4px;color:#7c3aed">সদস্য অনুযায়ী রান্নার খরচ</h3>` +
    table('cmt',['#','নাম','রুম','স্ট্যাটাস','রান্নার খরচ','অ্যাকশন'], mrows, 6) +
    `<div class="acts"><button onclick="toggleForm('cf')">খরচ পরিশোধ করুন</button></div>
    <div id="cf" class="box" style="display:none">
      <h3>রাঁধুনিকে পরিশোধ</h3>
      <input id="cDate" type="date" value="${today()}">
      <input id="cName" placeholder="রাঁধুনির নাম">
      <input id="cAmount" type="number" placeholder="টাকা">
      <button class="btn" onclick="addCook()">সেভ করুন</button>
    </div>
    <h3 style="margin:6px 4px;color:#7c3aed">পরিশোধের তালিকা</h3>` +
    table('ct',['#','তারিখ','রাঁধুনি','টাকা','অ্যাকশন'], prows, 5);
};
function saveCook(){
  const v = parseFloat(val('ccAmt'));
  if(isNaN(v) || v < 0){ alert('সঠিক সংখ্যা দিন'); return; }
  DB.set('settings', {cook: v});
  show('cooks');
}
function editMemberCook(id){
  const list = DB.get('members'), m = list.find(x => x.id === id); if(!m) return;
  const now = (m.cook !== undefined && m.cook !== null && m.cook !== '') ? m.cook : cookCharge();
  const a = prompt(m.name+' এর রান্নার খরচ (ফাঁকা রাখলে সাধারণ খরচ ধরা হবে)', now);
  if(a === null) return;
  if(a.trim() === ''){ delete m.cook; }
  else {
    const v = parseFloat(a);
    if(isNaN(v) || v < 0){ alert('সঠিক সংখ্যা দিন'); return; }
    m.cook = v;
  }
  DB.set('members', list); show('cooks');
}
function resetMemberCook(id){
  const list = DB.get('members'), m = list.find(x => x.id === id); if(!m) return;
  delete m.cook; DB.set('members', list); show('cooks');
}
function addCook(){
  const amount = parseFloat(val('cAmount')), date = val('cDate');
  if(!date){ alert('তারিখ দিন'); return; }
  if(isNaN(amount) || amount <= 0){ alert('টাকার পরিমাণ লিখুন'); return; }
  const list = DB.get('cookpaid');
  list.push({id: Date.now(), date, name: val('cName') || '-', amount});
  DB.set('cookpaid', list); show('cooks');
}
function editCook(id){
  const list = DB.get('cookpaid'), x = list.find(r => r.id === id); if(!x) return;
  const d = prompt('তারিখ (YYYY-MM-DD)', x.date); if(d === null) return;
  if(!validDate(d.trim())){ alert('তারিখ এভাবে লিখুন: 2026-11-25'); return; }
  const n = prompt('রাঁধুনির নাম', x.name); if(n === null) return;
  const a = prompt('টাকা', x.amount); if(a === null) return;
  const v = parseFloat(a);
  if(isNaN(v) || v <= 0){ alert('সঠিক টাকা দিন'); return; }
  x.date = d.trim(); x.name = n.trim() || '-'; x.amount = v;
  DB.set('cookpaid', list); show('cooks');
}

/* ========== জরিমানা ========== */
pages.fines = function(){
  const members = DB.get('members');
  if(!members.length) return needMembers('জরিমানা');
  const list = DB.get('fines').sort((a,b) => b.date.localeCompare(a.date) || b.id - a.id);
  const rows = list.map((x,i) => `<tr><td>${i+1}</td><td>${x.date}</td><td>${esc(memName(x.memberId))}</td>
    <td>${esc(memRoom(x.memberId))}</td><td>${fmt(x.amount)}</td><td>${esc(x.reason||'-')}</td>
    <td>${actBtns('fines','id',x.id)}</td></tr>`).join('');
  return head('জরিমানা') + `
    <div class="acts"><button onclick="toggleForm('ff')">জরিমানা যোগ করুন</button></div>
    <div id="ff" class="box" style="display:none">
      <h3>নতুন জরিমানা</h3>
      <select id="fMember">${memberOpts()}</select>
      <input id="fDate" type="date" value="${today()}">
      <input id="fAmount" type="number" placeholder="টাকা">
      <input id="fReason" placeholder="কারণ">
      <button class="btn" onclick="addFine()">সেভ করুন</button>
    </div>` +
    table('ft',['#','তারিখ','নাম','রুম','টাকা','কারণ','অ্যাকশন'], rows, 7) +
    `<div class="tot">মোট জরিমানা: ${fmt(sum(list,'amount'))}</div>`;
};
function addFine(){
  const amount = parseFloat(val('fAmount')), date = val('fDate');
  if(!date){ alert('তারিখ দিন'); return; }
  if(isNaN(amount) || amount <= 0){ alert('টাকার পরিমাণ লিখুন'); return; }
  const list = DB.get('fines');
  list.push({id: Date.now(), memberId: +val('fMember'), date, amount, reason: val('fReason')});
  DB.set('fines', list); show('fines');
}

/* ========== মাসিক রিপোর্ট ========== */
let rMonth = today().slice(0,7);
function reportData(m){
  const inM = x => x.date && x.date.startsWith(m);
  const exp = DB.get('expenses').filter(inM), meals = DB.get('meals').filter(inM),
        pay = DB.get('payments').filter(inM), fines = DB.get('fines').filter(inM);
  const totalExp = sum(exp,'amount'), totalMeals = sum(meals,'count');
  const rate = totalMeals ? totalExp/totalMeals : 0;
  const rows = DB.get('members').map(mem => {
    const ml = sum(meals.filter(x => x.memberId === mem.id),'count');
    const dep = sum(pay.filter(x => x.memberId === mem.id),'amount');
    const fn = sum(fines.filter(x => x.memberId === mem.id),'amount');
    const cost = ml*rate, ck = cookFor(mem);
    return {name: mem.name, room: mem.room || '-', meals: ml, dep, cost, ck, fn, bal: dep-cost-ck-fn};
  });
  return {rows, totalExp, totalMeals, rate};
}
pages.report = function(){
  const d = reportData(rMonth);
  const tot = k => d.rows.reduce((s,r) => s + r[k], 0);
  const body = d.rows.map((r,i) => `<tr><td>${i+1}</td><td>${esc(r.name)}</td><td>${esc(r.room)}</td>
    <td>${r.meals}</td><td>${fmt(r.dep)}</td><td>${fmt(r.cost)}</td><td>${fmt(r.ck)}</td><td>${fmt(r.fn)}</td>
    <td class="${r.bal<0?'neg':'pos'}">${fmt(r.bal)}</td></tr>`).join('')
    || '<tr><td colspan="9">কোনো সদস্য নেই</td></tr>';
  const foot = d.rows.length ? `<tfoot><tr><td></td><td>মোট</td><td></td><td>${tot('meals')}</td>
    <td>${fmt(tot('dep'))}</td><td>${fmt(tot('cost'))}</td><td>${fmt(tot('ck'))}</td><td>${fmt(tot('fn'))}</td>
    <td>${fmt(tot('bal'))}</td></tr></tfoot>` : '';
  return head('মাসিক রিপোর্ট — '+rMonth) + `
    <div class="box noprint"><input type="month" value="${rMonth}" onchange="if(this.value){rMonth=this.value;show('report')}">
      <button class="btn" onclick="exportReport()">CSV / Excel ডাউনলোড</button>
      <button class="btn gray" onclick="window.print()">প্রিন্ট / PDF</button></div>
    <div class="box"><h3>এই মাসের সারাংশ</h3>
      <p>মোট বাজার খরচ: <b>${fmt(d.totalExp)}</b></p>
      <p>মোট মিল: <b>${d.totalMeals}</b></p>
      <p>মিল রেট: <b>${fmt(d.rate)}</b></p></div>
    <div class="box"><div class="tw"><table class="dt" id="rt">
      <thead><tr><th>#</th><th>নাম</th><th>রুম</th><th>মিল</th><th>জমা</th><th>মিলের দাম</th><th>রান্নার খরচ</th><th>জরিমানা</th><th>ব্যালেন্স</th></tr></thead>
      <tbody>${body}</tbody>${foot}</table></div></div>
    <p class="sub">এই রিপোর্টে শুধু নির্বাচিত মাসের বাজার, মিল, জমা ও জরিমানা ধরা হয়েছে।</p>`;
};
function exportReport(){
  const d = reportData(rMonth);
  if(!d.rows.length){ alert('কোনো সদস্য নেই'); return; }
  const hd = ['#','নাম','রুম','মিল','জমা','মিলের দাম','রান্নার খরচ','জরিমানা','ব্যালেন্স'];
  const rows = d.rows.map((r,i) => [i+1, r.name, r.room, r.meals, fmt(r.dep), fmt(r.cost), fmt(r.ck), fmt(r.fn), fmt(r.bal)]);
  const t = k => d.rows.reduce((s,r) => s + r[k], 0);
  rows.push(['','মোট','',t('meals'),fmt(t('dep')),fmt(t('cost')),fmt(t('ck')),fmt(t('fn')),fmt(t('bal'))]);
  rows.push([]);
  rows.push(['','মোট বাজার',fmt(d.totalExp),'','মিল রেট',fmt(d.rate)]);
  downloadCSV('report-'+rMonth+'.csv', hd, rows);
}

/* ========== পেজ দেখানো ও মেনু ========== */
const names = {dashboard:'ড্যাশবোর্ড',members:'সদস্য',meals:'মিল লিস্ট',migrate:'মিল মাইগ্রেশন',
  payments:'পেমেন্ট',expenses:'বাজার',dues:'বাকি পরিশোধ',cooks:'রান্নার খরচ',fines:'জরিমানা',report:'মাসিক রিপোর্ট'};

function show(p){
  cur = p;
  document.getElementById('title').textContent = names[p];
  document.getElementById('main').innerHTML = pages[p]();
  document.querySelectorAll('table.dt').forEach(t => filt(t.id));
  document.getElementById('sidebar').classList.remove('open');
  window.scrollTo(0,0);
}
function start(){
  document.getElementById('lock').style.display = 'none';
  show('dashboard');
}

document.getElementById('menuBtn').onclick = () =>
  document.getElementById('sidebar').classList.toggle('open');
document.querySelectorAll('#sidebar a[data-page]').forEach(a =>
  a.onclick = () => show(a.dataset.page));

if('serviceWorker' in navigator && location.protocol.indexOf('http') === 0){
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

cloudBoot();