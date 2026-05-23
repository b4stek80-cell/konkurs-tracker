// ═══════════════════════════════════════════════════════════
// AI IMPORT
// ═══════════════════════════════════════════════════════════
aiState={step:'input',error:'',extracted:null,form:{}};

async function fetchPageText(url){
  const r=await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
  if(!r.ok) throw new Error('Nie udało się pobrać strony');
  const data=await r.json();
  if(!data.contents) throw new Error('Strona zwróciła pustą odpowiedź');
  return data.contents.replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<[^>]+>/g,' ').replace(/\s{2,}/g,' ').trim().slice(0,14000);
}

// Robust JSON parser - handles truncated/malformed Gemini responses
function parseGeminiJSON(raw){
  // 1. Strip markdown fences and leading/trailing whitespace
  let s = raw.replace(/```json[\s\S]*?```/g, m => m.slice(7,-3))
             .replace(/```/g,'').trim();

  // 2. Extract JSON — wykryj czy to tablica [...] czy obiekt {...}
  const firstBracket = s.indexOf('[');
  const firstBrace = s.indexOf('{');
  let isArray = false;
  let start = -1;
  if(firstBracket >= 0 && (firstBrace < 0 || firstBracket < firstBrace)){
    isArray = true;
    start = firstBracket;
  } else if(firstBrace >= 0){
    start = firstBrace;
  }
  if(start < 0){
    return extractFieldsFallback(s);
  }
  s = s.slice(start);
  const end = isArray ? s.lastIndexOf(']') : s.lastIndexOf('}');
  if(end >= 0) s = s.slice(0, end+1);

  // 3. Try direct parse
  try{ return JSON.parse(s); } catch(e){}

  // 4. Fix common Gemini JSON issues:
  let fixed = s
    // single-quoted keys/values -> double quotes
    .replace(/([{,]\s*)'([^']+)'(\s*:)/g, '$1"$2"$3')
    .replace(/(:\s*)'([^']*)'(\s*[,}])/g, '$1"$2"$3')
    // trailing commas before } or ]
    .replace(/,\s*([}\]])/g, '$1')
    // unquoted keys  (word: ) -> "word":
    .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3')
    // remove JS comments
    .replace(/\/\/[^\n]*/g,'')
    .replace(/\/\*[\s\S]*?\*\//g,'');

  try{ return JSON.parse(fixed); } catch(e){}

  // 5. Fix truncated JSON - close open strings and braces
  let inStr=false, esc=false, depth=0;
  for(let i=0;i<fixed.length;i++){
    const c=fixed[i];
    if(esc){esc=false;continue;}
    if(c==='\\'){esc=true;continue;}
    if(c==='"'){inStr=!inStr;continue;}
    if(!inStr&&c==='{') depth++;
    if(!inStr&&c==='}') depth--;
  }
  if(inStr) fixed+='"';
  // Domknij tablicę jeśli trzeba
  let sqDepth=0; inStr=false; esc=false;
  for(let i=0;i<fixed.length;i++){
    const ch=fixed[i];
    if(esc){esc=false;continue;}
    if(ch==='\\'){esc=true;continue;}
    if(ch==='"'){inStr=!inStr;continue;}
    if(!inStr&&ch==='[') sqDepth++;
    if(!inStr&&ch===']') sqDepth--;
  }
  fixed = fixed.replace(/,\s*$/, '');
  for(let i=0;i<Math.max(0,depth);i++) fixed+='}';
  for(let i=0;i<Math.max(0,sqDepth);i++) fixed+=']';

  try{ return JSON.parse(fixed); } catch(e){}
  // Ostatnia próba dla tablicy obiektów — wyciągnij każdy {...} osobno
  if(fixed.trim().startsWith('[')){
    const objs=[];
    let d=0,st=-1,iS=false,eS=false;
    for(let i=0;i<fixed.length;i++){
      const ch=fixed[i];
      if(eS){eS=false;continue;}
      if(ch==='\\'){eS=true;continue;}
      if(ch==='"'){iS=!iS;continue;}
      if(iS) continue;
      if(ch==='{'){ if(d===0)st=i; d++; }
      if(ch==='}'){ d--; if(d===0&&st>=0){ try{objs.push(JSON.parse(fixed.slice(st,i+1)));}catch(e){} st=-1; } }
    }
    if(objs.length) return objs;
  }

  // 6. Last resort: regex extraction
  return extractFieldsFallback(s);
}

function extractFieldsFallback(s){
  const get=(k)=>{
    // Try double-quoted
    let m=s.match(new RegExp('"'+k+'"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"'));
    if(m) return m[1];
    // Try single-quoted
    m=s.match(new RegExp("'"+k+"'\\s*:\\s*'([^']*)'"));
    if(m) return m[1];
    // Try unquoted value (for null/dates)
    m=s.match(new RegExp('"'+k+'"\\s*:\\s*([^,}\\n]+)'));
    if(m){ const v=m[1].trim(); return v==='null'?null:v.replace(/^["']|["']$/g,''); }
    return '';
  };
  return {
    name: get('name'),
    agency: get('agency'),
    prize: get('prize'),
    deadline: get('deadline')||null,
    conditions: get('conditions'),
    link: get('link')||'',
    status: 'active',
    notes: get('notes')
  };
}

const GEMINI_PROMPT = (url) =>
  `Jesteś ekspertem od analizy regulaminów konkursów. Wyciągnij TYLKO kluczowe dane. Bądź ZWIĘZŁY.`+
  `Przeanalizuj ${url?'stronę: '+url:'poniższy tekst'}.`+
  `NAME: oficjalna nazwa konkursu/loterii (max 80 znaków).`+
  `AGENCY: nazwa agencji/organizatora (szukaj: organizator, obsługuje, prowadzi — tylko nazwa firmy bez adresu).`+
  `PRIZE: nazwa nagrody głównej (max 60 znaków).`+
  `PRIZE_VALUE: kwota nagrody, np. "10000 zł brutto".`+
  `DEADLINE: OSTATNI DZIEŃ zgłoszeń w formacie YYYY-MM-DD (szukaj: do dnia, termin, ostatni dzień przyjmowania zgłoszeń).`+
  `RESULTS_DATE: data ogłoszenia wyników w formacie YYYY-MM-DD (szukaj: rozstrzygnięcie nastąpi, wyniki zostaną ogłoszone, laureaci zostaną wyłonieni, wyłonienie laureatów, ogłoszenie wyników). Pusty string jeśli brak.`+
  `CONDITIONS: 1 zdanie — wiek + co kupić + gdzie zgłosić (max 120 znaków).`+
  `ENTRY_LIMIT: ile razy można się zgłosić (np. "10/dzień z jednego IP", "bez limitu", "1 na zakup").`+
  `REQUIRES_PURCHASE: "TAK - [co kupić i za ile]" lub "NIE".`+
  `SELECTION_METHOD: jury/losowanie/głosowanie.`+
  `TAX_INFO: "organizator płaci" lub "uczestnik płaci" lub pusty string.`+
  `SHOPS: znajdź paragraf "Sklepy konkursowe" lub "Sklep konkursowy" (zwykle punkt 2.X regulaminu) i wyciągnij z niego nazwy sieci/sklepów. Przykład: "sklepy stacjonarne sieci Auchan" → wpisz "Auchan". "sklepy Biedronka i Carrefour" → wpisz "Biedronka, Carrefour". Uwaga: w PDF tekst może mieć dodatkowe spacje między literami — ignoruj je. Zostaw PUSTE jeśli zakup w dowolnym sklepie lub brak konkretnych sieci lub nie ma wymogu zakupu.`+
  `ENTRY_LINK: adres URL strony do zgłoszeń (szukaj: strona internetowa konkursu, www., zgłoszenia pod adresem, formularz dostępny na). Przepisz pełny URL z https://.`+
  `TASK: dokładna treść zadania konkursowego — pytanie/polecenie do wykonania przez uczestnika, przepisz dosłownie (max 300 znaków). Pusty string jeśli loteria.`+
  `NOTES: 1-2 zdania — luki w regulaminie, dodatkowe szanse, uwagi dla łowcy nagród.`+
  `Jeśli czegoś nie ma — pusty string. NIE przepisuj całych akapitów.`;

// Tryb tekstowy – Flash-Lite (darmowy, szybki)
async function analyzeWithGemini(apiKey,text,url){
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      contents:[{parts:[{text:GEMINI_PROMPT(url)+'\n\nTEKST:\n'+text}]}],
      generationConfig:{
        temperature:0.1,maxOutputTokens:4096,
        responseMimeType:"application/json",
        responseSchema:{
        type:"OBJECT",
        properties:{
          name:{type:"STRING"},
          agency:{type:"STRING"},
          prize:{type:"STRING"},
          prize_value:{type:"STRING"},
          deadline:{type:"STRING"},
          conditions:{type:"STRING"},
          entry_limit:{type:"STRING"},
          requires_purchase:{type:"STRING"},
          selection_method:{type:"STRING"},
          tax_info:{type:"STRING"},
          notes:{type:"STRING"},
          shops:{type:"STRING"},
          entry_link:{type:"STRING"},
          task:{type:"STRING"},
          results_date:{type:"STRING"}
        },
        required:["name","agency","prize","prize_value","deadline","conditions","entry_limit","requires_purchase","selection_method","tax_info","notes","shops","entry_link","task","results_date"]
      }
      }
    })
  });
  if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e?.error?.message||`Błąd Gemini (${r.status})`);}
  const data=await r.json();
  const raw=data.candidates?.[0]?.content?.parts?.[0]?.text||'';
  return parseGeminiJSON(raw);
}

// Tryb OCR/Vision – Flash (obsługuje pliki PDF/obrazy)
async function analyzeWithGeminiVision(apiKey, pdfBase64){
  const visionPrompt=
    'Przeczytaj DOKŁADNIE cały ten regulamin i wyciagnij ponizsze dane.'+
    'NAME: oficjalna nazwa konkursu (max 80 znaków).'+
    'AGENCY: nazwa agencji organizatora (tylko nazwa firmy).'+
    'PRIZE: nazwa nagrody glownej (max 60 znaków).'+
    'PRIZE_VALUE: kwota nagrody.'+
    'DEADLINE: ostatni dzien zgloszen YYYY-MM-DD (szukaj: do dnia, termin przyjmowania zgloszen).'+
    'RESULTS_DATE: data ogłoszenia wynikow YYYY-MM-DD (szukaj: rozstrzygniecie nastapi, wyniki zostana ogloszone, laureaci zostana wylonieni). Pusty string jesli brak.'+
    'CONDITIONS: 1 zdanie — wiek + co kupic + gdzie zglosic (max 120 znaków).'+
    'ENTRY_LIMIT: ile razy mozna sie zglosic (np. "10/dzien z IP", "bez limitu").'+
    'REQUIRES_PURCHASE: "TAK - co kupic" lub "NIE".'+
    'SELECTION_METHOD: jury/losowanie/glosowanie.'+
    'TAX_INFO: "organizator placi" lub "uczestnik placi" lub pusty string.'+
    'SHOPS: znajdz paragraf Sklepy konkursowe lub Sklep konkursowy (zwykle punkt 2.X) i wyciagnij nazwy sieci. Przyklad: sklepy stacjonarne sieci Auchan = wpisz Auchan, sklepy Biedronka i Lidl = wpisz Biedronka, Lidl. Tekst moze miec podwojne spacje - ignoruj je i czytaj nazwy normalnie. Pusty string tylko gdy dowolny sklep lub brak wymogu zakupu.'+
    'ENTRY_LINK: URL strony do zgloszen (szukaj: strona internetowa konkursu, www., formularz, adres: — przepisz pelny URL z https:// lub www.).'+
    'TASK: dokladna tresc zadania konkursowego — pytanie/polecenie, przepisz dokladnie (max 300 znakow). Pusty string jesli loteria.'+
    'NOTES: 1-2 zdania — luki i szanse dla lowcy nagrod.'+
    'Jesli czegos nie ma — pusty string.';

  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      contents:[{parts:[
        {inline_data:{mime_type:'application/pdf',data:pdfBase64}},
        {text:visionPrompt}
      ]}],
      generationConfig:{
        temperature:0.1,maxOutputTokens:4096,
        responseMimeType:"application/json",
        responseSchema:{
        type:"OBJECT",
        properties:{
          name:{type:"STRING"},
          agency:{type:"STRING"},
          prize:{type:"STRING"},
          prize_value:{type:"STRING"},
          deadline:{type:"STRING"},
          conditions:{type:"STRING"},
          entry_limit:{type:"STRING"},
          requires_purchase:{type:"STRING"},
          selection_method:{type:"STRING"},
          tax_info:{type:"STRING"},
          notes:{type:"STRING"},
          shops:{type:"STRING"},
          entry_link:{type:"STRING"},
          task:{type:"STRING"},
          results_date:{type:"STRING"}
        },
        required:["name","agency","prize","prize_value","deadline","conditions","entry_limit","requires_purchase","selection_method","tax_info","notes","shops","entry_link","task","results_date"]
      }
      }
    })
  });
  if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e?.error?.message||`Błąd Gemini Vision (${r.status})`);}
  const data=await r.json();
  const raw=data.candidates?.[0]?.content?.parts?.[0]?.text||'';
  const obj=parseGeminiJSON(raw);
  obj.status='active'; obj.link=obj.link||'';
  return obj;
}

function renderAI(){
  const savedKey=localStorage.getItem(KEYS.geminiKey)||'';
  return `
    <h1 style="font-size:22px;font-weight:800;color:#f1f5f9;margin-bottom:6px">🤖 Dodaj konkurs z AI</h1>
    <div style="background:#0a0e1a;border:1px solid #1a73e833;border-radius:10px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#94a3b8;line-height:1.7">
      <strong style="color:#60a5fa">Jak to działa:</strong> podaj źródło regulaminu → Gemini AI wypełni formularz automatycznie.<br>
      <span style="color:#475569">Klucz API pobierz za darmo na <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:#60a5fa">aistudio.google.com</a> · Flash-Lite 2.5 = 1000 req/dzień za darmo</span>
    </div>
    <div class="field"><label>Klucz API Google Gemini</label>
      <input type="password" id="ai_key" value="${esc(savedKey)}" placeholder="AIzaSy..." oninput="localStorage.setItem('${KEYS.geminiKey}',this.value)">
    </div>

    <!-- Zakładki źródła -->
    <div style="display:flex;gap:0;margin-bottom:16px;border:1px solid #2d3548;border-radius:10px;overflow:hidden">
      <button id="aitab_url" onclick="aiTab('url')" style="flex:1;padding:10px 6px;font-size:13px;font-weight:600;border:none;border-radius:0;background:#6366f1;color:#fff;cursor:pointer">🔗 URL</button>
      <button id="aitab_pdf" onclick="aiTab('pdf')" style="flex:1;padding:10px 6px;font-size:13px;font-weight:600;border:none;border-left:1px solid #2d3548;border-radius:0;background:#1e2a3a;color:#64748b;cursor:pointer">📄 PDF</button>
      <button id="aitab_txt" onclick="aiTab('txt')" style="flex:1;padding:10px 6px;font-size:13px;font-weight:600;border:none;border-left:1px solid #2d3548;border-radius:0;background:#1e2a3a;color:#64748b;cursor:pointer">📋 Tekst</button>
    </div>

    <!-- Panel URL -->
    <div id="aipanel_url">
      <div class="field"><label>URL regulaminu / strony konkursu</label>
        <input type="url" id="ai_url" placeholder="https://e-konkursy.info/konkurs/..." onkeydown="if(event.key==='Enter')runAI()">
      </div>
    </div>

    <!-- Panel PDF -->
    <div id="aipanel_pdf" style="display:none">
      <div class="field"><label>Plik PDF z regulaminem</label>
        <div id="pdf_drop"
          onclick="document.getElementById('ai_pdf_inp').click()"
          ondragover="event.preventDefault();this.style.borderColor='#6366f1'"
          ondragleave="this.style.borderColor='#2d3548'"
          ondrop="event.preventDefault();this.style.borderColor='#2d3548';pdfLoad(event.dataTransfer.files[0])"
          style="border:2px dashed #2d3548;border-radius:10px;padding:28px 16px;text-align:center;cursor:pointer;transition:border-color .2s">
          <div style="font-size:36px;margin-bottom:8px">📄</div>
          <div style="color:#94a3b8;font-size:14px;font-weight:600">Kliknij lub przeciągnij plik PDF</div>
          <div style="color:#475569;font-size:12px;margin-top:4px">Regulamin w formacie .pdf</div>
        </div>
        <input type="file" id="ai_pdf_inp" accept=".pdf" style="display:none" onchange="pdfLoad(this.files[0])">
        <div id="pdf_info" style="display:none;margin-top:10px;padding:10px 14px;border-radius:8px;font-size:13px"></div>
      </div>
    </div>

    <!-- Panel Tekst -->
    <div id="aipanel_txt" style="display:none">
      <div class="field"><label>Wklej treść regulaminu</label>
        <textarea id="ai_txt" placeholder="Skopiuj i wklej tu całą treść regulaminu..." style="min-height:130px"></textarea>
      </div>
    </div>

    <div id="ai_error" style="display:none;background:#ef444418;border:1px solid #ef444444;border-radius:8px;padding:10px 14px;color:#f87171;font-size:13px;margin-bottom:14px"></div>
    <div style="display:flex;justify-content:flex-end;gap:10px">
      <button class="btn-gemini" onclick="runAI()">✨ Analizuj z Gemini</button>
    </div>
    <div id="ai_loading" style="display:none;text-align:center;padding:40px">
      <div style="font-size:36px;margin-bottom:12px">🤖</div>
      <div style="color:#f1f5f9;font-weight:700;margin-bottom:6px">Gemini analizuje regulamin…</div>
      <div style="color:#64748b;font-size:13px;margin-bottom:16px">Pobieranie strony i ekstrakcja danych</div>
      <div><span class="pulse-dot" style="animation-delay:0s"></span> <span class="pulse-dot" style="animation-delay:.2s"></span> <span class="pulse-dot" style="animation-delay:.4s"></span></div>
    </div>
    <div id="ai_form" style="display:none;margin-top:20px">
      <div style="background:#22c55e11;border:1px solid #22c55e33;border-radius:10px;padding:10px 16px;margin-bottom:16px;font-size:13px;color:#86efac">
        ✅ Sprawdź dane i popraw jeśli trzeba, potem kliknij Zapisz
      </div>
      <div class="field"><label>Nazwa konkursu</label><input id="af_name"></div>
      <div class="field"><label>Agencja</label>
        <select id="af_agency_sel" onchange="document.getElementById('af_agency_new').style.display=this.value==='-new-'?'block':'none'">
          <option value="">— wybierz z bazy —</option>
          ${S.agencies.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}
          <option value="-new-">+ Nowa agencja</option>
        </select>
        <input id="af_agency_new" style="display:none;margin-top:8px" placeholder="Nazwa nowej agencji">
        <div id="af_agency_hint" style="font-size:11px;color:#475569;margin-top:4px"></div>
      </div>
      <div class="field"><label>Nagroda</label><input id="af_prize" placeholder="np. 10 000 zł"></div>
      <div class="grid2">
        <div class="field"><label>Termin zgłoszeń</label><input type="date" id="af_deadline"></div>
        <div class="field"><label>Termin wyników</label><input type="date" id="af_results_date"></div>
      </div>
      <div class="field"><label>Warunki uczestnictwa</label><textarea id="af_cond"></textarea></div>
      <div class="field"><label>🎯 Zadanie konkursowe</label><textarea id="af_task" style="border-color:#6366f133;min-height:70px"></textarea></div>
      <div class="field"><label>💡 Szczegóły (wypełnione przez AI)</label>
        <textarea id="af_notes" style="border-color:#f59e0b44;min-height:80px"></textarea>
      </div>
      <div class="field" id="af_shops_field">
        <label>⚠️ Sklepy (gdzie wymagany zakup)</label>
        <input type="text" id="af_shops_input" placeholder="np. Biedronka, Lidl — wypełniane przez AI">
      </div>
      <div class="grid2">
        <div class="field"><label>Link do zgłoszeń</label><input type="url" id="af_link" placeholder="https://"></div>
        <div class="field"><label>Link do regulaminu</label><input type="url" id="af_rules_link" placeholder="https://"></div>
      </div>
      <div class="field"><label>Status</label>
        <select id="af_status">
          <option value="active">Aktywny</option><option value="planned">Planowany</option><option value="ended">Zakończony</option>
        </select>
      </div>
      <div class="field" id="af_tags_field"></div>
      <div style="display:flex;justify-content:flex-end;margin-top:6px">
        <button class="btn-primary" onclick="saveAIContest()">Zapisz konkurs</button>
      </div>
    </div>`;
}

// ── AI tab helpers ───────────────────────────────────────────────────────────
let _aiTab='url', _pdfText='';

function aiTab(t){
  _aiTab=t;
  ['url','pdf','txt'].forEach(id=>{
    const panel=document.getElementById('aipanel_'+id);
    const btn=document.getElementById('aitab_'+id);
    if(!panel||!btn) return;
    panel.style.display=id===t?'block':'none';
    btn.style.background=id===t?'#6366f1':'#1e2a3a';
    btn.style.color=id===t?'#fff':'#64748b';
  });
}

let _pdfBase64='', _pdfIsScanned=false;

async function pdfLoad(file){
  const info=document.getElementById('pdf_info');
  const drop=document.getElementById('pdf_drop');
  if(!file||!file.name.toLowerCase().endsWith('.pdf')){
    info.style.display='block'; info.style.background='#ef444418'; info.style.color='#f87171';
    info.textContent='Wybierz plik .pdf'; return;
  }
  info.style.display='block'; info.style.background='#6366f122'; info.style.color='#818cf8';
  info.textContent='Odczytuję '+file.name+'...';
  _pdfText=''; _pdfBase64=''; _pdfIsScanned=false;

  // Zawsze zapisz base64 (potrzebne do OCR)
  _pdfBase64 = await new Promise((res,rej)=>{
    const fr=new FileReader();
    fr.onload=e=>res(e.target.result.split(',')[1]);
    fr.onerror=rej;
    fr.readAsDataURL(file);
  });

  try{
    const buf=await file.arrayBuffer();
    if(typeof pdfjsLib!=='undefined'){
      pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const pdf=await pdfjsLib.getDocument({data:buf}).promise;
      let txt='';
      const maxP=Math.min(pdf.numPages,20);
      for(let i=1;i<=maxP;i++){
        const pg=await pdf.getPage(i);
        const tc=await pg.getTextContent();
        txt+=tc.items.map(x=>x.str).join(' ')+' ';
      }
      _pdfText=txt.replace(/\s{2,}/g,' ').trim().slice(0,14000);
      if(_pdfText.length < 100){
        // Za mało tekstu = skan
        _pdfIsScanned=true;
        info.style.background='#f59e0b18'; info.style.color='#fbbf24';
        info.innerHTML='<strong>Skan PDF</strong> ('+pdf.numPages+' stron) · AI użyje OCR (gemini-2.5-flash)';
        drop.style.borderColor='#f59e0b';
      } else {
        info.style.background='#22c55e18'; info.style.color='#4ade80';
        info.textContent=''+file.name+' · '+pdf.numPages+' stron · '+_pdfText.length+' znakow';
        drop.style.borderColor='#22c55e';
      }
    } else {
      _pdfIsScanned=true;
      info.style.background='#f59e0b18'; info.style.color='#fbbf24';
      info.textContent='PDF zaladowany · AI uzyje OCR';
      drop.style.borderColor='#f59e0b';
    }
  } catch(e){
    // Błąd pdf.js – i tak mamy base64, spróbujemy OCR
    _pdfIsScanned=true;
    info.style.background='#f59e0b18'; info.style.color='#fbbf24';
    info.textContent='PDF zaladowany · AI uzyje OCR';
    drop.style.borderColor='#f59e0b';
  }
}

function fillAIForm(result,url){
  document.getElementById('af_name').value=result.name||'';
  document.getElementById('af_prize').value=result.prize||'';
  // Zapisz prize_value w ukrytym polu
  let afPvEl=document.getElementById('af_prize_value_hidden');
  if(!afPvEl){ afPvEl=document.createElement('input'); afPvEl.type='hidden'; afPvEl.id='af_prize_value_hidden'; document.body.appendChild(afPvEl); }
  afPvEl.value=result.prize_value||'';
  document.getElementById('af_deadline').value=result.deadline||'';
  document.getElementById('af_cond').value=result.conditions||'';
  setTimeout(()=>{ const t=document.getElementById('af_task'); if(t) t.value=result.task||''; },50);
  // Link: preferuj entry_link z AI, potem url źródłowy
  const entryLink = result.entry_link||'';
  const linkVal = fixUrl(entryLink||(url||''));
  const lnkEl=document.getElementById('af_link');
  if(lnkEl) lnkEl.value=linkVal;
  // Złóż notatki z wszystkich dodatkowych pól
  const extras=[];
  if(result.entry_limit&&result.entry_limit!=='brak informacji'&&result.entry_limit!=='null'&&result.entry_limit)
    extras.push('Limit zgloszen: '+result.entry_limit);
  if(result.requires_purchase&&result.requires_purchase!=='nie'&&result.requires_purchase!=='brak informacji'&&result.requires_purchase)
    extras.push('Wymagany zakup/paragon: '+result.requires_purchase);
  if(result.selection_method&&result.selection_method!=='brak informacji'&&result.selection_method)
    extras.push('Wybor zwyciezcy: '+result.selection_method);
  if(result.tax_info&&result.tax_info!=='brak informacji'&&result.tax_info!=='null'&&result.tax_info)
    extras.push('Podatek: '+result.tax_info);
  if(result.notes&&result.notes!=='brak informacji'&&result.notes)
    extras.push(result.notes);
  document.getElementById('af_notes').value=extras.join('\n');
  if(result.shops){
    setTimeout(()=>{
      // Pole w formularzu ręcznym
      const inp=document.getElementById('c_shops_input');
      if(inp) inp.value=result.shops;
      // Pole w formularzu AI
      const ainp=document.getElementById('af_shops_input');
      if(ainp){ ainp.value=result.shops; ainp.style.borderColor=result.shops?'#ef444455':''; }
    },100);
  }
  // Termin wyników i link do regulaminu w formularzu AI
  setTimeout(()=>{
    const rd=document.getElementById('af_results_date');
    if(rd) rd.value=result.results_date||'';
    const rl=document.getElementById('af_rules_link');
    if(rl) rl.value=result.rules_link||'';
    // Tagi w formularzu AI
    const tf=document.getElementById('af_tags_field');
    if(tf) tf.innerHTML=tagsFieldHtml([]);
  },50);
  const matchedAg=result.agency?S.agencies.find(a=>a.name.toLowerCase().includes((result.agency||'').toLowerCase().slice(0,8))):null;
  if(matchedAg){
    document.getElementById('af_agency_sel').value=matchedAg.id;
  } else if(result.agency){
    document.getElementById('af_agency_sel').value='-new-';
    document.getElementById('af_agency_new').style.display='block';
    document.getElementById('af_agency_new').value=result.agency;
  }
}

async function runAI(){
  const apiKey=document.getElementById('ai_key')?.value?.trim();
  const errEl=document.getElementById('ai_error');
  const loadEl=document.getElementById('ai_loading');
  const formEl=document.getElementById('ai_form');

  if(!apiKey){errEl.textContent='Wpisz klucz API Gemini';errEl.style.display='block';return;}
  errEl.style.display='none';
  loadEl.style.display='block';
  formEl.style.display='none';

  const url=document.getElementById('ai_url')?.value?.trim()||'';

  try{
    let text='';
    if(_aiTab==='pdf'){
      if(!_pdfText&&!_pdfBase64){
        loadEl.style.display='none';
        errEl.textContent='Najpierw wgraj plik PDF';errEl.style.display='block';return;
      }
      if(_pdfIsScanned||_pdfText.length<100){
        // Skan PDF – wyślij do Gemini Vision z OCR
        if(!_pdfBase64){
          loadEl.style.display='none';
          errEl.textContent='Brak danych PDF do OCR';errEl.style.display='block';return;
        }
        // Sprawdź rozmiar – max ~15MB base64
        if(_pdfBase64.length > 20000000){
          loadEl.style.display='none';
          errEl.textContent='Plik PDF jest za duzy (max ~15MB). Sprobuj skanow niższej jakosci.';errEl.style.display='block';return;
        }
        document.getElementById('ai_loading').querySelector('div+div').textContent='OCR skanu PDF przez Gemini Vision...';
        const result=await analyzeWithGeminiVision(apiKey,_pdfBase64);
        fillAIForm(result,'');
        loadEl.style.display='none';
        document.getElementById('ai_form').style.display='block';
        return;
      }
      text=_pdfText;
    } else if(_aiTab==='txt'){
      text=(document.getElementById('ai_txt')?.value||'').trim().slice(0,14000);
      if(text.length<50){
        loadEl.style.display='none';
        errEl.textContent='Wklej treść regulaminu';errEl.style.display='block';return;
      }
    } else {
      if(!url){
        loadEl.style.display='none';
        errEl.textContent='Wpisz URL strony';errEl.style.display='block';return;
      }
      text=await fetchPageText(url);
    }
    const result=await analyzeWithGemini(apiKey,text,url);
    fillAIForm(result,url);
    loadEl.style.display='none';
    formEl.style.display='block';
  } catch(e){
    loadEl.style.display='none';
    errEl.textContent=e.message||'Nieznany błąd';
    errEl.style.display='block';
  }
}

function saveAIContest(){
  const name=document.getElementById('af_name').value.trim();
  if(!name){alert('Podaj nazwę konkursu');return;}

  let agencyId=document.getElementById('af_agency_sel').value;
  if(agencyId==='-new-'){
    const newName=document.getElementById('af_agency_new').value.trim();
    if(newName){
      const ex=S.agencies.find(a=>a.name.toLowerCase()===newName.toLowerCase());
      if(ex){ agencyId=ex.id; }
      else{
        const na={id:uid(),name:newName,website:'',notes:''};
        S.agencies.push(na); persistAndSync(KEYS.agencies,S.agencies); agencyId=na.id;
      }
    } else agencyId='';
  }

  const afShops=(document.getElementById('af_shops_input')?.value||'').split(',').map(s=>s.trim()).filter(Boolean);
  S.contests.push({
    id:uid(), name, agencyId,
    prize:     document.getElementById('af_prize').value,
    deadline:  document.getElementById('af_deadline').value,
    results_date: document.getElementById('af_results_date')?.value||'',
    conditions:document.getElementById('af_cond').value,
    notes:     document.getElementById('af_notes').value,
    task:      document.getElementById('af_task')?.value||'',
    link:      document.getElementById('af_link').value,
    rules_link:document.getElementById('af_rules_link')?.value||'',
    status:    document.getElementById('af_status').value,
    shops:     afShops,
    tags:      getSelectedTags(),
    prize_value:document.getElementById('af_prize_value_hidden')?.value||'',
  });
  persistAndSync(KEYS.contests,S.contests);

  // Reset form
  document.getElementById('af_name').value='';
  document.getElementById('ai_url').value='';
  document.getElementById('ai_form').style.display='none';
  const ai_shops=document.getElementById('af_shops_input');
  if(ai_shops) ai_shops.value='';

  // Show success
  const succ=document.createElement('div');
  succ.style.cssText='background:#22c55e22;border:1px solid #22c55e44;border-radius:10px;padding:20px;text-align:center;margin-top:20px;font-size:14px;color:#86efac';
  succ.innerHTML=`✅ Konkurs "<strong>${esc(name)}</strong>" dodany! <button class="btn-primary btn-sm" style="margin-left:10px" onclick="setTab('contests')">Zobacz konkursy</button>`;
  document.getElementById('ai_form').after(succ);
  setTimeout(()=>succ.remove(),5000);
}

async function generateForContest(contestId){
  const ct=S.contests.find(x=>x.id===contestId);
  if(!ct) return;
  const apiKey=localStorage.getItem(KEYS.geminiKey)||'';
  if(!apiKey){ promptForApiKey(); return; }

  // Pokaż formularz inline pod przyciskiem
  openModal({title:'✨ Generuj odpowiedź — '+ct.name, wide:true, html:`
    <div style="background:#6366f111;border:1px solid #6366f133;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:#818cf8">
      <strong>🎯 Zadanie:</strong> ${esc(ct.task||'(brak — dodaj zadanie do konkursu)')}
    </div>
    ${field('Produkt/marka (opcjonalnie)',finp('gen_product','','text','np. Aquafresh, Kinder, Pepsi'))}
    ${field('Wskazówki (opcjonalnie)',ftex('gen_hint','','np. max 300 znaków, humor, konkurs jury'))}
    <div id="gen_result_area" style="margin-top:14px"></div>`,
    submitLabel:'✨ Generuj',
    onSubmit: async(modal)=>{
      const product=gv('gen_product');
      const hint=gv('gen_hint');
      const btn=document.getElementById(modal.id+'_submit');
      if(btn){btn.textContent='⏳ Generuję...';btn.disabled=true;}

      try{
        const prompt=
          'Jesteś zwykłym Polakiem/Polką i piszesz odpowiedź na konkurs — tak jak pisałbyś do znajomego na Messengerze, nie jak do komisji konkursowej. '+
          'Konkurs: '+ct.name+'. '+
          (ct.task?'ZADANIE (odpowiedz DOKŁADNIE na to — to najważniejsze): '+ct.task+'. ':'Warunki: '+(ct.conditions||'brak')+'. ')+
          (product?'Produkt/marka o której piszesz: '+product+'. ':'')+
          (hint?'Dodatkowe wskazówki: '+hint+'. ':'')+
          'Napisz 4 wersje — każda INNA w stylu. title to KRÓTKA nazwa (jedno-dwa słowa), content to treść odpowiedzi. '+
          'Wersja 1 — title dokładnie "Osobista": ciepła odpowiedź z konkretnym wspomnieniem z życia. '+
          'Wersja 2 — title dokładnie "Z humorem": lekki naturalny dowcip. '+
          'Wersja 3 — title dokładnie "Prosta": krótka, zwięzła, na temat. '+
          'Wersja 4 — title dokładnie "Rymowana": KRÓTKI WIERSZYK 4 linijki. KAŻDA para linijek MUSI się rymować (linijka 1 z 2, linijka 3 z 4) — końcówki wyrazów muszą brzmieć tak samo, np. "ziemniaczki/chrupiące paczki", "wieczór/nie ma co liczyć". Sprawdź rymy zanim odpowiesz. Oddziel linijki znakiem nowej linii. '+
          'ZASADY HUMANIZACJI — stosuj WSZYSTKIE: 1. Pisz w pierwszej osobie (ja, moje, u mnie, mi, mam). 2. Dodaj JEDEN konkretny osobisty detal — wspomnienie, sytuację z życia (np. "w zeszłą niedzielę", "moja córka zawsze", "od lat"). 3. Struktura zdań: CELOWO mieszaj bardzo krótkie (2-4 słowa) z długimi (12-18 słów). 4. Użyj co najmniej jednego potocznego wtrącenia: "no i", "tak szczerze", "po prostu", "właśnie dlatego", "a tu proszę", "i wiecie co". 5. Lekka niedoskonałość stylistyczna — jedno zdanie może zaczynać się od "I" lub "Bo". 6. ABSOLUTNY ZAKAZ słów wykrywanych przez detektory AI: doskonały, wyjątkowy, niezrównany, rewolucyjny, innowacyjny, kompleksowy, holistyczny, transformacyjny, bezprecedensowy, fascynujący, niesamowity, zachwycający, perfekcyjny, idealny, fenomenalny. 7. Unikaj symetrycznych list ("po pierwsze... po drugie... po trzecie"). 8. Tekst ma brzmieć jakby był pisany na telefonie, nie w edytorze tekstu. '+
          'Długość: '+(ct.task&&ct.task.includes('300')?'max 300 znaków':ct.task&&ct.task.includes('180')?'max 180 znaków':ct.task&&ct.task.includes('500')?'max 500 znaków':'100-250 znaków — nie przekraczaj')+'.';

        // Dodaj instrukcję formatu JSON do promptu
        const fullPrompt=prompt+
          '\n\nOdpowiedz WYŁĄCZNIE czystym JSON (bez markdown, bez komentarzy) w formacie:'+
          '[{"title":"Osobista","content":"..."},{"title":"Z humorem","content":"..."},{"title":"Prosta","content":"..."},{"title":"Rymowana","content":"..."}]';

        const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            contents:[{parts:[{text:fullPrompt}]}],
            generationConfig:{temperature:1.1,maxOutputTokens:2048}
          })
        });
        if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e?.error?.message||'Błąd API');}
        const data=await r.json();
        const raw=data.candidates?.[0]?.content?.parts?.[0]?.text||'[]';
        let results=parseGeminiJSON(raw);
        if(!Array.isArray(results)) results=results?[results]:[];
        results=results.map((r,i)=>({
          title: r.title||r.label||r.name||('Wersja '+(i+1)),
          content: r.content||r.text||r.answer||r.tresc||Object.values(r).find(v=>typeof v==='string'&&v.length>5)||''
        })).filter(r=>r.content.length>0);
        if(!results.length) throw new Error('Gemini nie zwrócił treści — spróbuj ponownie');

        window._aiResults=results;
        const area=document.getElementById('gen_result_area');
        if(area){
          area.innerHTML=
            '<div style="background:#22c55e11;border:1px solid #22c55e33;border-radius:8px;padding:8px 14px;margin-bottom:12px;font-size:12px;color:#86efac">'+
            '✅ Gotowe! Kliknij 📋 aby skopiować i wkleić na stronie konkursu.</div>'+
            results.map((t,i)=>{
              const label=t.title||t.label||('Wersja '+(i+1));
              const text=t.content||t.text||'';
              return '<div style="background:#131929;border:1px solid #2d3548;border-radius:10px;padding:12px;margin-bottom:8px">'+
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'+
                '<span style="font-weight:700;color:#f1f5f9;font-size:13px">'+esc(label)+'</span>'+
                '<div style="display:flex;gap:6px">'+
                '<button onclick="copyAiResult('+i+',this)" style="padding:4px 12px;font-size:12px;background:#6366f122;color:#818cf8;border:1px solid #6366f133;border-radius:6px;cursor:pointer;font-weight:600" id="copygen_'+i+'">📋 Kopiuj</button>'+
                '</div></div>'+
                '<div style="font-size:13px;color:#cbd5e1;line-height:1.6;white-space:pre-wrap">'+esc(text)+'</div>'+
                '<div style="font-size:11px;color:#475569;margin-top:4px">'+text.length+' znaków</div>'+
                '</div>';
            }).join('');
          if(btn){btn.textContent='🔄 Generuj ponownie';btn.disabled=false;}
        }
      }catch(e){
        if(btn){btn.textContent='✨ Generuj';btn.disabled=false;}
        alert('Błąd: '+e.message);
      }
      return false; // nie zamykaj modala
    }
  });
}

function copyAiResult(i, btn){
  const t=window._aiResults?.[i];
  if(!t) return;
  const copyText=t.content||t.text||String(t);
  navigator.clipboard.writeText(copyText).then(()=>{
    if(btn){const o=btn.innerHTML;btn.innerHTML='✅ Skopiowano!';btn.style.color='#4ade80';
      setTimeout(()=>{btn.innerHTML=o;btn.style.color='#818cf8';},2000);}
  }).catch(()=>{
    const ta=document.createElement('textarea');ta.value=t.content||t.text||String(t);
    document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);
    if(btn){const o=btn.innerHTML;btn.innerHTML='✅ Skopiowano!';
      setTimeout(()=>{btn.innerHTML=o;},2000);}
  });
}

async function generateCustom(){
  const apiKey=localStorage.getItem(KEYS.geminiKey)||'';
  if(!apiKey){promptForApiKey();return;}
  openModal({title:'✨ Generuj — własny temat',wide:true,html:`
    ${field('Temat/produkt/konkurs',finp('gen_custom_topic','','text','np. Biedronka, Kinder, konkurs na hasło'))}
    ${field('Zadanie konkursowe (opcjonalnie)',ftex('gen_custom_task','','np. Dokończ zdanie: Mój ulubiony produkt to...'))}
    ${field('Wskazówki',ftex('gen_custom_hint','','np. max 180 znaków, humor, styl młodzieżowy'))}
    <div id="gen_custom_result" style="margin-top:14px"></div>`,
    submitLabel:'✨ Generuj',
    onSubmit:async(modal)=>{
      const topic=gv('gen_custom_topic').trim();if(!topic)return false;
      const task=gv('gen_custom_task');
      const hint=gv('gen_custom_hint');
      const btn=document.getElementById(modal.id+'_submit');
      if(btn){btn.textContent='⏳...';btn.disabled=true;}
      try{
        const prompt=
          'Jesteś zwykłym Polakiem/Polką piszącym odpowiedź konkursową — jak do znajomego, nie do komisji. '+
          'Temat/produkt: '+topic+'. '+
          (task?'ZADANIE: '+task+'. ':'')+
          (hint?'Wskazówki: '+hint+'. ':'')+
          'Napisz 4 wersje. title to krótka nazwa: dokładnie "Osobista", "Z humorem", "Prosta", "Rymowana". '+
          'Rymowana = wierszyk 4 linijki gdzie pary linijek MUSZĄ się rymować (1-2, 3-4), końcówki wyrazów brzmią identycznie. Sprawdź rymy. '+
          'ZASADY HUMANIZACJI — stosuj WSZYSTKIE: 1. Pisz w pierwszej osobie (ja, moje, u mnie, mi, mam). 2. Dodaj JEDEN konkretny osobisty detal — wspomnienie, sytuację z życia (np. "w zeszłą niedzielę", "moja córka zawsze", "od lat"). 3. Struktura zdań: CELOWO mieszaj bardzo krótkie (2-4 słowa) z długimi (12-18 słów). 4. Użyj co najmniej jednego potocznego wtrącenia: "no i", "tak szczerze", "po prostu", "właśnie dlatego", "a tu proszę", "i wiecie co". 5. Lekka niedoskonałość stylistyczna — jedno zdanie może zaczynać się od "I" lub "Bo". 6. ABSOLUTNY ZAKAZ słów wykrywanych przez detektory AI: doskonały, wyjątkowy, niezrównany, rewolucyjny, innowacyjny, kompleksowy, holistyczny, transformacyjny, bezprecedensowy, fascynujący, niesamowity, zachwycający, perfekcyjny, idealny, fenomenalny. 7. Unikaj symetrycznych list ("po pierwsze... po drugie... po trzecie"). 8. Tekst ma brzmieć jakby był pisany na telefonie, nie w edytorze tekstu. ';
        const fullPrompt3=prompt+
          '\n\nOdpowiedz WYŁĄCZNIE czystym JSON (bez markdown):[{"title":"Osobista","content":"..."},{"title":"Z humorem","content":"..."},{"title":"Prosta","content":"..."},{"title":"Rymowana","content":"..."}]';
        const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({contents:[{parts:[{text:fullPrompt3}]}],
            generationConfig:{temperature:1.1,maxOutputTokens:2048}})
        });
        if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e?.error?.message||'Błąd API');}
        const data=await r.json();
        let results=parseGeminiJSON(data.candidates?.[0]?.content?.parts?.[0]?.text||'[]');
        if(!Array.isArray(results)) results=results?[results]:[];
        results=results.map((r,i)=>({
          title:r.title||r.label||('Wersja '+(i+1)),
          content:r.content||r.text||Object.values(r).find(v=>typeof v==='string'&&v.length>5)||''
        })).filter(r=>r.content.length>0);
        if(!results.length) throw new Error('Gemini nie zwrócił treści — spróbuj ponownie');
        window._aiResults=results;
        const area=document.getElementById('gen_custom_result');
        if(area){
          area.innerHTML='<div style="background:#22c55e11;border:1px solid #22c55e33;border-radius:8px;padding:8px 14px;margin-bottom:10px;font-size:12px;color:#86efac">✅ Gotowe!</div>'+
            results.map((t,i)=>{
              const lbl=t.title||t.label||('Wersja '+(i+1));
              const txt=t.content||t.text||'';
              return '<div style="background:#131929;border:1px solid #2d3548;border-radius:10px;padding:12px;margin-bottom:8px">'+
              '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'+
              '<span style="font-weight:700;color:#f1f5f9;font-size:13px">'+esc(lbl)+'</span>'+
              '<button onclick="copyAiResult('+i+',this)" style="padding:4px 12px;font-size:12px;background:#6366f122;color:#818cf8;border:1px solid #6366f133;border-radius:6px;cursor:pointer">📋 Kopiuj</button>'+
              '</div><div style="font-size:13px;color:#cbd5e1;line-height:1.6;white-space:pre-wrap">'+esc(txt)+'</div>'+
              '<div style="font-size:11px;color:#475569;margin-top:4px">'+txt.length+' znaków</div></div>';
            }).join('');
          if(btn){btn.textContent='🔄 Ponownie';btn.disabled=false;}
        }
      }catch(e){
        if(btn){btn.textContent='✨ Generuj';btn.disabled=false;}
        alert('Błąd: '+e.message);
      }
      return false;
    }
  });
}

function promptForApiKey(){
  openModal({title:'Klucz Gemini API',html:`
    <p style="color:#94a3b8;font-size:13px;margin-bottom:12px">Pobierz bezpłatnie na <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:#60a5fa">aistudio.google.com</a> — 1000 req/dzień za darmo.</p>
    ${field('Klucz API',finp('tmpl_api_key','','password','AIzaSy...'))}`,
    submitLabel:'Zapisz',onSubmit:()=>{
      const k=gv('tmpl_api_key').trim();if(!k)return false;
      localStorage.setItem(KEYS.geminiKey,k);
      render();
    }
  });
}


// — eksport na window (onclick= compatibility)
Object.assign(window, {fetchPageText, parseGeminiJSON, extractFieldsFallback, analyzeWithGemini, analyzeWithGeminiVision, renderAI, aiTab, pdfLoad, fillAIForm, runAI, saveAIContest, generateForContest, copyAiResult, generateCustom, promptForApiKey, GEMINI_PROMPT, _aiTab, _pdfBase64});
