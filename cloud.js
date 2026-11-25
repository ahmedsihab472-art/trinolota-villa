/* ===== ১) এখানে নিজের Firebase মান বসান ===== */
const firebaseConfig = {
  apiKey: "AIzaSyCsQX1gy-7JK60QM6Dy1Lv97CmC3VC-4Jc",
  authDomain: "trinolota-villa.firebaseapp.com",
  projectId: "trinolota-villa",
  appId: "1:332027492327:web:5464929cdcb1931426af42"
};
const OWNER_EMAIL = "ahmedsihab472@gmail.com"; // আপনার Gmail (ছোট হাতের অক্ষরে)

/* ===== নিচের অংশ বদলানোর দরকার নেই ===== */
firebase.initializeApp(firebaseConfig);
const fauth = firebase.auth();
const fdb = firebase.firestore();
let CAN_EDIT = false;

const DB = {
  cache: {},
  get(k){
    const v = this.cache[k];
    return Array.isArray(v) ? JSON.parse(JSON.stringify(v)) : [];
  },
  obj(k, d){
    const v = this.cache[k];
    return (v && !Array.isArray(v)) ? v : d;
  },
  set(k, v){
    if(!CAN_EDIT){ alert('শুধু অ্যাডমিন বদলাতে পারবেন। আগে "এডমিন লগইন" করুন।'); return; }
    const clean = JSON.parse(JSON.stringify(v));
    this.cache[k] = clean;
    fdb.collection('villa').doc(k).set({v: clean})
      .catch(e => alert('সেভ হয়নি: ' + e.message));
  }
};

async function loadAll(){
  const snap = await fdb.collection('villa').get();
  snap.forEach(d => { DB.cache[d.id] = d.data().v; });
}

function setAdminBtn(){
  const b = document.getElementById('logout');
  b.style.display = 'block';
  b.textContent = CAN_EDIT ? '🔒 লগআউট' : '🔑 এডমিন লগইন';
  document.body.classList.toggle('viewer', !CAN_EDIT);
}

function cloudBoot(){
  applyTheme();
  document.getElementById('lock').style.display = 'none';
  document.getElementById('logout').onclick = async () => {
    try{
      if(CAN_EDIT) await fauth.signOut();
      else await fauth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    }catch(e){ alert('লগইন হয়নি: ' + e.message); }
  };
  fauth.onAuthStateChanged(async u => {
    CAN_EDIT = !!(u && u.email && u.email.toLowerCase() === OWNER_EMAIL.toLowerCase());
    if(u && !CAN_EDIT){ alert('এই Gmail-এর এডিটের অনুমতি নেই'); fauth.signOut(); }
    try{ await loadAll(); }catch(e){ alert('ডাটা আনা যায়নি: ' + e.message); }
    start();
    setAdminBtn();
  });
}