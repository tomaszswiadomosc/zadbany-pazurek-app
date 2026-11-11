// Zadbany Pazurek — aplikacja uczestnika (Program 90 dni)
(() => {
const C = window.P90_CONFIG, W = window;
const sb = W.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const DAY = 864e5;
const S = { user: null, profile: null, ev: [], tasks: new Set(), photos: [], drills: [], surveys: [], plans: [], notes: [] };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ls = { get(k) { try { return localStorage.getItem("zp_" + k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem("zp_" + k, v); } catch (e) {} } };

document.querySelectorAll(".trainer").forEach(e => e.textContent = C.TRAINER);
document.querySelectorAll(".appname").forEach(e => e.textContent = C.APP_NAME);
$("termsLink").href = C.TERMS_URL; $("privLink").href = C.PRIVACY_URL;
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
let installPrompt = null;
W.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installPrompt = e; });

function toast(m) { const t = $("toast"); t.textContent = m; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(() => t.hidden = true, 2800); }
const SCREENS = ["s-loading", "s-login", "s-onboard", "s-safety", "s-survey", "s-install", "s-photo1", "v-dzis", "v-plan", "v-zapisz", "v-poslizg", "v-sos", "v-postep"];
function show(id) { SCREENS.forEach(s => $(s).hidden = s !== id); $("nav").hidden = !id.startsWith("v-"); scrollTo(0, 0); }
function fail(e) { console.error(e); toast("Coś poszło nie tak. Sprawdź internet i spróbuj ponownie."); }
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const dayRaw = () => W.P90_dayRaw(S.profile.start_date);
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
const drillsToday = () => S.drills.filter(d => sameDay(d.t, Date.now()));
const activePlans = () => S.plans.filter(p => p.active);
function weekInfo() {
  const d = dayRaw();
  if (d > 90) { const mw = Math.ceil((d - 90) / 7); return { d, maint: true, week: 12 + mw, mw, task: W.P90_MAINT[(mw - 1) % W.P90_MAINT.length] }; }
  const week = Math.min(12, Math.ceil(d / 7)); return { d, maint: false, week, task: W.P90_PLAN[week - 1] };
}

// ---------- Wybór „chipów” ----------
const sel = {};
function fillChips(id, arr, values) { $(id).innerHTML = arr.map((x, i) => `<button class="chip" type="button" data-v="${esc(values ? values[i] : x)}">${esc(x)}</button>`).join(""); }
function bindChips(root) {
  root.querySelectorAll(".chips[data-group]").forEach(g => {
    const k = g.dataset.group, single = g.hasAttribute("data-single");
    sel[k] = single ? null : [];
    g.querySelectorAll(".chip").forEach(c => {
      c.setAttribute("aria-pressed", "false");
      c.onclick = () => {
        const v = c.dataset.v;
        if (single) { g.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", "false")); c.setAttribute("aria-pressed", "true"); sel[k] = v; }
        else { const on = c.getAttribute("aria-pressed") !== "true"; c.setAttribute("aria-pressed", on); sel[k] = on ? [...sel[k], v] : sel[k].filter(x => x !== v); }
      };
    });
  });
}
function resetChips(root) { root.querySelectorAll(".chips[data-group]").forEach(g => { g.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", "false")); sel[g.dataset.group] = g.hasAttribute("data-single") ? null : []; }); }
fillChips("chipsFingers", W.P90_FINGERS); fillChips("chipsEmo", W.P90_EMO); fillChips("chipsPlace", W.P90_PLACES); fillChips("chipsHelp", W.P90_HELPS);
fillChips("chipsNext", W.P90_NEXT); fillChips("eveHelp", W.P90_HELPS.filter(h => h !== "Nic"));
fillChips("svFreq", W.P90_FREQ, W.P90_FREQ.map((_, i) => i)); $("svFreq").dataset.group = "svFreq"; $("svFreq").setAttribute("data-single", "");
bindChips(document);

// ---------- Logowanie ----------
$("loginForm").onsubmit = async e => {
  e.preventDefault(); $("loginBtn").disabled = true;
  const { error } = await sb.auth.signInWithOtp({ email: $("email").value.trim(), options: { emailRedirectTo: location.origin + location.pathname } });
  $("loginBtn").disabled = false;
  if (error) return toast("Nie udało się wysłać e-maila: " + error.message);
  $("loginForm").hidden = true; $("codeForm").hidden = false; $("code").focus();
};
// Kod z e-maila: potrzebny na iPhonie, gdzie aplikacja z ekranu głównego nie widzi logowania z przeglądarki
$("codeForm").onsubmit = async e => {
  e.preventDefault(); $("codeBtn").disabled = true;
  const { error } = await sb.auth.verifyOtp({ email: $("email").value.trim(), token: $("code").value.replace(/\D/g, ""), type: "email" });
  $("codeBtn").disabled = false;
  if (error) return toast("Kod jest błędny albo wygasł. Sprawdź najnowszy e-mail lub wyślij nowy.");
};
$("codeBack").onclick = () => { $("codeForm").hidden = true; $("loginForm").hidden = false; $("code").value = ""; };

async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return show("s-login");
  S.user = session.user;
  const { data: prof, error } = await sb.from("profiles").select("*").eq("id", S.user.id).maybeSingle();
  if (error) return fail(error);
  if (!prof || !prof.consent_health) return show("s-onboard");
  S.profile = prof;
  await loadData();
  nextStep();
}
sb.auth.onAuthStateChange((ev, session) => {
  if (ev === "SIGNED_OUT") { S.user = null; S.profile = null; show("s-login"); }
  if (ev === "SIGNED_IN" && (!S.user || S.user.id !== session.user.id)) boot().catch(fail);
});

// Kolejne kroki dołączenia, potem aplikacja
function nextStep() {
  if (!S.profile.safety_ack_at) return openSafety(true);
  if (!S.surveys.some(s => s.checkpoint === 1)) return openSurvey(1, true);
  if (!isStandalone() && !ls.get("install_seen")) return openInstall();
  if (!S.photos.length && !ls.get("skip_photo1")) return show("s-photo1");
  go("dzis");
}

// ---------- Krok 1: dane i zgody ----------
$("onbForm").onsubmit = async e => {
  e.preventDefault();
  const by = +$("by").value, age = new Date().getFullYear() - by;
  if (age < 16) { $("ageMsg").textContent = "Program jest dla osób, które mają co najmniej 16 lat. Poproś rodzica o kontakt z trenerem."; $("ageMsg").style.color = "var(--warn)"; return; }
  const row = { id: S.user.id, email: S.user.email, first_name: $("fn").value.trim(), last_name: $("ln").value.trim(), birth_year: by, cuticles: $("cCut").checked,
    consent_health: $("cHealth").checked, consent_case_study: $("cCase").checked, consent_at: new Date().toISOString() };
  const { data, error } = await sb.from("profiles").upsert(row).select().single();
  if (error) return fail(error);
  S.profile = data; await loadData(); nextStep();
};

// ---------- Krok 2: bezpieczeństwo ----------
let safetyOnboarding = true;
function openSafety(onb) {
  safetyOnboarding = onb;
  $("safetyStep").textContent = onb ? "Krok 2 z 5" : "Informacja";
  $("safetyOk").textContent = onb ? "Rozumiem, chcę kontynuować" : "Wróć";
  show("s-safety");
}
$("safetyOk").onclick = async () => {
  if (!safetyOnboarding) return go("postep");
  const at = new Date().toISOString();
  const { error } = await sb.from("profiles").update({ safety_ack_at: at }).eq("id", S.user.id);
  if (error) return fail(error);
  S.profile.safety_ack_at = at; nextStep();
};
$("safetyInfo").onclick = e => { e.preventDefault(); openSafety(false); };

// ---------- Ankieta postępu ----------
let surveyCp = 1, surveyOnb = true;
function openSurvey(cp, onb) {
  surveyCp = cp; surveyOnb = onb;
  resetChips($("s-survey")); $("svUrge").value = 5; $("svUrgeV").textContent = 5; $("svShame").value = 5; $("svShameV").textContent = 5;
  $("surveyStep").textContent = onb ? "Krok 3 z 5" : `Ankieta · dzień ${cp}`;
  $("surveyH").textContent = cp === 1 ? "Gdzie jesteś na starcie" : `Jak jest po ${cp} dniach`;
  $("svLater").hidden = onb;
  show("s-survey");
}
$("svUrge").oninput = e => $("svUrgeV").textContent = e.target.value;
$("svShame").oninput = e => $("svShameV").textContent = e.target.value;
$("svSave").onclick = async () => {
  if (sel.svFreq === null) return toast("Zaznacz, ile razy dziennie obgryzasz");
  const row = { user_id: S.user.id, checkpoint: surveyCp, freq: +sel.svFreq, urge: +$("svUrge").value, shame: +$("svShame").value };
  const { data, error } = await sb.from("surveys").upsert(row).select().single();
  if (error) return fail(error);
  S.surveys = S.surveys.filter(s => s.checkpoint !== surveyCp).concat(data).sort((a, b) => a.checkpoint - b.checkpoint);
  toast("Dziękuję, zapisane");
  surveyOnb ? nextStep() : go("dzis");
};
$("svLater").onclick = () => go("dzis");
$("surveyGo").onclick = e => { e.preventDefault(); const cp = dueCheckpoint(); if (cp) openSurvey(cp, false); };
function dueCheckpoint() {
  const reached = W.P90_CHECKPOINTS.filter(c => c <= dayRaw()), cp = reached.at(-1);
  return cp && !S.surveys.some(s => s.checkpoint === cp) ? cp : null;
}

// ---------- Krok 4: dodanie do ekranu ----------
function openInstall() {
  const steps = isIOS
    ? ["Otwórz tę stronę w przeglądarce Safari.", "Dotknij „Udostępnij” (kwadrat ze strzałką w górę).", "Przewiń i wybierz „Do ekranu początkowego”, potem „Dodaj”.", "Od teraz otwieraj aplikację z ikony na ekranie."]
    : ["Otwórz tę stronę w przeglądarce Chrome.", "Dotknij menu ⋮ w prawym górnym rogu.", "Wybierz „Zainstaluj aplikację” albo „Dodaj do ekranu głównego”.", "Od teraz otwieraj aplikację z ikony na ekranie."];
  $("installSteps").innerHTML = steps.map(s => `<li>${s}</li>`).join("");
  $("installDone").textContent = installPrompt ? "Zainstaluj teraz" : "Gotowe, dalej";
  show("s-install");
}
$("installDone").onclick = async () => {
  if (installPrompt) { installPrompt.prompt(); try { await installPrompt.userChoice; } catch (e) {} installPrompt = null; }
  ls.set("install_seen", "1"); nextStep();
};
$("installLater").onclick = () => { ls.set("install_seen", "1"); nextStep(); };

// ---------- Krok 5: zdjęcie dnia 1 ----------
const photo1 = { a: null, b: null };
function pickPhoto1(input, box, key, alt) {
  $(input).onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    photo1[key] = await compress(f);
    $(box).querySelectorAll("img").forEach(i => i.remove());
    $(box).insertAdjacentHTML("beforeend", `<img alt="${alt}" src="${URL.createObjectURL(photo1[key])}">`);
    $("photo1Next").disabled = false;
  };
}
pickPhoto1("file1", "ph1big", "a", "Zdjęcie dłoni na start");
pickPhoto1("file1b", "ph1b", "b", "Drugie zdjęcie na start");
$("photo1Next").onclick = async () => {
  $("photo1Next").disabled = true;
  for (const k of ["a", "b"]) {
    if (!photo1[k]) continue;
    if (!(await uploadPhoto(photo1[k]))) { $("photo1Next").disabled = false; return; }
    photo1[k] = null;
  }
  go("dzis");
};
$("photo1Skip").onclick = () => { ls.set("skip_photo1", "1"); go("dzis"); };

// ---------- Dane ----------
async function loadData() {
  const since = new Date(Date.now() - 100 * DAY).toISOString(), uid = S.user.id;
  const r = await Promise.all([
    sb.from("episodes").select("*").eq("user_id", uid).gte("created_at", since).order("created_at"),
    sb.from("task_done").select("day").eq("user_id", uid),
    sb.from("photos").select("*").eq("user_id", uid).order("created_at"),
    sb.from("drills").select("*").eq("user_id", uid).gte("created_at", since).order("created_at"),
    sb.from("surveys").select("*").eq("user_id", uid).order("checkpoint"),
    sb.from("if_then_plans").select("*").eq("user_id", uid).order("created_at"),
    sb.from("day_notes").select("*").eq("user_id", uid).order("day"),
    sb.from("spotkania").select("*").eq("id", 1).maybeSingle()
  ]);
  S.meet = r[7].error ? null : r[7].data;
  const err = r.slice(0, 7).find(x => x.error); if (err) return fail(err.error);
  const withT = a => a.map(e => ({ ...e, t: new Date(e.created_at).getTime() }));
  S.ev = withT(r[0].data); S.tasks = new Set(r[1].data.map(x => x.day)); S.photos = r[2].data;
  S.drills = withT(r[3].data); S.surveys = r[4].data; S.plans = r[5].data; S.notes = r[6].data;
}
function compress(file) {
  return new Promise((res, rej) => {
    const img = new Image(); img.onerror = rej;
    img.onload = () => {
      const s = Math.min(1, 1000 / Math.max(img.width, img.height)), c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => b ? res(b) : rej(new Error("compress")), "image/jpeg", 0.8);
    };
    img.src = URL.createObjectURL(file);
  });
}
async function uploadPhoto(blob) {
  const path = `${S.user.id}/${Date.now()}.jpg`;
  const up = await sb.storage.from("photos").upload(path, blob, { contentType: "image/jpeg" });
  if (up.error) { fail(up.error); return false; }
  const { data, error } = await sb.from("photos").insert({ user_id: S.user.id, day: dayRaw(), path }).select().single();
  if (error) { fail(error); return false; }
  S.photos.push(data); toast("Zdjęcie zapisane"); return true;
}
async function signed(path) { const { data } = await sb.storage.from("photos").createSignedUrl(path, 3600); return data && data.signedUrl; }
async function logDrill(kind) {
  const { data, error } = await sb.from("drills").insert({ user_id: S.user.id, day: dayRaw(), kind }).select().single();
  if (error) { fail(error); return false; }
  S.drills.push({ ...data, t: new Date(data.created_at).getTime() }); return true;
}
async function addEpisode(row) {
  const { data, error } = await sb.from("episodes").insert({ user_id: S.user.id, ...row }).select().single();
  if (error) { fail(error); return null; }
  const e = { ...data, t: new Date(data.created_at).getTime() }; S.ev.push(e); return e;
}

// ---------- Nawigacja ----------
function go(v) {
  if (v !== "sos") stopSos();
  show("v-" + v);
  document.querySelectorAll(".tab").forEach(b => b.setAttribute("aria-current", b.dataset.go === v ? "page" : "false"));
  if (v === "dzis") renderDzis();
  if (v === "postep") renderPostep();
  if (v === "sos" && !sosPractice) openSos(ls.get("sos_method") || "oddech", false);
}
document.addEventListener("click", e => { const g = e.target.closest("[data-go]"); if (g) { e.preventDefault(); sosPractice = false; go(g.dataset.go); } });

// ---------- Dziś ----------
function renderDzis() {
  const wi = weekInfo(), d = wi.d, p = wi.task;
  if (wi.maint) {
    $("weekLbl").textContent = `Tryb utrzymania · tydzień ${wi.mw} · Cześć, ${S.profile.first_name}`;
    $("dayH").textContent = `Dzień ${d}`; $("phaseLbl").textContent = "Program 90 dni ukończony"; $("pct").textContent = "100%"; $("progBar").style.width = "100%";
  } else {
    $("weekLbl").textContent = `Tydzień ${wi.week} z 12 · Cześć, ${S.profile.first_name}`;
    $("dayH").textContent = d === 90 ? "Dzień 90. Meta!" : `Dzień ${d} z 90`;
    $("phaseLbl").textContent = p.phase; $("pct").textContent = Math.round(d / 90 * 100) + "%"; $("progBar").style.width = (d / 90 * 100) + "%";
  }
  $("taskLbl").textContent = wi.maint ? "Zadanie tygodnia · utrzymanie" : "Zadanie tygodnia · odhacz dzisiaj";
  $("taskT").textContent = p.title; $("taskD").textContent = p.text;
  $("taskDone").checked = S.tasks.has(d);
  $("taskDone").onchange = async e => {
    const on = e.target.checked;
    const r = on ? await sb.from("task_done").upsert({ user_id: S.user.id, day: d }) : await sb.from("task_done").delete().eq("user_id", S.user.id).eq("day", d);
    if (r.error) { e.target.checked = !on; return fail(r.error); }
    on ? S.tasks.add(d) : S.tasks.delete(d); if (on) toast("Zadanie zaliczone");
  };

  // Komunikaty
  const wb = $("weekBanner");
  if (d === 1) { wb.hidden = false; wb.textContent = "Dzień 1. Dziś obserwujesz i zapisujesz, bez oceniania. Zrób też pierwsze ćwiczenie dotyku."; }
  else if (d === 91) { wb.hidden = false; wb.textContent = "Ukończyłeś/aś Program 90 dni. Od dziś jedno zadanie na tydzień i zdjęcie raz w miesiącu."; }
  else if (!wi.maint && d % 7 === 1) { wb.hidden = false; wb.textContent = `Zaczynasz tydzień ${wi.week}: ${p.title}. ${p.phase}.`; }
  else wb.hidden = true;
  $("surveyBanner").hidden = !dueCheckpoint();
  const lastPhoto = S.photos.at(-1), every = wi.maint ? 30 : 7;
  $("photoBanner").hidden = !(d >= 7 && (!lastPhoto || d - lastPhoto.day >= every));

  renderDrills(wi); renderPlans(wi); renderSupport(wi); renderEvening(d); renderMeet();

  const today = S.ev.filter(e => sameDay(e.t, Date.now()));
  $("sBit").textContent = today.filter(e => e.kind === "bit").length;
  $("sRes").textContent = today.filter(e => e.kind === "res").length;
  $("sWeek").textContent = S.ev.filter(e => e.kind === "res" && e.t >= Date.now() - 7 * DAY).length;
  const tips = W.P90_TIPS.slice(); if (S.profile.cuticles) tips.push("Skórki: wieczorem wmasuj krem lub olejek. Gładka skórka mniej kusi do skubania.");
  $("tip").textContent = tips[d % tips.length];
  $("installHint").hidden = isStandalone();
  $("installText").textContent = isIOS ? "W Safari dotknij „Udostępnij”, potem „Do ekranu początkowego”." : "W Chrome dotknij menu ⋮, potem „Zainstaluj aplikację” lub „Dodaj do ekranu głównego”.";
}

// ---------- Spotkanie na żywo (czas polski) ----------
function warsawNow() {
  const o = {}; new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date()).forEach(x => o[x.type] = x.value);
  return Date.UTC(+o.year, o.month - 1, +o.day, +o.hour, +o.minute); // „zegar ścienny” Warszawy zapisany jako UTC
}
function nextMeet(m) {
  if (!m || !m.dzien || !m.godzina || !m.link) return null;
  const now = warsawNow(), [h, mi] = m.godzina.split(":").map(Number), dur = (m.czas_min || 60) * 6e4;
  const today = Math.floor(now / DAY) * DAY;
  let cancelled = null;
  for (let k = 0; k < 21; k++) {
    const day = today + k * DAY, dow = (new Date(day).getUTCDay() + 6) % 7 + 1;
    if (dow !== m.dzien) continue;
    const start = day + (h * 60 + mi) * 6e4;
    if (start + dur < now) continue;
    if (m.odwolane && new Date(day).toISOString().slice(0, 10) === m.odwolane) { cancelled = day; continue; }
    return { start, k, live: now >= start - 10 * 6e4 && now <= start + dur, cancelled };
  }
  return null;
}
function renderMeet() {
  const n = nextMeet(S.meet); $("meetCard").hidden = !n; if (!n) return;
  const f = (t, o) => new Date(t).toLocaleDateString("pl-PL", { timeZone: "UTC", ...o });
  const dayTxt = n.k === 0 ? "Dziś" : n.k === 1 ? "Jutro" : f(n.start, { weekday: "long" }).replace(/^./, c => c.toUpperCase());
  const hm = new Date(n.start).toISOString().slice(11, 16);
  $("meetWhen").innerHTML = n.live ? `<b>Trwa teraz</b> · start ${hm}` : `<b>${dayTxt}, ${f(n.start, { day: "numeric", month: "long" })}</b> · godz. ${hm}`;
  if (n.cancelled) $("meetWhen").insertAdjacentHTML("beforeend", `<br><span class="small muted">Spotkanie ${f(n.cancelled, { day: "numeric", month: "long" })} jest odwołane.</span>`);
  $("meetTopic").hidden = !S.meet.temat; $("meetTopic").textContent = S.meet.temat ? "Temat: " + S.meet.temat : "";
  $("meetBtn").href = S.meet.link;
  $("meetCard").classList.toggle("live", n.live);
}

function renderDrills(wi) {
  const kinds = W.P90_drillKinds(wi.week), n = drillsToday().filter(x => x.kind === "dotyk" || x.kind === "decoupling").length, max = W.P90_DRILLS_PER_DAY;
  $("drillCount").textContent = `${Math.min(n, max)} z ${max}`;
  $("drillDots").innerHTML = Array.from({ length: max }, (_, i) => `<span class="${i < n ? "on" : ""}"></span>`).join("");
  $("drillList").innerHTML = kinds.map(k => {
    const dr = W.P90_DRILLS[k];
    const btns = k === "dotyk"
      ? `<button class="btn" type="button" data-drill-guide="dotyk">Prowadź mnie<span class="btn-sub">90 s</span></button><button class="btn ghost" type="button" data-drill="dotyk">Zrobiłem/am sam(a)</button>`
      : `<button class="btn" type="button" data-drill="decoupling">Zrobiłem/am serię 15 razy</button>`;
    return `<div class="stack" style="gap:8px"><b>${esc(dr.name)}: ${esc(dr.short)}</b><details><summary class="small">Jak to zrobić</summary><p class="small">${esc(dr.how)}</p></details><div class="row">${btns}</div></div>`;
  }).join("");
  $("drillList").querySelectorAll("[data-drill]").forEach(b => b.onclick = async () => {
    b.disabled = true;
    if (await logDrill(b.dataset.drill)) { const c = drillsToday().length; toast(c >= max ? "Komplet na dziś. Świetna robota" : `Zaliczone: ${c} z ${max}`); renderDzis(); }
    b.disabled = false;
  });
  $("drillList").querySelectorAll("[data-drill-guide]").forEach(b => b.onclick = () => { sosPractice = true; show("v-sos"); openSos(b.dataset.drillGuide, true); });
}

function canAddPlan() {
  const act = activePlans(); if (!act.length) return true;
  if (act.length >= 3) return false;
  return Date.now() - new Date(act.at(-1).created_at).getTime() >= 14 * DAY;
}
function renderPlans(wi) {
  const act = activePlans(), card = $("planCard");
  card.hidden = !act.length && wi.week < 2;
  $("planList").innerHTML = act.length
    ? act.map(p => `<div class="plan">Gdy ${esc(p.situation)}, wtedy ${esc(p.action)}. <a href="#" class="small" data-plan-edit="${p.id}">Zmień</a></div>`).join("")
    : `<p class="small">Ułóż pierwszy plan: w jakiej sytuacji co zrobisz zamiast obgryzania. To jedna z najlepiej zbadanych metod zmiany nawyku.</p>`;
  $("planAdd").hidden = !canAddPlan();
  $("planAdd").textContent = act.length ? "Dodaj kolejny" : "Ułóż plan";
  $("planList").querySelectorAll("[data-plan-edit]").forEach(a => a.onclick = e => { e.preventDefault(); openPlan(S.plans.find(p => p.id == a.dataset.planEdit)); });
}
$("planAdd").onclick = e => { e.preventDefault(); openPlan(null); };

function renderSupport(wi) {
  $("supportCard").hidden = !!S.profile.support_sent_at || wi.week > 2 || wi.maint;
  const upd = () => $("supMsg").textContent = W.P90_SUPPORT_MSG.replace("{imie}", $("supName").value.trim() || "…");
  $("supName").oninput = upd; upd();
}
$("supCopy").onclick = async () => {
  const txt = $("supMsg").textContent;
  try { await navigator.clipboard.writeText(txt); toast("Skopiowano. Wklej w SMS lub komunikatorze"); }
  catch (e) { const r = document.createRange(); r.selectNodeContents($("supMsg")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("Zaznaczono tekst. Skopiuj go ręcznie"); }
};
$("supDone").onclick = async () => {
  const row = { support_name: $("supName").value.trim() || null, support_sent_at: new Date().toISOString() };
  const { error } = await sb.from("profiles").update(row).eq("id", S.user.id);
  if (error) return fail(error);
  Object.assign(S.profile, row); toast("Super. Wsparcie bliskiej osoby naprawdę pomaga"); renderDzis();
};

function renderEvening(d) {
  const show_ = new Date().getHours() >= 18 && !S.notes.some(n => n.day === d);
  $("eveCard").hidden = !show_;
  if (show_) resetChips($("eveCard"));
}
$("eveSave").onclick = async () => {
  if (!sel.rating) return toast("Zaznacz, jak poszło");
  const row = { user_id: S.user.id, day: dayRaw(), rating: +sel.rating, helped: sel.eveHelp };
  const { data, error } = await sb.from("day_notes").upsert(row).select().single();
  if (error) return fail(error);
  S.notes = S.notes.filter(n => n.day !== row.day).concat(data);
  toast(+sel.rating >= 4 ? "Dobry dzień. Zapisane" : "Zapisane. Jutro nowy dzień"); renderDzis();
};

// ---------- Plan „jeśli… to…” ----------
let planEditing = null;
const PLACE_PHRASE = { "Kanapa / serial": "siedzę na kanapie przy serialu", "Telefon": "przeglądam telefon", "Praca / komputer": "pracuję przy komputerze", "Auto": "jadę autem", "Czekanie": "na coś czekam", "Nauka": "uczę się", "Łóżko": "leżę w łóżku" };
const EMO_ACC = { "Nuda": "nudę", "Frustracja": "frustrację", "Stres": "stres", "Lęk": "lęk", "Zmęczenie": "zmęczenie", "Niecierpliwość": "niecierpliwość", "Skupienie": "pełne skupienie" };
function topOf(arr) { const o = {}; arr.forEach(k => k && (o[k] = (o[k] || 0) + 1)); return Object.entries(o).sort((a, b) => b[1] - a[1]).map(x => x[0]); }
function openPlan(edit) {
  planEditing = edit;
  const bit = S.ev.filter(e => e.kind === "bit"), places = topOf(bit.map(e => e.place)).filter(p => PLACE_PHRASE[p]), emos = topOf(bit.flatMap(e => e.emotions || []));
  const sugg = [];
  places.slice(0, 2).forEach((p, i) => sugg.push(PLACE_PHRASE[p] + (emos[i] || emos[0] ? ` i czuję ${EMO_ACC[emos[i] || emos[0]] || ""}` : "")));
  if (topOf(bit.flatMap(e => e.fingers || [])).some(f => f !== "Nic szczególnego")) sugg.push("wyczuwam palcem nierówny brzeg paznokcia");
  ["siedzę wieczorem na kanapie", "czuję stres w pracy", "czekam w kolejce lub na przystanku"].forEach(s => sugg.length < 4 && sugg.push(s));
  $("planHint").hidden = !places.length;
  $("planHint").textContent = places.length ? `Z Twoich zapisów: najczęściej obgryzasz w miejscu „${places[0]}”${emos[0] ? `, gdy czujesz: ${emos[0].toLowerCase()}` : ""}.` : "";
  $("pSitChips").innerHTML = [...new Set(sugg)].map(s => `<button class="chip" type="button">${esc(s)}</button>`).join("");
  $("pActChips").innerHTML = W.P90_IF_ACTIONS.map(s => `<button class="chip" type="button">${esc(s)}</button>`).join("");
  $("pSitChips").querySelectorAll(".chip").forEach(c => c.onclick = () => { $("pSit").value = c.textContent; prev(); });
  $("pActChips").querySelectorAll(".chip").forEach(c => c.onclick = () => { $("pAct").value = c.textContent; prev(); });
  $("pSit").value = edit ? edit.situation : ""; $("pAct").value = edit ? edit.action : ""; prev();
  show("v-plan");
}
const clean = s => s.trim().replace(/^(gdy|jeśli|jeżeli|kiedy)\s+/i, "").replace(/^(wtedy|to)\s+/i, "").replace(/[.,\s]+$/, "");
function prev() { $("pPreview").textContent = `Gdy ${clean($("pSit").value) || "…"}, wtedy ${clean($("pAct").value) || "…"}.`; }
$("pSit").oninput = prev; $("pAct").oninput = prev;
$("pSave").onclick = async () => {
  const situation = clean($("pSit").value), action = clean($("pAct").value);
  if (situation.length < 4 || action.length < 4) return toast("Uzupełnij obie części planu");
  if (/(^|\s)nie\s/i.test(action)) return toast("Napisz, co ZROBISZ, a nie czego nie zrobisz");
  if (planEditing) {
    const r = await sb.from("if_then_plans").update({ active: false }).eq("id", planEditing.id);
    if (r.error) return fail(r.error);
    planEditing.active = false;
  }
  const { data, error } = await sb.from("if_then_plans").insert({ user_id: S.user.id, situation, action }).select().single();
  if (error) return fail(error);
  S.plans.push(data); toast("Plan zapisany. Zobaczysz go też w SOS"); go("dzis");
};

// ---------- Zapisz ----------
$("urge").oninput = e => $("urgeV").textContent = e.target.value;
let lastSlip = null;
$("save").onclick = async () => {
  if (!sel.kind) return toast("Wybierz, co się stało");
  $("save").disabled = true;
  const kind = sel.kind;
  const e = await addEpisode({ kind, aware: sel.aware, emotions: sel.emo, fingers: sel.fingers, place: sel.place, urge: +$("urge").value, helps: sel.help });
  $("save").disabled = false; if (!e) return;
  resetChips($("v-zapisz")); $("urge").value = 5; $("urgeV").textContent = 5;
  if (kind === "bit") { lastSlip = e; resetChips($("v-poslizg")); $("nextOwn").value = ""; show("v-poslizg"); }
  else { toast("Zapisano. Brawo za powstrzymanie"); go("dzis"); }
};
$("slipSave").onclick = async () => {
  const txt = $("nextOwn").value.trim() || sel.next;
  if (txt && lastSlip) {
    const { error } = await sb.from("episodes").update({ next_time: txt }).eq("id", lastSlip.id);
    if (error) return fail(error);
    lastSlip.next_time = txt;
  }
  toast("Zapisane. Wracasz do gry"); go("dzis");
};
$("slipSkip").onclick = () => go("dzis");

// ---------- SOS ----------
let timer = null, wake = null, sosMethod = "oddech", sosPractice = false;
const vib = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
function openSos(method, practice) {
  stopSos(); sosMethod = method; sosPractice = practice;
  const M = W.P90_SOS[method];
  $("sosH").textContent = practice ? "Ćwiczenie: " + M.label : "SOS · " + M.label;
  $("sosSeg").hidden = practice;
  $("sosSeg").innerHTML = Object.entries(W.P90_SOS).map(([k, m]) => `<button type="button" role="tab" aria-selected="${k === method}" data-m="${k}">${esc(m.name)}</button>`).join("");
  $("sosSeg").querySelectorAll("button").forEach(b => b.onclick = () => { ls.set("sos_method", b.dataset.m); openSos(b.dataset.m, false); });
  $("sosIntro").textContent = M.intro;
  const act = activePlans();
  $("sosPlan").hidden = practice || !act.length;
  $("sosPlan").innerHTML = act.map(p => `<b>Twój plan:</b> gdy ${esc(p.situation)}, wtedy ${esc(p.action)}.`).join("<br>");
  const breath = method === "oddech";
  $("box").hidden = !breath; $("timerBox").hidden = breath;
  $("cnt").textContent = 4; $("phase").textContent = "Gotowy/a?"; $("round").textContent = "";
  $("dot").style.transition = "none"; $("dot").style.left = "-12px"; $("dot").style.top = "-12px";
  if (!breath) { $("tCnt").textContent = M.steps[0].s; $("tText").textContent = M.steps[0].t; $("tBar").style.width = "0%"; }
  $("sosEnd").hidden = true; $("sosBtn").hidden = false; $("sosBtn").textContent = "Zacznij";
}
async function runSos() {
  stopSos(); $("sosEnd").hidden = true; $("sosBtn").textContent = "Zatrzymaj";
  try { wake = await navigator.wakeLock.request("screen"); } catch (e) {}
  let tick = 0;
  if (sosMethod === "oddech") {
    const PH = ["Wdech", "Zatrzymaj", "Wydech", "Zatrzymaj"], total = 64, box = $("box"), dot = $("dot");
    const step = () => {
      if (tick >= total) return finishSos();
      const ph = Math.floor(tick / 4) % 4, sec = tick % 4, Wd = box.clientWidth - 6, f = (sec + 1) / 4;
      const pos = [[f * Wd, 0], [Wd, f * Wd], [Wd - f * Wd, Wd], [0, Wd - f * Wd]][ph];
      dot.style.transition = "all 1s linear"; dot.style.left = (pos[0] - 12) + "px"; dot.style.top = (pos[1] - 12) + "px";
      $("phase").textContent = PH[ph]; $("cnt").textContent = 4 - sec; $("round").textContent = `Runda ${Math.floor(tick / 16) + 1} z 4`;
      vib(sec === 0 ? 150 : 40); tick++;
    };
    step(); timer = setInterval(step, 1000);
  } else {
    const steps = W.P90_SOS[sosMethod].steps, total = steps.reduce((a, s) => a + s.s, 0);
    const step = () => {
      if (tick >= total) return finishSos();
      let acc = 0, i = 0; while (tick >= acc + steps[i].s) { acc += steps[i].s; i++; }
      const left = steps[i].s - (tick - acc);
      $("tText").textContent = steps[i].t; $("tCnt").textContent = left; $("tBar").style.width = ((tick + 1) / total * 100) + "%";
      $("round").textContent = `Etap ${i + 1} z ${steps.length}`;
      if (tick === acc) vib(200);
      tick++;
    };
    step(); timer = setInterval(step, 1000);
  }
}
function stopSos() { clearInterval(timer); timer = null; $("sosBtn").textContent = "Zacznij"; try { wake && wake.release(); } catch (e) {} wake = null; }
async function finishSos() {
  stopSos(); vib([200, 100, 200]);
  if (sosMethod === "oddech") { $("phase").textContent = "Gotowe"; $("cnt").textContent = "✓"; } else { $("tCnt").textContent = "✓"; $("tText").textContent = "Gotowe"; }
  $("sosEnd").hidden = false; $("sosBtn").hidden = true;
  if (sosPractice) {
    await logDrill(sosMethod === "dotyk" ? "dotyk" : sosMethod);
    const c = drillsToday().length;
    $("sosEndH").textContent = `Ćwiczenie zaliczone (${Math.min(c, W.P90_DRILLS_PER_DAY)} z ${W.P90_DRILLS_PER_DAY} dziś)`;
    $("sosEndBtns").innerHTML = `<button class="btn" type="button" id="sosBack">Wróć do Dziś</button>`;
    $("sosBack").onclick = () => { sosPractice = false; go("dzis"); };
  } else {
    $("sosEndH").textContent = "Jak teraz impuls?";
    $("sosEndBtns").innerHTML = `<button class="btn" type="button" id="sosOk">Minął, zapisz jako powstrzymany</button><button class="btn ghost" type="button" id="sosAgain">Jeszcze raz</button>`;
    $("sosAgain").onclick = () => { $("sosBtn").hidden = false; runSos(); };
    $("sosOk").onclick = async () => {
      if (await addEpisode({ kind: "res", helps: [W.P90_SOS[sosMethod].name], source: "sos" })) { toast("Zapisano jako powstrzymany"); go("dzis"); }
    };
  }
}
$("sosBtn").onclick = () => {
  if (timer) { stopSos(); if (sosMethod === "oddech") $("phase").textContent = "Przerwano"; else $("tText").textContent = "Przerwano"; }
  else runSos();
};

// ---------- Postęp ----------
function hbars(el, obj) {
  const ent = Object.entries(obj).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 5), max = Math.max(1, ...ent.map(x => x[1]));
  el.innerHTML = ent.map(([k, v]) => `<div class="hbar"><span>${esc(k)}</span><div class="t"><span style="width:${v / max * 100}%"></span></div><b>${v}</b></div>`).join("") || '<span class="small muted">Brak danych</span>';
}
// ---------- Kalendarz 90 dni ----------
function dayOfTs(t) { const s = new Date(S.profile.start_date + "T00:00:00"), d = new Date(t); d.setHours(0, 0, 0, 0); return Math.round((d - s) / DAY) + 1; }
function renderCal() {
  const today = dayRaw(), info = {};
  const add = (d, k) => { if (d < 1 || d > 90) return; (info[d] = info[d] || { bit: 0, res: 0, drill: 0, task: 0, note: 0, act: 0 }); info[d][k]++; info[d].act++; };
  S.ev.forEach(e => add(dayOfTs(e.t), e.kind === "bit" ? "bit" : "res"));
  S.drills.forEach(e => add(dayOfTs(e.t), "drill"));
  S.tasks.forEach(d => add(d, "task"));
  S.notes.forEach(n => add(n.day, "note"));
  const state = d => d > today ? "fut" : !info[d] ? "none" : info[d].bit ? "bad" : "ok";
  const fmt = d => new Date(new Date(S.profile.start_date + "T00:00:00").getTime() + (d - 1) * DAY + 3e6).toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
  const phases = [["Faza 1 · Świadomość", 1, 4], ["Faza 2 · Zastępowanie", 5, 8], ["Faza 3 · Utrwalenie", 9, 13]];
  let html = "";
  for (const [name, w1, w2] of phases) {
    html += `<div class="cal-phase">${name}</div>`;
    for (let w = w1; w <= w2; w++) {
      html += `<div class="cal-row"><span class="cal-w">T${w}</span>`;
      for (let i = 1; i <= 7; i++) {
        const d = (w - 1) * 7 + i;
        if (d > 90) { html += `<span class="cal-x"></span>`; continue; }
        const st = state(d);
        html += `<button type="button" class="cal-d c-${st}${d === today ? " is-today" : ""}" data-d="${d}" aria-label="Dzień ${d}">${d === 90 ? "🏁" : d}</button>`;
      }
      html += `</div>`;
    }
  }
  $("cal").innerHTML = html;
  const wi = weekInfo(), cur = Math.min(today, 90);
  $("calDay").textContent = today > 90 ? "Program ukończony" : `Dzień ${today} z 90`;
  $("calStage").textContent = today > 90 ? "Jesteś w trybie utrzymania. Brawo za 90 dni." : `${W.P90_PLAN[wi.week - 1].phase} · tydzień ${wi.week}: ${W.P90_PLAN[wi.week - 1].title}`;
  const show1 = d => {
    const x = info[d], st = state(d);
    $("cal").querySelectorAll(".cal-d").forEach(b => b.classList.toggle("sel", +b.dataset.d === d));
    $("calInfo").textContent = st === "fut" ? `Dzień ${d} (${fmt(d)}) jeszcze przed Tobą.` :
      !x ? `Dzień ${d} (${fmt(d)}): brak zapisów.` :
      `Dzień ${d} (${fmt(d)}): obgryzienia ${x.bit}, powstrzymania ${x.res}, ćwiczenia ${x.drill}${x.task ? ", zadanie odhaczone" : ""}.`;
  };
  $("cal").querySelectorAll(".cal-d").forEach(b => b.onclick = () => show1(+b.dataset.d));
  show1(cur);
  let ok = 0, best = 0, run = 0;
  for (let d = 1; d <= cur; d++) { if (state(d) === "ok") { ok++; run++; best = Math.max(best, run); } else run = 0; }
  $("calSum").textContent = `Dni bez obgryzania: ${ok} · najdłuższa seria: ${best} ${best === 1 ? "dzień" : "dni"} · obecna seria: ${run} ${run === 1 ? "dzień" : "dni"}`;
}

async function renderPostep() {
  renderCal();
  const bit = S.ev.filter(e => e.kind === "bit"), now = new Date(); now.setHours(0, 0, 0, 0);
  let mx = 1; const days = [];
  for (let i = 13; i >= 0; i--) { const d = now.getTime() - i * DAY, b = bit.filter(e => sameDay(e.t, d)).length, r = S.ev.filter(e => e.kind === "res" && sameDay(e.t, d)).length; days.push([b, r]); mx = Math.max(mx, b + r); }
  $("bars").innerHTML = days.map(([b, r]) => `<div title="${b} obgryzione, ${r} powstrzymane"><i class="b" style="height:${b / mx * 100}%"></i><i class="r" style="height:${r / mx * 100}%"></i></div>`).join("");

  const emo = {}, place = {}, fing = {}, time = { "Rano 5–11": 0, "Dzień 11–17": 0, "Wieczór 17–22": 0, "Noc 22–5": 0 };
  bit.forEach(e => { (e.emotions || []).forEach(x => emo[x] = (emo[x] || 0) + 1); (e.fingers || []).forEach(x => fing[x] = (fing[x] || 0) + 1); if (e.place) place[e.place] = (place[e.place] || 0) + 1; time[W.P90_partOfDay(e.t)]++; });
  hbars($("emoBars"), emo); hbars($("timeBars"), time); hbars($("fingerBars"), fing);
  const top = o => Object.entries(o).sort((a, b) => b[1] - a[1])[0];
  const te = top(emo), tp = top(place), tt = top(time), tf = top(fing);
  let ins = bit.length >= 5
    ? `Najczęściej obgryzasz ${W.P90_WHEN[tt[0]]}${tp ? `, w miejscu „${tp[0]}”` : ""}${te ? `, gdy czujesz: ${te[0].toLowerCase()}` : ""}. Właśnie tam przygotuj swój zestaw ratunkowy i plan „jeśli… to…”.`
    : "Zapisz co najmniej 5 momentów, a pokażę Ci Twój wzorzec.";
  if (bit.length >= 5 && tf && tf[0] !== "Nic szczególnego") ins += ` Często zaczyna się od palców („${tf[0].toLowerCase()}”), więc trzymaj pilnik zawsze pod ręką i paznokcie krótko.`;
  $("insight").textContent = ins;

  const aw = S.ev.filter(e => e.aware), pre = aw.filter(e => e.aware !== "po").length;
  $("aware").textContent = aw.length ? `W ${Math.round(pre / aw.length * 100)}% zapisów zauważyłeś/aś nawyk przed lub w trakcie. Cel fazy 1: 70%.` : "Brak danych. Zaznaczaj przy zapisie, kiedy zauważyłeś/aś nawyk.";
  const wk = S.drills.filter(x => x.t >= Date.now() - 7 * DAY).length;
  $("drillSum").textContent = `Ćwiczenia na sucho: ${S.drills.length} od startu, ${wk} w ostatnich 7 dniach (cel: 21 w tygodniu).`;

  const sv = S.surveys;
  if (!sv.length) $("svTable").innerHTML = '<span class="small muted">Brak odpowiedzi.</span>';
  else {
    const rows = sv.map(s => `<tr><td>Dzień ${s.checkpoint}</td><td>${esc(W.P90_FREQ[s.freq])}</td><td>${s.urge}/10</td><td>${s.shame}/10</td></tr>`).join("");
    let change = "";
    if (sv.length >= 2) {
      const a = sv[0], b = sv.at(-1), du = a.urge - b.urge, ds = a.shame - b.shame;
      change = `<p class="small">Od startu: siła chęci ${du > 0 ? "spadła o " + du : du < 0 ? "wzrosła o " + (-du) : "bez zmian"}, wstyd ${ds > 0 ? "spadł o " + ds : ds < 0 ? "wzrósł o " + (-ds) : "bez zmian"} (w skali 0–10).</p>`;
    }
    $("svTable").innerHTML = `<div class="tablewrap"><table><thead><tr><th>Kiedy</th><th>Dziennie</th><th>Chęć</th><th>Wstyd</th></tr></thead><tbody>${rows}</tbody></table></div>${change}`;
  }

  const first = S.photos[0], later = S.photos.filter(p => first && p.day > first.day), last = later.length ? later.at(-1) : null;
  $("phAllWrap").hidden = S.photos.length < 2;
  if (S.photos.length >= 2) {
    const { data } = await sb.storage.from("photos").createSignedUrls(S.photos.map(p => p.path), 3600);
    $("phAll").innerHTML = S.photos.map((p, i) => `<figure><img alt="Dłonie, dzień ${p.day}" src="${(data && data[i] && data[i].signedUrl) || ""}"><figcaption>Dzień ${p.day}</figcaption></figure>`).join("");
  }
  if (first) { const u = await signed(first.path); if (u) $("phFirst").innerHTML = `<img alt="Dłonie, dzień ${first.day}" src="${u}">`; }
  if (last) { const u = await signed(last.path); if (u) { $("phLast").querySelectorAll("img").forEach(i => i.remove()); $("phLast").insertAdjacentHTML("beforeend", `<img alt="Dłonie, dzień ${last.day}" src="${u}">`); } }
}
$("fileN").onchange = async e => { const f = e.target.files[0]; if (!f) return; if (await uploadPhoto(await compress(f))) renderPostep(); e.target.value = ""; };
$("logout").onclick = () => sb.auth.signOut();

boot().catch(fail);
})();
