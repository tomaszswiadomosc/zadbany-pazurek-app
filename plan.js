// Zadbany Pazurek — treść Programu 90 dni. Teksty możesz swobodnie poprawiać.
// Oparte na: HRT (Twohig, Woods 2003), habit replacement i decoupling (Moritz 2011, 2022, 2023),
// planach „jeśli… to…” (Gollwitzer) i modelu ComB.

// 12 tygodni w 3 fazach. "card" włącza na Dziś dodatkową kartę w danym tygodniu.
window.P90_PLAN = [
  { phase: "Faza 1 · Świadomość", title: "Obserwuj bez oceniania", text: "Zapisuj każdy moment w aplikacji, także te zauważone po fakcie. Nie próbuj jeszcze nic zmieniać, tylko zauważaj. W tym tygodniu wybierz też osobę wspierającą.", card: "support" },
  { phase: "Faza 1 · Świadomość", title: "Twój pierwszy plan „jeśli… to…”", text: "Na podstawie zapisów z tygodnia 1 ułóż jeden plan: w jakiej sytuacji co zrobisz zamiast obgryzania. Kreator jest niżej.", card: "plan" },
  { phase: "Faza 1 · Świadomość", title: "Opaska przypominajka", text: "Załóż gumkę lub bransoletkę i noś ją cały czas. Za każdym razem, gdy ją zauważysz, sprawdź, gdzie są Twoje dłonie." },
  { phase: "Faza 1 · Świadomość", title: "Pilnik zamiast zębów", text: "Pilnik zawsze pod ręką: w kieszeni, przy kanapie, w aucie. Każdą nierówność i odstającą skórkę od razu wyrównaj. Gorzki lakier nakładaj rano jako przypomnienie." },
  { phase: "Faza 2 · Zastępowanie", title: "Decoupling: trik z uchem", text: "Od dziś ćwiczenie dnia to decoupling. Ruch ręki do ust kończysz dotknięciem ucha. Ćwiczysz 3 serie dziennie, także bez ochoty na obgryzanie." },
  { phase: "Faza 2 · Zastępowanie", title: "Zestaw ratunkowy", text: "Połóż gniotek, kamyk lub pilnik w 3 miejscach, gdzie obgryzasz najczęściej. Sprawdź je w zakładce Postęp." },
  { phase: "Faza 2 · Zastępowanie", title: "Drugi plan „jeśli… to…”", text: "Dodaj plan na drugi najczęstszy wyzwalacz. Pamiętaj: zawsze piszesz, co zrobisz, nigdy „nie będę obgryzać”.", card: "plan" },
  { phase: "Faza 2 · Zastępowanie", title: "Surfowanie na impulsie", text: "Gdy poczujesz impuls, nazwij go („zauważam chęć gryzienia”) i oceń od 0 do 10. Oddychaj i oceniaj co 30 sekund. Impuls rośnie, osiąga szczyt i opada jak fala." },
  { phase: "Faza 3 · Utrwalenie", title: "Nuda i frustracja", text: "To dwa najsilniejsze wyzwalacze. Przy nudzie daj rękom zajęcie. Przy frustracji zrób 2 minuty przerwy od zadania i ćwiczenie dotyku." },
  { phase: "Faza 3 · Utrwalenie", title: "Mniej pomocy", text: "Zrezygnuj z plastrów. Gorzki lakier tylko w trudne dni. Ćwiczenia dnia zostają, bo to one utrwalają nowy ruch." },
  { phase: "Faza 3 · Utrwalenie", title: "Plan na trudne dni", text: "Ułóż plan „jeśli… to…” na stres, chorobę albo zmianę rutyny, np. urlop. Nawroty zdarzają się prawie każdemu. Liczy się szybki powrót.", card: "plan" },
  { phase: "Faza 3 · Utrwalenie", title: "Podsumowanie i co dalej", text: "Porównaj zdjęcie z dnia 1 i dzisiejsze. Wypełnij ankietę. Zapisz, co działało najlepiej, i podziel się tym w społeczności. Od dnia 91 przechodzisz w tryb utrzymania." }
];

// Tryb utrzymania od dnia 91: jedno zadanie na tydzień, po kolei w kółko.
window.P90_MAINT = [
  { title: "Tygodniowy przegląd", text: "Przejrzyj zakładkę Postęp. Jeśli liczba epizodów rośnie, wróć na tydzień do zadań z fazy 2." },
  { title: "Odśwież plan „jeśli… to…”", text: "Czy Twoje plany pasują do obecnego życia? Zmień ten, który przestał działać." },
  { title: "Zdjęcie miesięczne", text: "Raz w miesiącu zrób zdjęcie dłoni w tym samym świetle. To najlepszy dowód, że warto." },
  { title: "Pomóż komuś", text: "Napisz w społeczności, co pomogło Ci najbardziej. Dzielenie się utrwala Twój nawyk." }
];

// Ćwiczenie dnia „na sucho”: 3 razy dziennie, także bez impulsu.
window.P90_DRILLS = {
  dotyk: { name: "Dotyk", short: "1 minuta delikatnego dotyku dłoni", how: "Przez minutę delikatnie krąż opuszkami palców po wierzchu drugiej dłoni, potem stukaj lekko opuszkami w kciuk, palec po palcu, na koniec pogładź przedramię. Dotyk ma być lekki, bez nacisku. Ćwiczysz bez impulsu, żeby w chwili impulsu zrobić to automatycznie." },
  decoupling: { name: "Decoupling", short: "15 razy ręka do ust, a w ostatniej chwili do ucha", how: "Wykonaj szybki ruch ręki w stronę ust. Tuż przed ustami gwałtownie odbij dłoń w bok i dotknij płatka ucha. Powtórz 15 razy. Ruch ma być szybki i zdecydowany. Celem jest przeprogramowanie zakończenia ruchu." }
};
window.P90_drillKinds = function (week) { return week <= 4 ? ["dotyk"] : week <= 8 ? ["decoupling"] : ["dotyk", "decoupling"]; };
window.P90_DRILLS_PER_DAY = 3;

// Metody SOS. "steps" to kolejne etapy z czasem w sekundach.
window.P90_SOS = {
  oddech: { name: "Oddech", label: "Oddech kwadratowy", intro: "Połóż dłonie na udach. Oddychaj za kropką: 4 s wdech, 4 s zatrzymanie, 4 s wydech, 4 s zatrzymanie. 4 rundy, około minuty." },
  dotyk: { name: "Dotyk", label: "Dotyk zamiast zębów", intro: "Daj dłoniom zajęcie, które jest przyjemne i bezpieczne. Dotyk lekki, bez nacisku. 90 sekund.",
    steps: [{ t: "Krąż opuszkami palców po wierzchu drugiej dłoni", s: 30 }, { t: "Stukaj lekko opuszkami w kciuk, palec po palcu", s: 30 }, { t: "Gładź delikatnie przedramię", s: 30 }] },
  piesc: { name: "Pięść", label: "Pięść 60 sekund", intro: "Zaciśnij obie pięści i połóż je na udach. Oddychaj spokojnie. Ręce nie mogą teraz powędrować do ust.",
    steps: [{ t: "Zaciśnij pięści, dłonie na udach", s: 30 }, { t: "Trzymaj. Oddychaj spokojnie", s: 30 }] }
};

// Ankieta postępu
window.P90_CHECKPOINTS = [1, 14, 30, 60, 90];
window.P90_FREQ = ["Wcale", "1–2 razy", "3–5 razy", "6–10 razy", "Ponad 10 razy"];

// Plany „jeśli… to…”: podpowiedzi zachowań zastępczych
window.P90_IF_ACTIONS = ["krążę palcami po wierzchu dłoni", "zaciskam pięści na 60 sekund", "biorę gniotek do ręki", "piję łyk wody", "robię oddech kwadratowy", "piłuję nierówność pilnikiem"];

window.P90_SUPPORT_MSG = "Hej {imie}, zaczynam 90-dniowy program, żeby przestać obgryzać paznokcie. Mam prośbę: gdy zobaczysz, że obgryzam, zwróć mi delikatnie uwagę, np. jednym słowem „dłonie”. I pochwal mnie, gdy zobaczysz, że się powstrzymuję albo że paznokcie rosną. Bez krytykowania. Dzięki, że jesteś!";

window.P90_TIPS = [
  "Jeden obgryziony paznokieć to informacja, nie porażka. Spiłuj go i wracaj do planu.",
  "Impuls rośnie, osiąga szczyt i opada jak fala. Zwykle mija w 1–3 minuty.",
  "Najwięcej epizodów zdarza się przy nudzie i frustracji. Sprawdź, czy to też Twój wzorzec.",
  "Szczerość w zapisach jest ważniejsza niż wynik. Bez danych nie zobaczysz wzorca.",
  "Dłonie zajęte to dłonie bezpieczne. Miej coś pod ręką tam, gdzie obgryzasz najczęściej.",
  "Ćwiczenia na sucho robisz właśnie wtedy, gdy nie masz ochoty gryźć. Wtedy uczysz się najszybciej."
];
window.P90_EMO = ["Nuda", "Frustracja", "Stres", "Lęk", "Zmęczenie", "Niecierpliwość", "Skupienie"];
window.P90_FINGERS = ["Nierówny brzeg", "Odstająca skórka", "Ostry róg, zadra", "Mrowienie, swędzenie", "Nic szczególnego"];
window.P90_PLACES = ["Kanapa / serial", "Telefon", "Praca / komputer", "Auto", "Czekanie", "Nauka", "Łóżko", "Inne"];
window.P90_HELPS = ["Oddech", "Dotyk", "Pięść", "Dotyk ucha", "Gniotek", "Woda", "Pilnik", "Nic"];
window.P90_NEXT = ["Wezmę pilnik zamiast zębów", "Zrobię dotyk dłoni", "Zacisnę pięści", "Otworzę SOS", "Zajmę czymś ręce", "Odłożę telefon i zrobię przerwę"];

window.P90_partOfDay = function (d) {
  const h = new Date(d).getHours();
  if (h >= 5 && h < 11) return "Rano 5–11";
  if (h >= 11 && h < 17) return "Dzień 11–17";
  if (h >= 17 && h < 22) return "Wieczór 17–22";
  return "Noc 22–5";
};
// Pora dnia jako okolicznik: „najczęściej obgryzasz wieczorem”
window.P90_WHEN = { "Rano 5–11": "rano", "Dzień 11–17": "w ciągu dnia", "Wieczór 17–22": "wieczorem", "Noc 22–5": "w nocy" };
// Dzień programu bez górnej granicy (91+ to tryb utrzymania)
window.P90_dayRaw = function (startDate) {
  const s = new Date(startDate + "T00:00:00"), t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.max(1, Math.round((t - s) / 864e5) + 1);
};
window.P90_dayNo = function (startDate) { return Math.min(90, window.P90_dayRaw(startDate)); };
