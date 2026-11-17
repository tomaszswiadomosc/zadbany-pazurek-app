// Program 90 dni — panel trenera
(() => {
const C = window.P90_CONFIG;
const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const D = { profiles: [], ev: [], tasks: [], photos: [], drills: [], surveys: [], plans: [] };
function toast(m) { const t = $("toast"); t.textContent = m; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(() => t.hidden = true, 3000); }
function show(id) { ["a-login", "a-denied", "a-main"].forEach(s => $(s).hidden = s !== id); }

$("aLogin").onsubmit = async e => {
  e.preventDefault();
  const { error } = await sb.auth.signInWithOtp({ email: $("aEmail").value.trim(), options: { emailRedirectTo: location.href.split("#")[0], shouldCreateUser: false } });
  if (error) return toast("Nie udało się: " + error.message);
  $("aSent").hidden = false;
};
$("aOut1").onclick = $("aOut2").onclick = () => sb.auth.signOut().then(() => show("a-login"));

async function all(q) { // pobiera wszystkie wiersze, po 1000 naraz
  let out = [], from = 0;
  for (;;) { const { data, error } = await q().range(from, from + 999); if (error) throw error; out = out.concat(data); if (data.length < 1000) return out; from += 1000; }
}

async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return show("a-login");
  const { data: me } = await sb.from("profiles").select("is_admin").eq("id", session.user.id).maybeSingle();
  if (!me || !me.is_admin) return show("a-denied");
  const since = new Date(Date.now() - 95 * 864e5).toISOString();
  try {
    [D.profiles, D.ev, D.tasks, D.photos, D.drills, D.surveys, D.plans] = await Promise.all([
      all(() => sb.from("profiles").select("*").order("created_at")),
      all(() => sb.from("episodes").select("*").gte("created_at", since).order("created_at")),
      all(() => sb.from("task_done").select("user_id,day")),
      all(() => sb.from("photos").select("*").order("created_at")),
      all(() => sb.from("drills").select("user_id,kind,created_at").gte("created_at", since)),
      all(() => sb.from("surveys").select("*").order("checkpoint")),
      all(() => sb.from("if_then_plans").select("user_id,situation,action,active"))
    ]);
  } catch (e) { console.error(e); return toast("Nie udało się pobrać danych."); }
  try { D.hyg = await all(() => sb.from("hygiene_done").select("user_id,day,item,done_at")); } catch (e) { console.warn("higiena", e); D.hyg = []; }
  try { D.land = await all(() => sb.from("landing_events").select("event,zrodlo,urzadzenie,at")); } catch (e) { console.warn("statystyki", e); D.land = []; }
  D.land.forEach(x => x.t = new Date(x.at).getTime());
  D.hyg.forEach(h => h.t = new Date(h.done_at).getTime());
  D.profiles = D.profiles.filter(p => !p.is_admin);
  D.ev.forEach(e => e.t = new Date(e.created_at).getTime());
  D.drills.forEach(e => e.t = new Date(e.created_at).getTime());
  show("a-main"); render(); renderCases(); loadMeet(); loadAccess(); loadLeads();
}

// ---------- Spotkania na żywo ----------
async function loadMeet() {
  const { data } = await sb.from("spotkania").select("*").eq("id", 1).maybeSingle();
  if (!data) return toast("Brak tabeli spotkań. Uruchom w Supabase plik spotkania.sql.");
  $("mDay").value = data.dzien || ""; $("mTime").value = (data.godzina || "").slice(0, 5); $("mDur").value = data.czas_min || 60;
  $("mOff").value = data.odwolane || ""; $("mLink").value = data.link || ""; $("mTopic").value = data.temat || "";
}
$("meetForm").onsubmit = async e => {
  e.preventDefault();
  const dzien = +$("mDay").value || null, link = $("mLink").value.trim() || null;
  if (dzien && (!$("mTime").value || !link)) return toast("Podaj godzinę i link do Google Meet.");
  if (link && !/^https:\/\/meet\.google\.com\//.test(link)) return toast("Link musi zaczynać się od https://meet.google.com/");
  $("mSave").disabled = true;
  const { error } = await sb.from("spotkania").update({ dzien, godzina: $("mTime").value || null, czas_min: +$("mDur").value || 60,
    odwolane: $("mOff").value || null, link, temat: $("mTopic").value.trim() || null, updated_at: new Date().toISOString() }).eq("id", 1);
  $("mSave").disabled = false;
  toast(error ? "Nie udało się zapisać: " + error.message : "Zapisane. Uczestnicy zobaczą to w aplikacji.");
};
// ---------- Zgłoszenia ze strony ----------
let LEADS = [], LF = "aktywne";
const LSTAT = { nowe: "Nowe", w_kontakcie: "W kontakcie", oplacone: "Opłacone", wyslany_dostep: "Ma dostęp", odrzucony: "Odrzucone" };
async function loadLeads() {
  const r = await sb.from("beta_zgloszenia").select("*").order("created_at", { ascending: false });
  if (r.error) { $("leadInfo").textContent = "Nie mogę wczytać zgłoszeń. Uruchom w Supabase plik zgloszenia-rozmowa.sql."; return; }
  LEADS = r.data || []; renderLeads();
}
function leadMsg(l) {
  const app = C.APP_URL || location.origin;
  return `Hej ${l.imie}! Masz już dostęp do programu Zadbany Pazurek 🎉\n\n1. Wejdź na ${app}\n2. Wpisz e-mail ${l.email} i kliknij „Wyślij kod do logowania”.\n3. Wpisz kod z maila i gotowe.\n\nNa iPhonie dodaj aplikację do ekranu: ··· obok paska adresu → Udostępnij → Do ekranu głównego → Dodaj.\n\nPowodzenia! Tomasz`;
}
// Dostęp + automatyczny mail powitalny przez funkcję „platnosci” (Brevo). Zwraca "mail", "nomail" albo "brak" (funkcja niewdrożona).
async function grantAccess(l, action = "przyznaj") {
  try {
    const { data: { session } } = await sb.auth.getSession();
    const r = await fetch(C.SUPABASE_URL.replace(/\/$/, "") + "/functions/v1/platnosci", {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": C.SUPABASE_ANON_KEY, "Authorization": "Bearer " + session.access_token },
      body: JSON.stringify({ action, id: l.id })
    });
    if (!r.ok) return "brak";
    const d = await r.json();
    return d.ok ? (d.mail ? "mail" : "nomail") : "brak";
  } catch { return "brak"; }
}
function renderLeads() {
  const open = LEADS.filter(l => l.status === "nowe" || l.status === "w_kontakcie");
  const nowe = LEADS.filter(l => l.status === "nowe").length;
  $("leadInfo").textContent = `Nowych: ${nowe} · do obsłużenia: ${open.length} · wszystkich: ${LEADS.length}. Program: po płatności kliknij „Opłacone, daj dostęp” (dostęp i mail z linkiem idą same). Przewodnik: po płatności kliknij „Opłacone, wyślij PDF” (mail z załącznikiem idzie sam).`;
  document.querySelectorAll("[data-lf]").forEach(b => b.classList.toggle("ghost", b.dataset.lf !== LF));
  const rows = LF === "aktywne" ? open : LEADS;
  const hasPdf = em => LEADS.some(x => x.oferta === "przewodnik" && x.email.toLowerCase() === em.toLowerCase() && (x.status === "oplacone" || x.status === "wyslany_dostep"));
  $("leadList").innerHTML = rows.map(l => { const pdf = l.oferta === "przewodnik", open = l.status === "nowe" || l.status === "w_kontakcie";
    const rabat = !pdf && (hasPdf(l.email) || /przewodnik/i.test(l.wiadomosc || ""));
    return `<div class="lead" data-id="${l.id}">
    <div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap"><b>${esc(l.imie)}</b><span class="row" style="gap:6px"><span class="pill of-${pdf ? "pdf" : "prog"}">${pdf ? "Przewodnik PDF · 27 zł" : "Program · 57 zł"}</span><span class="pill st-${l.status}">${pdf && l.status === "wyslany_dostep" ? "PDF wysłany" : (LSTAT[l.status] || l.status)}</span></span></div>
    ${rabat ? `<div class="small" style="color:#17643A;font-weight:600">Ma przewodnik: dopłata 30 zł zamiast 57 zł</div>` : ""}
    <div class="small">${esc(l.email)}${l.telefon ? ` · tel. <a href="tel:${esc(l.telefon.replace(/[^+0-9]/g, ""))}">${esc(l.telefon)}</a>` : ""}${l.profil ? " · " + esc(l.profil) : ""}</div>
    <div class="small muted">${new Date(l.created_at).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })} · ${l.co_obgryza ? `<b>${{ paznokcie: "paznokcie", skorki: "skórki", oba: "paznokcie i skórki" }[l.co_obgryza] || esc(l.co_obgryza)}</b>, ` : "obgryza "}od: ${esc(l.jak_dlugo)}${l.zrodlo ? " · źródło: " + esc(l.zrodlo) : ""}</div>
    ${l.wiadomosc ? `<div class="small" style="font-style:italic">„${esc(l.wiadomosc)}”</div>` : ""}
    <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:4px">
      ${l.status === "nowe" ? `<button class="btn ghost slim" data-la="w_kontakcie">W kontakcie</button>` : ""}
      ${open && !pdf ? `<button class="btn slim" data-la="dostep">Opłacone, daj dostęp</button>` : ""}
      ${open && pdf ? `<button class="btn slim" data-la="pdfmail">Opłacone, wyślij PDF</button>` : ""}
      ${(open || l.status === "oplacone") && pdf ? `<button class="btn ghost slim" data-la="email">Kopiuj e-mail</button><button class="btn ghost slim" data-la="pdf">Wysłałem PDF ręcznie</button>` : ""}
      ${open ? `<button class="btn ghost slim" data-la="odrzucony">Odrzuć</button>` : ""}
      ${!pdf && (l.status === "oplacone" || l.status === "wyslany_dostep") ? `<button class="btn ghost slim" data-la="kopiuj">Kopiuj wiadomość z linkiem</button>` : ""}
      ${!pdf && l.status === "oplacone" ? `<button class="btn slim" data-la="mail">Wyślij mail z dostępem</button><button class="btn ghost slim" data-la="wyslany_dostep">Wysłałem link ręcznie</button>` : ""}
      ${l.status === "odrzucony" ? `<button class="btn ghost slim" data-la="nowe">Przywróć</button>` : ""}
    </div></div>`; }).join("") || '<p class="small muted">Brak zgłoszeń do obsłużenia.</p>';
}
document.querySelectorAll("[data-lf]").forEach(b => b.onclick = () => { LF = b.dataset.lf; renderLeads(); });
$("leadList").addEventListener("click", async e => {
  const b = e.target.closest("[data-la]"); if (!b) return;
  const id = +b.closest("[data-id]").dataset.id, l = LEADS.find(x => x.id === id), act = b.dataset.la;
  if (act === "kopiuj") {
    const t = leadMsg(l);
    try { await navigator.clipboard.writeText(t); toast("Skopiowane. Wklej w SMS, WhatsApp albo mail."); }
    catch { prompt("Skopiuj wiadomość:", t); }
    return;
  }
  if (act === "email") {
    try { await navigator.clipboard.writeText(l.email); toast("E-mail skopiowany. Wyślij przewodnik z Gmaila."); }
    catch { prompt("Skopiuj e-mail:", l.email); }
    return;
  }
  let status = act;
  if (act === "pdf") {
    if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "Na pewno? Kliknij jeszcze raz"; return; }
    status = "wyslany_dostep";
  }
  if (act === "pdfmail") {
    if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "Na pewno opłacone? Kliknij jeszcze raz"; return; }
    b.disabled = true; b.textContent = "Wysyłam…";
    const r = await grantAccess(l, "przewodnik");
    if (r === "mail") { l.status = "wyslany_dostep"; renderLeads(); return toast(`Gotowe. ${l.imie} dostał(a) przewodnik mailem.`); }
    b.disabled = false; b.dataset.sure = ""; b.textContent = "Opłacone, wyślij PDF";
    return toast("Nie udało się wysłać PDF automatycznie. Wyślij go z Gmaila i kliknij „Wysłałem PDF ręcznie”.");
  }
  if (act === "dostep" || act === "mail") {
    if (act === "dostep" && b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "Na pewno opłacone? Kliknij jeszcze raz"; return; }
    b.disabled = true; b.textContent = "Wysyłam…";
    const r = await grantAccess(l);
    if (r === "mail") { l.status = "wyslany_dostep"; renderLeads(); loadAccess(); return toast(`Gotowe. ${l.imie} ma dostęp i dostał(a) maila z linkiem do aplikacji.`); }
    if (r === "nomail") { l.status = "oplacone"; renderLeads(); loadAccess(); return toast("Dostęp nadany, ale mail nie wyszedł. Kliknij „Kopiuj wiadomość z linkiem” i wyślij ręcznie."); }
    if (act === "mail") { b.disabled = false; return toast("Nie udało się wysłać maila. Skopiuj wiadomość i wyślij ręcznie."); }
    const a = await sb.from("access_list").upsert({ email: l.email.toLowerCase(), imie: l.imie, zrodlo: "reczny", revoked_at: null, note: "zgłoszenie ze strony" }, { onConflict: "email" });
    if (a.error) { b.disabled = false; return toast("Nie udało się dać dostępu: " + a.error.message); }
    status = "oplacone";
  }
  const { error } = await sb.from("beta_zgloszenia").update({ status }).eq("id", id);
  if (error) return toast("Nie udało się zmienić statusu: " + error.message);
  l.status = status; renderLeads();
  if (act === "dostep") { toast("Dostęp nadany. Automatyczny mail jeszcze nie działa, więc skopiuj wiadomość z linkiem i wyślij."); loadAccess(); }
});

// ---------- Lista dostępu ----------
let ACC = [], ORD = [];
async function loadAccess() {
  const a = await sb.from("access_list").select("*").order("created_at", { ascending: false });
  if (a.error) { $("accInfo").textContent = "Brak listy dostępu. Uruchom w Supabase plik dostep.sql."; $("accForm").hidden = true; return; }
  ACC = a.data || [];
  const o = await sb.from("orders").select("email,status,amount,paid_at").eq("status", "oplacone");
  ORD = o.error ? [] : o.data || [];
  renderAccess();
}
function renderAccess() {
  const q = $("accFind").value.trim().toLowerCase();
  const rows = ACC.filter(r => !q || r.email.includes(q) || (r.imie || "").toLowerCase().includes(q));
  const paid = ORD.length, active = ACC.filter(r => !r.revoked_at).length;
  $("accInfo").textContent = `Aktywnych dostępów: ${active} · opłaconych zamówień: ${paid}. Osoby po płatności trafiają tu same; ręcznie dodasz testera albo prezent, a po zwrocie pieniędzy odbierasz dostęp.`;
  $("accTbl").innerHTML = rows.map(r => `<tr><td>${esc(r.email)}</td><td>${esc(r.imie || "")}</td><td>${r.zrodlo === "p24" ? "płatność" : "ręcznie"}</td><td>${new Date(r.created_at).toLocaleDateString("pl-PL")}</td>
    <td>${r.revoked_at ? '<span class="muted">odebrany</span>' : "aktywny"}</td>
    <td><button class="btn ghost slim" data-acc="${esc(r.email)}" data-on="${r.revoked_at ? 1 : 0}">${r.revoked_at ? "Przywróć" : "Odbierz dostęp"}</button></td></tr>`).join("") || '<tr><td colspan="6" class="muted">Brak osób</td></tr>';
}
$("accFind").oninput = renderAccess;
$("accForm").onsubmit = async e => {
  e.preventDefault();
  const email = $("accEmail").value.trim().toLowerCase(), imie = $("accName").value.trim() || null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return toast("Sprawdź adres e-mail.");
  const { error } = await sb.from("access_list").upsert({ email, imie, zrodlo: "reczny", revoked_at: null }, { onConflict: "email" });
  if (error) return toast("Nie udało się dodać: " + error.message);
  $("accEmail").value = ""; $("accName").value = ""; toast("Dodane. Ta osoba może się już zalogować."); loadAccess();
};
$("accTbl").addEventListener("click", async e => {
  const b = e.target.closest("[data-acc]"); if (!b) return;
  const email = b.dataset.acc, restore = b.dataset.on === "1";
  if (!restore && b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "Na pewno? Kliknij jeszcze raz"; return; }
  const { error } = await sb.from("access_list").update({ revoked_at: restore ? null : new Date().toISOString() }).eq("email", email);
  if (error) return toast("Nie udało się: " + error.message);
  toast(restore ? "Dostęp przywrócony." : "Dostęp odebrany. Ta osoba nie zaloguje się do aplikacji."); loadAccess();
});

sb.auth.onAuthStateChange(ev => { if (ev === "SIGNED_IN") boot(); });
$("range").onchange = render;

function count(arr, f) { const o = {}; arr.forEach(x => [].concat(f(x) || []).forEach(k => o[k] = (o[k] || 0) + 1)); return o; }
function hbars(el, obj) {
  const ent = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 6), max = Math.max(1, ...ent.map(x => x[1]));
  el.innerHTML = ent.map(([k, v]) => `<div class="hbar"><span>${esc(k)}</span><div class="t"><span style="width:${v / max * 100}%"></span></div><b>${v}</b></div>`).join("") || '<span class="small muted">Brak danych</span>';
}
const pct = (a, b) => b ? Math.round(a / b * 100) + "%" : "–";

function render() {
  const days = +$("range").value, from = Date.now() - days * 864e5;
  const ev = D.ev.filter(e => e.t >= from), bit = ev.filter(e => e.kind === "bit"), res = ev.filter(e => e.kind === "res");
  const aw = ev.filter(e => e.aware), awPre = aw.filter(e => e.aware !== "po").length;
  const active = new Set(ev.map(e => e.user_id));
  $("kUsers").textContent = D.profiles.length; $("kActive").textContent = active.size;
  $("kBit").textContent = bit.length; $("kRes").textContent = res.length; $("kAware").textContent = pct(awPre, aw.length);
  const drills = D.drills.filter(d => d.t >= from);
  $("kDrill").textContent = D.profiles.length ? (drills.length / D.profiles.length).toFixed(1) : "0";
  const hyg = D.hyg.filter(h => h.t >= from), hygDays = new Set(hyg.map(h => h.user_id + ":" + h.day)).size;
  $("kHyg").textContent = D.profiles.length ? (hygDays / D.profiles.length).toFixed(1) : "0";
  const land = D.land.filter(x => x.t >= from), lc = k => land.filter(x => x.event === k).length;
  const lv = lc("wejscie"), ls = lc("zapis");
  $("lVisit").textContent = lv; $("lJoin").textContent = lc("dolaczam"); $("lSign").textContent = ls;
  $("lConv").textContent = lv ? Math.round(ls / lv * 100) + "%" : "–";
  const src = {}; land.filter(x => x.event === "wejscie").forEach(x => { const k = x.zrodlo || "bezpośrednio"; src[k] = (src[k] || 0) + 1; });
  const topSrc = Object.entries(src).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const tel = land.filter(x => x.event === "wejscie" && x.urzadzenie === "telefon").length;
  $("lSrc").textContent = topSrc.length ? "Skąd przychodzą: " + topSrc.map(([k, n]) => `${k} (${n})`).join(", ") + ` · na telefonie: ${pct(tel, lv)}` : "Brak wejść w tym zakresie.";
  renderSurveys();

  const emo = count(bit, e => e.emotions), place = count(bit, e => e.place), time = count(bit, e => window.P90_partOfDay(e.t)), help = count(res, e => e.helps);
  hbars($("gEmo"), emo); hbars($("gPlace"), place); hbars($("gTime"), time); hbars($("gHelp"), help);

  const top = o => (Object.entries(o).sort((a, b) => b[1] - a[1])[0] || [])[0];
  const quiet = D.profiles.filter(p => !D.ev.some(e => e.user_id === p.id && e.t >= Date.now() - 3 * 864e5)).length;
  $("summary").textContent = bit.length + res.length
    ? `Grupa najczęściej obgryza ${window.P90_WHEN[top(time)] || ""}, w miejscu „${top(place) || "—"}”, przy emocji: ${(top(emo) || "—").toLowerCase()}. ` +
      `Udział powstrzymań: ${pct(res.length, bit.length + res.length)}. Najczęściej pomaga: ${top(help) || "brak danych"}. ` +
      `${quiet} ${quiet === 1 ? "osoba nie zapisała" : "osób nie zapisało"} nic od 3 dni — warto do nich napisać.`
    : "Brak zapisów w wybranym zakresie.";

  $("tbl").innerHTML = D.profiles.map(p => {
    const mine = ev.filter(e => e.user_id === p.id), all = D.ev.filter(e => e.user_id === p.id), last = all.at(-1);
    const a = mine.filter(e => e.aware), ap = a.filter(e => e.aware !== "po").length;
    const tasks = D.tasks.filter(t => t.user_id === p.id).length;
    const sv = D.surveys.filter(s => s.user_id === p.id), dr = drills.filter(d => d.user_id === p.id).length;
    const urge = sv.length ? (sv.length > 1 ? `${sv[0].urge} → ${sv.at(-1).urge}` : `${sv[0].urge}`) : "–";
    const plan = D.plans.some(x => x.user_id === p.id && x.active) ? "tak" : "nie";
    const hy = hyg.filter(h => h.user_id === p.id), hyD = new Set(hy.map(h => h.day)).size;
    const hyTxt = hyD ? `${hyD} ${hyD === 1 ? "dzień" : "dni"} · ${(hy.length / hyD).toFixed(1)}/3` : "–";
    return `<tr><td>${esc(p.first_name)} ${esc(p.last_name)}<br><span class="small muted">${esc(p.email)}</span></td>
      <td>${window.P90_dayNo(p.start_date)}</td>
      <td>${last ? new Date(last.t).toLocaleString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "brak"}</td>
      <td>${mine.filter(e => e.kind === "bit").length}</td><td>${mine.filter(e => e.kind === "res").length}</td>
      <td>${pct(ap, a.length)}</td><td>${dr}</td><td>${hyTxt}</td><td>${urge}</td><td>${plan}</td><td>${p.support_sent_at ? "tak" : "nie"}</td><td>${tasks}</td><td>${p.consent_case_study ? "tak" : "nie"}</td></tr>`;
  }).join("") || '<tr><td colspan="13" class="muted">Jeszcze nikt nie dołączył.</td></tr>';
}

function renderSurveys() {
  const ids = D.profiles.map(p => p.id), res = [];
  ids.forEach(id => { const sv = D.surveys.filter(s => s.user_id === id); if (sv.length >= 2) res.push([sv[0], sv.at(-1)]); });
  const avg = f => res.length ? (res.reduce((a, [x, y]) => a + f(x, y), 0) / res.length) : null;
  const fmt = v => v === null ? "–" : (v > 0 ? "−" : v < 0 ? "+" : "") + Math.abs(v).toFixed(1);
  $("sN").textContent = `${res.length} z ${ids.length}`;
  $("sImp").textContent = res.length ? pct(res.filter(([a, b]) => b.freq < a.freq || a.urge - b.urge >= 2).length, res.length) : "–";
  $("sUrge").textContent = fmt(avg((a, b) => a.urge - b.urge));
  $("sShame").textContent = fmt(avg((a, b) => a.shame - b.shame));
  $("sFreq").textContent = res.length ? pct(res.filter(([a, b]) => b.freq < a.freq).length, res.length) : "–";
}

async function renderCases() {
  const ok = D.profiles.filter(p => p.consent_case_study);
  const items = ok.map(p => ({ p, ph: D.photos.filter(x => x.user_id === p.id) })).filter(x => x.ph.length >= 2 && x.ph.at(-1).day > x.ph[0].day);
  if (!items.length) { $("cases").innerHTML = '<p class="small muted">Pojawią się tu osoby ze zgodą, które mają co najmniej 2 zdjęcia.</p>'; return; }
  const cards = await Promise.all(items.map(async ({ p, ph }) => {
    const [a, b] = [ph[0], ph.at(-1)];
    const { data } = await sb.storage.from("photos").createSignedUrls([a.path, b.path], 3600);
    const [ua, ub] = (data || []).map(d => d.signedUrl);
    return `<div class="stack" style="gap:8px"><b>${esc(p.first_name)} ${esc(p.last_name.charAt(0))}.</b>
      <div class="photos"><div class="ph"><img alt="Dzień ${a.day}" src="${ua}"></div><div class="ph"><img alt="Dzień ${b.day}" src="${ub}"></div></div>
      <span class="small muted">Dzień ${a.day} → dzień ${b.day}</span></div>`;
  }));
  $("cases").innerHTML = cards.join("");
}

boot().catch(e => { console.error(e); toast("Błąd ładowania panelu."); });
})();
