// ═══════════════════════════════════════════════════════════
// AUTH — Autoryzacja, rodzina, zaproszenia
// ═══════════════════════════════════════════════════════════

// ── Zaproszenia do rodziny ────────────────────────────────────────────────────
async function showInviteModal(){
  const html=`<div style="text-align:center;padding:10px 0">
    <div style="font-size:13px;color:var(--text-2);margin-bottom:16px">Wygeneruj kod zaproszenia dla członka rodziny. Kod jest ważny 7 dni.</div>
    <div id="invite_code_display" style="font-size:28px;font-weight:800;color:var(--text);letter-spacing:4px;background:var(--bg);border:2px solid #6366f133;border-radius:12px;padding:16px;margin-bottom:12px">—</div>
    <button onclick="generateAndShowCode()" style="padding:10px 24px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">🎲 Generuj kod</button>
    <div id="invite_code_copy" style="margin-top:10px;font-size:12px;color:var(--text-3)"></div>
  </div>`;
  openModal({title:'🔗 Zaproś do rodziny', html, submitLabel:'Zamknij', onSubmit:()=>true});
}

async function generateAndShowCode(){
  try{
    const code=await generateInviteCode();
    const el=document.getElementById('invite_code_display');
    const info=document.getElementById('invite_code_copy');
    if(el) el.textContent=code;
    if(info) info.textContent='Podaj ten kod osobie którą chcesz zaprosić';
    navigator.clipboard?.writeText(code);
  }catch(e){
    alert('Błąd: '+e.message);
  }
}

// ── Auth UI ───────────────────────────────────────────────────────────────────
function showAuthScreen(panel){
  ['auth_login','auth_register','auth_family'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.style.display=id==='auth_'+panel?'block':'none';
  });
  document.getElementById('lock-screen').classList.remove('hidden');
  // Focus na email
  setTimeout(()=>{
    const em=document.getElementById(panel==='login'?'auth_email':panel==='register'?'reg_email':'fam_name');
    if(em) em.focus();
  },100);
}

function showFamilySetup(){
  showAuthScreen('family');
}

async function handleLogin(){
  const email=document.getElementById('auth_email').value.trim();
  const pass=document.getElementById('auth_pass').value;
  const err=document.getElementById('auth_err');
  const btn=document.getElementById('auth_login_btn');
  if(!email||!pass){err.textContent='Wypełnij email i hasło';return;}
  btn.textContent='Logowanie...'; btn.disabled=true;
  try{
    await authSignIn(email,pass);
    window._currentUser=(await _sb.auth.getUser()).data.user;
    window._currentFamilyId=await getMyFamily();
    if(!_currentFamilyId){ showFamilySetup(); return; }
    // Pobierz rolę usera w rodzinie
    try{
      const mem=await sbFetch('kt_family_members?family_id=eq.'+_currentFamilyId+'&user_id=eq.'+_currentUser.id);
      window._currentRole=(Array.isArray(mem)&&mem[0]?.role)||'member';
    }catch(e){ window._currentRole='member'; }
    document.getElementById('lock-screen').classList.add('hidden');
    sessionStorage.setItem('kt_auth','1');
    await initialSync();
    render();
    setTimeout(initRealtime, 1000);
    setTimeout(autoBackup,3000);
  }catch(e){
    err.textContent=e.message==='Invalid login credentials'?'Nieprawidłowy email lub hasło':e.message;
    btn.textContent='Zaloguj się →'; btn.disabled=false;
  }
}

async function handleRegister(){
  const email=document.getElementById('reg_email').value.trim();
  const pass=document.getElementById('reg_pass').value;
  const invite=document.getElementById('reg_invite').value.trim();
  const err=document.getElementById('reg_err');
  const btn=document.getElementById('reg_btn');
  if(!email||!pass){err.textContent='Wypełnij email i hasło';return;}
  if(pass.length<6){err.textContent='Hasło musi mieć min. 6 znaków';return;}
  btn.textContent='Rejestracja...'; btn.disabled=true;
  try{
    await authSignUp(email,pass);
    // Zaloguj od razu
    await authSignIn(email,pass);
    window._currentUser=(await _sb.auth.getUser()).data.user;
    // Jeśli ma kod zaproszenia - dołącz do rodziny
    if(invite){
      window._currentFamilyId=await joinFamily(invite);
      document.getElementById('lock-screen').classList.add('hidden');
      sessionStorage.setItem('kt_auth','1');
      await initialSync();
      render();
      setTimeout(initRealtime, 1000);
    } else {
      showFamilySetup();
    }
  }catch(e){
    err.textContent=e.message;
    btn.textContent='Zarejestruj się →'; btn.disabled=false;
  }
}

async function handleSolo(){
  const btn = document.querySelector('[onclick="handleSolo()"]');
  const err = document.getElementById('fam_err');
  if(btn){ btn.textContent='Tworzę konto...'; btn.disabled=true; }
  try{
    // Utwórz prywatną rodzinę z emailem usera jako nazwą
    const email = _currentUser?.email || 'solo';
    const name = email.split('@')[0]; // np. "jan.kowalski"
    _currentFamilyId = await createFamily(name+'_solo');
    document.getElementById('lock-screen').classList.add('hidden');
    sessionStorage.setItem('kt_auth','1');
    await initialSync();
    render();
    setTimeout(initRealtime, 1000);
  } catch(e){
    if(err) err.textContent = 'Błąd: ' + e.message;
    if(btn){ btn.textContent='👤 Używaj solo (tylko dla mnie)'; btn.disabled=false; }
  }
}

async function handleCreateFamily(){
  const name=document.getElementById('fam_name').value.trim()||'Moja rodzina';
  const err=document.getElementById('fam_err');
  try{
    window._currentFamilyId=await createFamily(name);
    document.getElementById('lock-screen').classList.add('hidden');
    sessionStorage.setItem('kt_auth','1');
    await initialSync();
    render();
  }catch(e){
    err.textContent=e.message;
  }
}

async function handleJoinFamily(){
  const code=document.getElementById('fam_invite').value.trim();
  const err=document.getElementById('fam_err');
  if(!code){err.textContent='Wpisz kod zaproszenia';return;}
  try{
    window._currentFamilyId=await joinFamily(code);
    window._currentRole=null; // wymusza ponowne pobranie roli w initialSync
    document.getElementById('lock-screen').classList.add('hidden');
    sessionStorage.setItem('kt_auth','1');
    await initialSync();
    render();
  }catch(e){
    err.textContent=e.message;
  }
}

// ══════════════════════════════════════════════════════════════
// AUTH — Logowanie, rejestracja, rodzina
// ══════════════════════════════════════════════════════════════

async function authSignIn(email, password){
  if(!_sb) throw new Error('Supabase SDK nie załadowany');
  const {data,error} = await _sb.auth.signInWithPassword({email,password});
  if(error) throw new Error(error.message);
  return data;
}

async function authSignUp(email, password){
  if(!_sb) throw new Error('Supabase SDK nie załadowany');
  const {data,error} = await _sb.auth.signUp({email,password});
  if(error) throw new Error(error.message);
  return data;
}

async function authSignOut(){
  if(_sb) await _sb.auth.signOut();
  window._currentUser=null;
  window._currentFamilyId=null;
  window._currentRole=null;
  S.players=[]; S.agencies=[]; S.profiles=[];
  S.contests=[]; S.entries=[]; S.receipts=[];
  sessionStorage.removeItem('kt_auth');
  showAuthScreen('login');
}

async function getMyFamily(){
  try{
    // Użyj Supabase JS client - ma automatyczny token auth
    if(_sb){
      const {data,error} = await _sb
        .from('kt_family_members')
        .select('family_id')
        .eq('user_id', _currentUser.id)
        .limit(1);
      if(!error && data && data.length) return data[0].family_id;
    }
    // Fallback przez REST
    const session = (await _sb.auth.getSession()).data.session;
    const token = session ? session.access_token : SB_KEY;
    const res = await fetch(SB_URL+'/rest/v1/kt_family_members?user_id=eq.'+_currentUser.id+'&select=family_id&limit=1',{
      headers:{'apikey':SB_KEY,'Authorization':'Bearer '+token}
    });
    const rows = await res.json();
    if(rows&&rows.length) return rows[0].family_id;
    return null;
  }catch(e){ console.warn('getMyFamily error:',e.message); return null; }
}

async function createFamily(name){
  // Utwórz rodzinę - użyj Prefer: return=representation
  const res = await fetch(SB_URL+'/rest/v1/kt_families', {
    method:'POST',
    headers:{
      'apikey':SB_KEY,
      'Authorization':'Bearer '+((_sb?(await _sb.auth.getSession()).data.session?.access_token:null)||SB_KEY),
      'Content-Type':'application/json',
      'Prefer':'return=representation'
    },
    body: JSON.stringify({name, owner_id:_currentUser.id})
  });
  if(!res.ok){ const t=await res.text(); throw new Error('Błąd tworzenia rodziny: '+t); }
  const fam = await res.json();
  const famId = Array.isArray(fam)?fam[0]?.id:fam?.id;
  if(!famId) throw new Error('Brak ID rodziny w odpowiedzi');
  // Dodaj siebie jako właściciela
  await sbFetch('kt_family_members', {
    method:'POST',
    body: JSON.stringify({family_id:famId, user_id:_currentUser.id, role:'owner'})
  });
  return famId;
}

async function joinFamily(code){
  // Znajdź zaproszenie
  const invites = await sbFetch('kt_invites?code=eq.'+encodeURIComponent(code)+'&used_by=is.null');
  if(!invites||!invites.length) throw new Error('Nieprawidłowy lub wygasły kod zaproszenia');
  const invite = invites[0];
  if(new Date(invite.expires_at)<new Date()) throw new Error('Kod zaproszenia wygasł');
  // Dołącz do rodziny
  await sbFetch('kt_family_members', {
    method:'POST',
    body: JSON.stringify({family_id:invite.family_id, user_id:_currentUser.id, role:'member'})
  });
  // Oznacz zaproszenie jako użyte
  await sbFetch('kt_invites?id=eq.'+invite.id, {
    method:'PATCH',
    body: JSON.stringify({used_by:_currentUser.id, used_at:new Date().toISOString()})
  });
  return invite.family_id;
}

async function generateInviteCode(){
  const code = Math.random().toString(36).slice(2,8).toUpperCase()+
               Math.random().toString(36).slice(2,6).toUpperCase();
  await sbFetch('kt_invites', {
    method:'POST',
    body: JSON.stringify({family_id:_currentFamilyId, code, created_by:_currentUser.id})
  });
  return code;
}

async function initAuth(){
  if(!_sb){ showAuthScreen('login'); return; }
  // Sprawdź czy jest aktywna sesja
  const {data:{session}} = await _sb.auth.getSession();
  if(!session){ showAuthScreen('login'); return; }
  _currentUser = session.user;
  // Pobierz family_id
  _currentFamilyId = await getMyFamily();
  if(!_currentFamilyId){
    showFamilySetup();
    return;
  }
  // Zalogowany i ma rodzinę — wczytaj dane
  document.getElementById('lock-screen').classList.add('hidden');
  sessionStorage.setItem('kt_auth','1');
  await initialSync();
  render();
  setTimeout(initRealtime, 1000);
  setTimeout(autoBackup, 3000);
}

// Nasłuchuj zmian sesji
if(_sb){
  _sb.auth.onAuthStateChange((event, session)=>{
    if(event==='SIGNED_OUT'){
      showAuthScreen('login');
    }
  });
}

// — eksport na window (onclick= compatibility)
Object.assign(window, {showInviteModal, generateAndShowCode, showAuthScreen, showFamilySetup, handleLogin, handleRegister, handleSolo, handleCreateFamily, handleJoinFamily, authSignIn, authSignUp, authSignOut, getMyFamily, createFamily, joinFamily, generateInviteCode, initAuth});
