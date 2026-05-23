// ═══════════════════════════════════════════════════════════
// UTILS — funkcje pomocnicze
// ═══════════════════════════════════════════════════════════

const uid = () => Math.random().toString(36).slice(2,10);
const today = () => new Date().toISOString().split('T')[0];
const daysLeft = d => { if(!d) return null; return Math.ceil((new Date(d)-new Date())/86400000); };
const fmt = d => { if(!d) return '—'; return new Date(d).toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric'}); };
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const gv = id => { const el=document.getElementById(id); return el?el.value:''; };

// ─── Field builder (formularze) ───────────────────────────────────────────────
const field = (label,html,hint='') => `<div class="field"><label>${esc(label)}</label>${html}${hint?`<div class="hint">${hint}</div>`:''}</div>`;
const finp = (id,val='',type='text',placeholder='') => `<input id="${id}" type="${type}" value="${esc(val)}" placeholder="${esc(placeholder)}">`;
const ftex = (id,val='',placeholder='') => `<textarea id="${id}" placeholder="${esc(placeholder)}">${esc(val)}</textarea>`;
const fsel = (id,opts,val='') => `<select id="${id}">${opts.map(([v,l])=>`<option value="${esc(v)}"${v===val?' selected':''}>${esc(l)}</option>`).join('')}</select>`;

// Agency options helper
const agencyOpts = (blank=true) => [
  ...(blank?[['','— wybierz agencję —']]:[]),
  ...S.agencies.map(a=>[a.id,a.name])
];

// ─── URL / daty ───────────────────────────────────────────────────────────────
function fixUrl(url){
  if(!url) return '';
  url=url.trim();
  if(url.startsWith('http:///')||url.startsWith('https:///')) url=url.replace('///','//');
  if(!url.startsWith('http://') && !url.startsWith('https://'))
    url='https://'+url.replace(/^\/+/,'');
  return url;
}

function ktTodayStr(){
  const d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

function parseDailyLimit(limitText){
  if(!limitText) return null;
  const t=limitText.toLowerCase();
  const m=t.match(/(\d+)\s*(?:zg\w*)?\s*(?:\/|na)?\s*(?:dzie|dzienn)/);
  return m?parseInt(m[1]):null;
}
