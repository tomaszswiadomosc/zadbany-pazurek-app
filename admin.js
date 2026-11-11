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
  D.profiles = D.profiles.filter(p => !p.is_admin);
  D.ev.forEach(e => e.t = new Date(e.created_at).getTime());
  D.drills.forEach(e => e.t = new Date(e.created_at).getTime());
  show("a-main"); render(); renderCases(); loadMeet();
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
    return `<tr><td>${esc(p.first_name)} ${esc(p.last_name)}<br><span class="small muted">${esc(p.email)}</span></td>
      <td>${window.P90_dayNo(p.start_date)}</td>
      <td>${last ? new Date(last.t).toLocaleString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "brak"}</td>
      <td>${mine.filter(e => e.kind === "bit").length}</td><td>${mine.filter(e => e.kind === "res").length}</td>
      <td>${pct(ap, a.length)}</td><td>${dr}</td><td>${urge}</td><td>${plan}</td><td>${p.support_sent_at ? "tak" : "nie"}</td><td>${tasks}</td><td>${p.consent_case_study ? "tak" : "nie"}</td></tr>`;
  }).join("") || '<tr><td colspan="12" class="muted">Jeszcze nikt nie dołączył.</td></tr>';
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
