import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

/* Replace these values with Firebase Console > Project settings > Your apps. */
const firebaseConfig = {
    apiKey: "AIzaSyB64tohKFFfGHOjjTdZllqmaYCiidapr1M",
    authDomain: "studydashboard-38413.firebaseapp.com",
    projectId: "studydashboard-38413",
    storageBucket: "studydashboard-38413.firebasestorage.app",
    messagingSenderId: "1032179775217",
    appId: "1:1032179775217:web:0a60ae6c3a17f53f7a1b50",
    measurementId: "G-QXD52Y9EJV"
  };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = (id) => document.getElementById(id);
// GitHub Pages configuration: the JSON file is public. Never use a key here
// that you need to keep secret. For real privacy, move Groq calls to a backend.
const GROQ_KEY_STORAGE = "studyhub_groq_key";
async function getGroqKey() {
    let key = localStorage.getItem(GROQ_KEY_STORAGE);
    if (key) return key;
    const response = await fetch(new URL("./api/index.json", import.meta.url), { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load api/index.json (HTTP " + response.status + ").");
    const config = await response.json();
    if (!config.apiKey || config.apiKey === "PASTE_YOUR_GROQ_API_KEY_HERE") throw new Error("Add your Groq API key to api/index.json first.");
    key = String(config.apiKey).trim();
    localStorage.setItem(GROQ_KEY_STORAGE, key);
    return key;
}
async function askGroq(messages) {
    const apiKey = await getGroqKey();
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
            model: "openai/gpt-oss-120b",
            messages: [{ role: "system", content: "You are JARVIS Lite, a helpful study assistant. Explain concepts clearly, use readable Markdown, and provide Mermaid flowcharts when useful.The flowcharts should be a simple representation of the concept being explained not a random images." }, ...messages],
            temperature: 0.7,
            max_tokens: 2048
        })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || `Groq request failed (${response.status}).`);
    return data.choices?.[0]?.message?.content || "I couldn't generate a response.";
}

const state = { user:null, isSignup:false, day:"Monday", timetable:[], activity:[], chat:[], unsubTimetable:null, unsubActivity:null, busy:false };
const weekdays = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const fallbackSchedule = {
  Monday:[], Tuesday:[], Wednesday:[], Thursday:[], Friday:[], Saturday:[], Sunday:[]
};
let toastTimer;
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600);}
function safeText(value=""){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function dateKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;}
function formatDate(value){const d=value?.toDate?value.toDate():new Date(value);return d.toLocaleString(undefined,{day:"numeric",month:"short",hour:"numeric",minute:"2-digit"});}
function showView(name){$("authView").classList.toggle("hidden",name!=="auth");$("appView").classList.toggle("hidden",name!=="app");}
function page(name){document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===`page-${name}`));document.querySelectorAll(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.page===name));const titles={overview:"Overview",timetable:"Timetable",activity:"My activity",jarvis:"JARVIS Lite"};$("pageHeading").textContent=titles[name]||"Overview";$("sidebar").classList.remove("open");}
function renderUser(user){$("userName").textContent=user.displayName||user.email?.split("@")[0]||"Student";$("userEmail").textContent=user.email||"";const avatar=user.photoURL||`https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName||"Student")}&background=20364f&color=dcecff`;$("userAvatar").src=avatar;$("topAvatar").src=avatar;}
function updateDate(){const d=new Date();$("dateDay").textContent=d.toLocaleDateString(undefined,{weekday:"short"}).toUpperCase();$("dateNumber").textContent=d.getDate();$("dateMonth").textContent=d.toLocaleDateString(undefined,{month:"long",year:"numeric"}).toUpperCase();$("todayLabel").textContent=d.toLocaleDateString(undefined,{weekday:"long"}).toUpperCase()+" · YOUR STUDY OVERVIEW";}
function getSessions(day){return state.timetable.filter(x=>x.day===day).sort((a,b)=>(a.start||"").localeCompare(b.start||""));}
function sessionTime(s){return `${s.start||""}${s.end?` – ${s.end}`:""}`;}
function isDone(s){return state.activity.some(a=>a.sessionId===s.id&&a.dateKey===dateKey());}
function sessionMarkup(s){const done=isDone(s);return `<div class="schedule-row"><div class="schedule-time">${safeText(sessionTime(s))}</div><div class="schedule-line"></div><div class="schedule-info"><b>${safeText(s.subject||"Study session")}</b><small>${safeText(s.topic||s.description||"Planned study session")}</small></div><button class="session-check ${done?"done":""}" data-session="${safeText(s.id)}" aria-label="${done?"Completed":"Mark complete"}" ${done?"disabled":""}>✓</button></div>`;}
function renderSchedule(){const today=weekdays[new Date().getDay()];const todays=getSessions(today);$("todaySchedule").innerHTML=todays.length?todays.slice(0,5).map(sessionMarkup).join(""):`<div class="empty-state">No sessions added for ${today}. The shared timetable can be populated in Firestore.</div>`;const sessions=getSessions(state.day);$("selectedDayLabel").textContent=state.day.toUpperCase();$("fullSchedule").innerHTML=sessions.length?sessions.map(sessionMarkup).join(""):`<div class="empty-state">No sessions planned for ${state.day} yet.</div>`;document.querySelectorAll(".session-check:not(:disabled)").forEach(btn=>btn.addEventListener("click",()=>completeSession(btn.dataset.session)));}
function renderActivity(){const today=state.activity.filter(a=>a.dateKey===dateKey());const total=state.activity.length;const percent=state.timetable.length?Math.round(today.length/Math.max(1,getSessions(weekdays[new Date().getDay()]).length)*100):0;$("completedStat").textContent=today.length;$("progressStat").textContent=`${Math.min(100,percent)}%`;$("progressBar").style.width=`${Math.min(100,percent)}%`;$("totalStat").textContent=total;$("activityTotal").textContent=total;$("weekTotal").textContent=state.activity.filter(a=>{const d=a.createdAt?.toDate?a.createdAt.toDate():new Date(a.createdAt||0);return (Date.now()-d.getTime())<7*86400000;}).length;const rows=state.activity.slice().sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));$("activityHistory").innerHTML=rows.length?rows.map(a=>`<div class="history-row"><i class="history-dot"></i><div><b>${safeText(a.subject||"Study session")}</b><small>${safeText(a.day||"")} · ${safeText(a.time||"")}</small></div><time>${safeText(a.dateKey||"")}</time></div>`).join(""):`<div class="empty-state">Your completed sessions will appear here.</div>`;$("recentActivity").innerHTML=rows.length?rows.slice(0,4).map(a=>`<div class="recent-row"><div><b>${safeText(a.subject||"Study session")}</b><small>${safeText(a.day||"")} · ${safeText(a.dateKey||"")}</small></div><span class="done-label">COMPLETED ✓</span></div>`).join(""):`<div class="empty-state">No activity yet. Complete a timetable session to get started.</div>`;}
async function completeSession(sessionId){const s=state.timetable.find(x=>x.id===sessionId);if(!s||isDone(s)||!state.user)return;try{await addDoc(collection(db,"users",state.user.uid,"activity"),{sessionId:s.id,subject:s.subject||"Study session",day:s.day,time:sessionTime(s),dateKey:dateKey(),createdAt:serverTimestamp()});toast("Session recorded in your activity.");}catch(e){console.error(e);toast("Could not record activity. Check your connection.");}}
function subscribeData(user){if(state.unsubTimetable)state.unsubTimetable();if(state.unsubActivity)state.unsubActivity();const timetableRef=doc(db,"config","timetable");state.unsubTimetable=onSnapshot(timetableRef,snap=>{const data=snap.exists()?snap.data():{};state.timetable=Array.isArray(data.sessions)?data.sessions:[];renderSchedule();renderActivity();},err=>{console.error(err);toast("Unable to load shared timetable.");});const activityRef=collection(db,"users",user.uid,"activity");state.unsubActivity=onSnapshot(query(activityRef,orderBy("createdAt","desc"),limit(250)),snap=>{state.activity=snap.docs.map(d=>({id:d.id,...d.data()}));renderSchedule();renderActivity();},err=>{console.error(err);toast("Unable to load your activity.");});}
async function ensureProfile(user){const ref=doc(db,"users",user.uid);const snap=await getDoc(ref);if(!snap.exists())await setDoc(ref,{displayName:user.displayName||"",email:user.email||"",photoURL:user.photoURL||"",createdAt:serverTimestamp()});}
async function handleAuth(user){if(user){state.user=user;renderUser(user);showView("app");page("overview");updateDate();try{await ensureProfile(user);subscribeData(user);}catch(e){console.error(e);toast("Profile setup needs attention.");}}else{state.user=null;if(state.unsubTimetable)state.unsubTimetable();if(state.unsubActivity)state.unsubActivity();showView("auth");}}
$("googleBtn").addEventListener("click",async()=>{try{await signInWithPopup(auth,new GoogleAuthProvider());}catch(e){if(["auth/popup-blocked","auth/popup-closed-by-user"].includes(e.code)){try{await signInWithRedirect(auth,new GoogleAuthProvider());}catch(err){$("authError").textContent=err.message;}}else $("authError").textContent=e.message;}});
getRedirectResult(auth).catch(e=>{$("authError").textContent=e.message;});
$("authModeBtn").addEventListener("click",()=>{state.isSignup=!state.isSignup;$("authModeText").textContent=state.isSignup?"Already have an account?":"New to Study Hub?";$("authModeBtn").textContent=state.isSignup?"Sign in":"Create account";$("emailBtn").innerHTML=state.isSignup?'Create account <span>→</span>':'Sign in <span>→</span>';});
$("authForm").addEventListener("submit",async e=>{e.preventDefault();$("authError").textContent="";const email=$("emailInput").value.trim(),password=$("passwordInput").value;$("emailBtn").disabled=true;try{if(state.isSignup)await createUserWithEmailAndPassword(auth,email,password);else await signInWithEmailAndPassword(auth,email,password);}catch(err){$("authError").textContent=err.code==="auth/invalid-credential"?"Incorrect email or password.":err.message;}finally{$("emailBtn").disabled=false;}});
$("signOutBtn").addEventListener("click",()=>signOut(auth).catch(e=>toast(e.message)));
document.querySelectorAll(".nav-item").forEach(n=>n.addEventListener("click",()=>page(n.dataset.page)));
document.querySelectorAll("[data-goto]").forEach(n=>n.addEventListener("click",()=>page(n.dataset.goto)));
$("dayTabs").addEventListener("click",e=>{const btn=e.target.closest("[data-day]");if(!btn)return;state.day=btn.dataset.day;document.querySelectorAll(".day-tab").forEach(x=>x.classList.toggle("active",x===btn));renderSchedule();});
$("menuBtn").addEventListener("click",()=>$("sidebar").classList.add("open"));$("closeSidebar").addEventListener("click",()=>$("sidebar").classList.remove("open"));
function addMessage(role,content){const wrap=document.createElement("div");wrap.className=role==="user"?"user-message":"assistant-message";const avatar=document.createElement("div");avatar.className=role==="user"?"message-avatar":"message-avatar";avatar.textContent=role==="user"?"Y":"✳";const body=document.createElement("div");body.className="message-body";if(role==="assistant"){const label=document.createElement("b");label.textContent="JARVIS LITE";body.appendChild(label);}const contentEl=document.createElement("div");contentEl.className="rendered-content";if(role==="assistant"){const raw=marked.parse(content||"");contentEl.innerHTML=DOMPurify.sanitize(raw,{USE_PROFILES:{html:true}});contentEl.querySelectorAll("pre code.language-mermaid").forEach(code=>{const box=document.createElement("div");box.className="mermaid";box.textContent=code.textContent;code.parentElement.replaceWith(box);});}else{const p=document.createElement("p");p.textContent=content;contentEl.appendChild(p);}body.appendChild(contentEl);wrap.append(avatar,body);$("chatMessages").appendChild(wrap);if(role==="assistant"){const diagrams=wrap.querySelectorAll(".mermaid");if(diagrams.length)mermaid.run({nodes:diagrams}).catch(console.warn);} $("chatMessages").scrollTop=$("chatMessages").scrollHeight;return wrap;}
async function sendChat(text){if(!text.trim()||state.busy)return;state.busy=true;addMessage("user",text);state.chat.push({role:"user",content:text});$("chatInput").value="";$("sendChat").disabled=true;const typing=document.createElement("div");typing.className="typing";typing.textContent="JARVIS is thinking...";$("chatMessages").appendChild(typing);$("chatMessages").scrollTop=$("chatMessages").scrollHeight;try{const answer=await askGroq(state.chat.slice(-12));typing.remove();addMessage("assistant",answer);state.chat.push({role:"assistant",content:answer});}catch(e){typing.remove();console.error(e);addMessage("assistant",`I couldn't connect right now. ${e.message||"Please try again in a moment."}`);}finally{state.busy=false;$("sendChat").disabled=false;$("chatInput").focus();}}
$("chatForm").addEventListener("submit",e=>{e.preventDefault();sendChat($("chatInput").value);});
$("chatInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("chatForm").requestSubmit();}});
$("chatInput").addEventListener("input",()=>{const el=$("chatInput");el.style.height="auto";el.style.height=Math.min(el.scrollHeight,120)+"px";});
$("chatMessages").addEventListener("click",e=>{const b=e.target.closest(".suggestions button");if(b)sendChat(b.textContent);});
$("clearChat").addEventListener("click",()=>{state.chat=[];$("chatMessages").innerHTML='<div class="assistant-message"><div class="message-avatar">✳</div><div class="message-body"><b>JARVIS Lite</b><p>Chat cleared. What shall we work on?</p></div></div>';});
mermaid.initialize({startOnLoad:false,theme:"dark",securityLevel:"strict",themeVariables:{background:"#0b1420",primaryColor:"#18314a",primaryTextColor:"#eaf3ff",lineColor:"#75b5ff",secondaryColor:"#15283b",tertiaryColor:"#101b29"}});
onAuthStateChanged(auth,handleAuth);
setTimeout(()=>$("splash").classList.add("done"),3000);
