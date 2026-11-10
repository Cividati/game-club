import { createLocalStore } from "./store-local.js";
import { currentMonth, monthName, cap, timeLeft, hues, initials, byRank, h, svg, isSafeHttpsUrl } from "./util.js";

const CFG = window.CLUBE_CONFIG || {};
const $ = (s) => document.querySelector(s);

const ICON = {
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-9.2-8.8C1.3 8.2 3 4.5 6.6 4.5c2.1 0 3.6 1.2 4.4 2.6.8-1.4 2.3-2.6 4.4-2.6 3.6 0 5.3 3.7 3.8 6.7C19 15.6 12 20 12 20z"/></svg>',
  crown: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5L3 7z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
};
const DURATION = { curto: "Curto", medio: "Médio", longo: "Longo" };

const state = { games: [], sort: "votes", user: null, busy: new Set(), loaded: false };
let store;

/* ---------- Boot ---------- */
async function boot() {
  const useSupabase = CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY;
  try {
    if (useSupabase) {
      const { createSupabaseStore } = await import("./store-supabase.js");
      store = await createSupabaseStore(CFG);
    } else {
      store = createLocalStore();
    }
    await store.init();
  } catch (err) {
    console.error(err);
    toast("Não deu para conectar ao banco. Mostrando o modo demonstração.");
    store = createLocalStore();
    await store.init();
  }

  $("#demo-banner").hidden = store.mode !== "demo";
  state.user = store.getUser();
  store.onAuthChange((u) => { state.user = u; renderAuth(); refresh(); });
  store.subscribe(refresh);

  renderStatic();
  renderAuth();
  renderSkeleton();
  wire();
  await refresh();
  setInterval(renderStatic, 60_000);

  // O fundo 3D é um extra: carrega depois, e se falhar o site continua igual.
  import("./scene.js").then((m) => m.startScene($("#bg"))).catch((e) => console.warn("Fundo 3D desativado:", e));
}

async function refresh() {
  try {
    state.games = await store.listGames();
    state.loaded = true;
    render();
  } catch (err) {
    console.error(err);
    toast(err.message || "Erro ao carregar os jogos.");
  }
}

/* ---------- Render ---------- */
function renderStatic() {
  const month = currentMonth();
  const name = monthName(month);
  $("#month-label").textContent = `Votação de ${name} aberta`;
  $("#ballot-kicker").textContent = `Cédula de ${monthName(month, true)}`;
  const t = timeLeft();
  $("#stat-countdown").textContent = t.days >= 1 ? `${t.days} ${t.days === 1 ? "dia" : "dias"}` : `${Math.max(1, t.hours)}h`;
}

function render() {
  const month = currentMonth();
  const current = state.games.filter((g) => g.month === month).sort(byRank);
  renderStats(current);
  renderSpotlight(current);
  renderBallot(current);
  renderHall(state.games.filter((g) => g.month < month));
}

function renderStats(current) {
  animateNumber($("#stat-games"), current.length);
  animateNumber($("#stat-votes"), current.reduce((n, g) => n + g.votes, 0));
}

function cover(game, { lazy = true } = {}) {
  const [h1, h2] = hues(game.title);
  const box = h("div", { class: "cover", style: { "--h1": h1, "--h2": h2 } }, h("div", { class: "gen" }), h("span", { class: "initials", "aria-hidden": "true" }, initials(game.title)));
  if (game.cover_url && isSafeHttpsUrl(game.cover_url)) {
    const img = h("img", { src: game.cover_url, alt: "", loading: lazy ? "lazy" : "eager", referrerpolicy: "no-referrer" });
    img.addEventListener("error", () => img.remove());
    box.prepend(img);
  }
  return box;
}

function renderSpotlight(current) {
  const el = $("#spotlight");
  const leader = current[0];
  const month = cap(monthName(currentMonth()));
  el.replaceChildren();
  el.classList.toggle("empty-spot", !leader || leader.votes === 0);

  if (!leader || leader.votes === 0) {
    el.append(h("div", { class: "spotlight-inner" },
      h("div", { class: "spotlight-body" },
        h("div", { class: "spot-empty-art", "aria-hidden": "true" }, "?"),
        h("p", { class: "kicker" }, `Jogo de ${monthName(currentMonth())}`),
        h("h3", {}, current.length ? "Ninguém votou ainda" : "A cédula está vazia"),
        h("p", { class: "muted" }, current.length ? "O primeiro voto já coloca um jogo na liderança." : "Sugira um jogo e abra a disputa do mês."),
        h("div", { class: "hero-cta", style: { "justify-content": "center", "margin-top": "20px" } },
          h("a", { class: "btn btn-primary btn-sm", href: current.length ? "#votacao" : "#", "data-action": current.length ? null : "add-game" }, current.length ? "Votar agora" : "Sugerir um jogo"))
      )));
    return;
  }

  const tie = current[1] && current[1].votes === leader.votes;
  const t = timeLeft();
  el.append(h("div", { class: "spotlight-inner" },
    h("span", { class: "badge-month" }, svg(ICON.crown), `Jogo do mês · ${month}`),
    cover(leader, { lazy: false }),
    h("div", { class: "spotlight-body" },
      h("h3", {}, leader.title),
      h("div", { class: "meta" },
        leader.platform && h("span", { class: "tag" }, leader.platform),
        leader.duration && h("span", { class: `tag t-${leader.duration}` }, DURATION[leader.duration]),
        leader.created_by_name && h("span", {}, `sugerido por ${leader.created_by_name}`)),
      h("div", { class: "spot-foot" },
        h("div", { class: "spot-votes" }, `${leader.votes} `, h("span", {}, leader.votes === 1 ? "voto" : "votos")),
        voteButton(leader)),
      h("p", { class: "note" },
        tie ? `Empate com ${current[1].title}! No empate vence quem foi sugerido primeiro. ` : "Resultado parcial. ",
        `A votação fecha no fim do dia ${t.lastDay}.`))
  ));
}

function renderSkeleton() {
  $("#games").replaceChildren(...Array.from({ length: 3 }, () => h("li", { class: "card skeleton", "aria-hidden": "true" })));
}

function renderBallot(current) {
  const list = $("#games");
  const items = state.sort === "recent" ? [...current].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) : current;
  const max = Math.max(1, ...current.map((g) => g.votes));
  const rankOf = new Map(current.map((g, i) => [g.id, i + 1]));

  $("#empty").hidden = current.length > 0;
  list.hidden = current.length === 0;

  list.replaceChildren(...items.map((g, i) => {
    const rank = rankOf.get(g.id);
    const isLeader = rank === 1 && g.votes > 0;
    const mineGame = state.user && g.created_by === state.user.id;
    return h("li", { class: `card${isLeader ? " leader" : ""}`, style: { "animation-delay": `${Math.min(i, 8) * 45}ms` }, "data-id": g.id },
      h("span", { class: "rank", title: `${rank}º lugar` }, isLeader ? svg(ICON.crown) : `${rank}º`),
      mineGame && h("div", { class: "card-menu" },
        h("button", { type: "button", class: "icon-btn", "aria-label": `Remover ${g.title}`, title: "Remover minha sugestão", onclick: () => removeGame(g) }, svg(ICON.trash))),
      cover(g),
      h("div", { class: "card-body" },
        h("h3", {}, g.title),
        (g.platform || g.duration) && h("div", { class: "tags" },
          g.platform && h("span", { class: "tag" }, g.platform),
          g.duration && h("span", { class: `tag t-${g.duration}` }, DURATION[g.duration])),
        g.pitch && h("p", { class: "pitch" }, g.pitch),
        g.created_by_name && h("p", { class: "by" }, `Sugerido por ${g.created_by_name}`),
        h("div", { class: "card-foot" },
          h("div", { class: "bar", role: "presentation" }, h("i", { style: { "--w": `${(g.votes / max) * 100}%` } })),
          h("div", { class: "vote-row" },
            h("div", { class: "count" }, String(g.votes), h("small", {}, g.votes === 1 ? "voto" : "votos")),
            voteButton(g))))
    );
  }));
}

function voteButton(g) {
  const busy = state.busy.has(g.id);
  return h("button", {
    type: "button", class: "vote-btn", "aria-pressed": String(!!g.mine), disabled: busy,
    "aria-label": g.mine ? `Tirar meu voto de ${g.title}` : `Votar em ${g.title}`,
    onclick: (e) => toggleVote(g, e.currentTarget),
  }, svg(ICON.heart), g.mine ? "Votei" : "Votar");
}

function renderHall(past) {
  const byMonth = new Map();
  for (const g of past) {
    if (!byMonth.has(g.month)) byMonth.set(g.month, []);
    byMonth.get(g.month).push(g);
  }
  const winners = [...byMonth.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, games]) => [month, games.sort(byRank)[0]])
    .filter(([, w]) => w && w.votes > 0);

  $("#hall-empty").hidden = winners.length > 0;
  $("#hall-list").replaceChildren(...winners.map(([month, w]) =>
    h("li", {},
      cover(w),
      h("div", {},
        h("div", { class: "h-month" }, monthName(month, true)),
        h("div", { class: "h-title" }, w.title),
        h("div", { class: "h-votes" }, `${w.votes} ${w.votes === 1 ? "voto" : "votos"}`)))));
}

function renderAuth() {
  const box = $("#auth");
  const u = state.user;
  if (!u) {
    box.replaceChildren(h("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: openLogin }, "Entrar"));
    return;
  }
  const [h1, h2] = hues(u.name);
  box.replaceChildren(h("div", { class: "user-chip" },
    h("span", { class: "avatar", style: { background: `linear-gradient(135deg, hsl(${h1} 90% 65%), hsl(${h2} 90% 60%))` }, "aria-hidden": "true" }, initials(u.name)),
    h("span", { class: "name", title: u.email || u.name }, u.name),
    h("button", { type: "button", class: "link-btn", onclick: () => store.signOut() }, "Sair")));
}

/* ---------- Actions ---------- */
async function toggleVote(g, btn) {
  if (!state.user) { pendingVote = g.id; openLogin(); return; }
  if (state.busy.has(g.id)) return;
  const on = !g.mine;
  // Otimista: atualiza já, desfaz se o banco recusar.
  state.busy.add(g.id);
  g.mine = on; g.votes += on ? 1 : -1;
  render();
  if (on) {
    const fresh = document.querySelector(`[data-id="${g.id}"] .vote-btn`) || btn;
    fresh.classList.add("pop");
    burst(fresh);
    window.dispatchEvent(new CustomEvent("clube:vote"));
  }
  try {
    await store.setVote(g.id, on);
  } catch (err) {
    g.mine = !on; g.votes += on ? -1 : 1;
    toast(err.message);
  } finally {
    state.busy.delete(g.id);
    await refresh();
  }
}

let pendingVote = null;

async function removeGame(g) {
  const msg = g.votes > 0
    ? `Remover "${g.title}" da votação? Os ${g.votes} voto(s) dele serão perdidos.`
    : `Remover "${g.title}" da votação?`;
  if (!confirm(msg)) return;
  try { await store.removeGame(g.id); toast("Sugestão removida."); } catch (err) { toast(err.message); }
}

function openAdd() {
  if (!state.user) { pendingAdd = true; openLogin(); return; }
  $("#add-error").textContent = "";
  $("#add-form").reset();
  $("#add-dialog").showModal();
  setTimeout(() => $("#add-form [name=title]").focus(), 30);
}
let pendingAdd = false;

function openLogin() {
  const demo = store.mode === "demo";
  $("#login-error").textContent = "";
  $("#login-ok").textContent = "";
  $("#login-email-field").hidden = demo;
  $("#login-github").hidden = demo || !CFG.ENABLE_GITHUB_LOGIN;
  $("#login-submit").textContent = demo ? "Entrar" : "Receber link";
  $("#login-help").textContent = demo
    ? "No modo demonstração basta um apelido. Com o banco ligado, cada pessoa entra com o próprio e-mail para garantir um voto por jogo."
    : "Para garantir um voto por jogo por pessoa, cada membro entra com o próprio e-mail. Mandamos um link mágico, sem senha.";
  $("#login-dialog").showModal();
  setTimeout(() => $("#login-form [name=name]").focus(), 30);
}

function wire() {
  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-action=add-game]");
    if (add) { e.preventDefault(); openAdd(); }
    const close = e.target.closest("[data-close]");
    if (close) close.closest("dialog").close();
  });
  for (const d of document.querySelectorAll("dialog")) {
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); }); // clique fora fecha
  }
  $("#login-dialog").addEventListener("close", () => { if (!state.user) { pendingAdd = false; pendingVote = null; } });

  for (const b of document.querySelectorAll("[data-sort]")) {
    b.addEventListener("click", () => {
      state.sort = b.dataset.sort;
      document.querySelectorAll("[data-sort]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      render();
    });
  }

  $("#demo-reset").addEventListener("click", () => { if (confirm("Apagar seus votos e sugestões da demo e voltar ao exemplo inicial?")) store.reset(); });

  $("#add-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const title = String(f.get("title") || "").trim().replace(/\s+/g, " ");
    const cover = String(f.get("cover") || "").trim();
    const err = $("#add-error");
    if (!title) { err.textContent = "Dê um nome ao jogo."; return; }
    if (cover && !isSafeHttpsUrl(cover)) { err.textContent = "O link da capa precisa começar com https://"; return; }
    const btn = e.target.querySelector("[type=submit]");
    btn.disabled = true;
    try {
      await store.addGame({
        title,
        platform: String(f.get("platform") || "").trim() || null,
        duration: String(f.get("duration") || "") || null,
        pitch: String(f.get("pitch") || "").trim() || null,
        cover_url: cover || null,
      });
      $("#add-dialog").close();
      toast(`"${title}" entrou na votação!`);
      await refresh();
      document.querySelector("#votacao").scrollIntoView({ behavior: "smooth" });
    } catch (ex) {
      err.textContent = ex.message;
    } finally {
      btn.disabled = false;
    }
  });

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const name = String(f.get("name") || "").trim();
    const email = String(f.get("email") || "").trim();
    const err = $("#login-error");
    err.textContent = "";
    if (store.mode === "demo" && !name) { err.textContent = "Escolha um apelido."; return; }
    if (store.mode !== "demo" && !/^\S+@\S+\.\S+$/.test(email)) { err.textContent = "Digite um e-mail válido."; return; }
    const btn = $("#login-submit");
    btn.disabled = true;
    try {
      const res = await store.signIn({ name, email });
      if (res?.emailSent) {
        $("#login-ok").textContent = `Pronto! Abra o link que enviamos para ${email} neste mesmo navegador.`;
      } else {
        $("#login-dialog").close();
        toast(`Bem-vindo ao clube, ${state.user?.name || name}!`);
        afterLogin();
      }
    } catch (ex) {
      err.textContent = ex.message;
    } finally {
      btn.disabled = false;
    }
  });

  $("#login-github").addEventListener("click", () => store.signInWithGitHub?.().catch((ex) => ($("#login-error").textContent = ex.message)));

  tilt($("#spotlight"));
}

function afterLogin() {
  if (pendingAdd) { pendingAdd = false; openAdd(); }
  else if (pendingVote) {
    const g = state.games.find((x) => x.id === pendingVote);
    pendingVote = null;
    if (g && !g.mine) setTimeout(() => toggleVote(g, document.querySelector(`[data-id="${g.id}"] .vote-btn`)), 50);
  }
}

/* ---------- Pequenos prazeres ---------- */
function toast(text) {
  const t = $("#toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 3200);
}

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function animateNumber(el, to) {
  const from = Number(el.dataset.v || 0);
  el.dataset.v = to;
  if (reduceMotion || from === to) { el.textContent = to; return; }
  const start = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - start) / 700);
    el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function burst(anchor) {
  if (reduceMotion || !anchor) return;
  const r = anchor.getBoundingClientRect();
  const colors = ["#ff4fd8", "#3ff0ff", "#c6ff3f", "#ffc34d", "#8b5cff"];
  for (let i = 0; i < 18; i++) {
    const p = h("span", { class: "burst", style: { left: `${r.left + r.width / 2}px`, top: `${r.top + r.height / 2}px`, background: colors[i % colors.length] } });
    document.body.append(p);
    const a = (Math.PI * 2 * i) / 18 + Math.random() * 0.4;
    const d = 40 + Math.random() * 50;
    p.animate([
      { transform: "translate(-50%, -50%) scale(1) rotate(0)", opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d - 20}px)) scale(.4) rotate(${Math.random() * 360}deg)`, opacity: 0 },
    ], { duration: 700 + Math.random() * 300, easing: "cubic-bezier(.2,.8,.2,1)" }).onfinish = () => p.remove();
  }
}

function tilt(el) {
  if (reduceMotion || !matchMedia("(hover: hover)").matches) return;
  el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`;
  });
  el.addEventListener("pointerleave", () => { el.style.transform = ""; });
}

boot();
