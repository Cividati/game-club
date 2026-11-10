// Armazenamento de demonstração: tudo no localStorage deste navegador.
import { currentMonth, shiftMonth } from "./util.js";

const KEY = "clube-do-game:demo:v1";

function uid() {
  return (crypto.randomUUID && crypto.randomUUID()) || Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function seed() {
  const now = currentMonth();
  const prev1 = shiftMonth(now, -1);
  const prev2 = shiftMonth(now, -2);
  const t = (daysAgo) => new Date(Date.now() - daysAgo * 864e5).toISOString();
  const g = (month, title, platform, duration, pitch, by, created_at) => ({
    id: uid(), month, title, platform, duration, pitch, cover_url: null, created_by: "demo-" + by, created_by_name: by, created_at,
  });
  const games = [
    g(now, "Outer Wilds", "Multiplataforma", "medio", "Um mistério espacial em loop de 22 minutos. Quanto menos você souber antes, melhor.", "Ana", t(6)),
    g(now, "Hades", "Multiplataforma", "medio", "Roguelike com combate viciante e uma história que avança a cada morte.", "Bruno", t(5)),
    g(now, "Celeste", "Multiplataforma", "curto", "Plataforma difícil e generoso ao mesmo tempo. Dá para fechar num fim de semana.", "Carla", t(4)),
    g(now, "Disco Elysium", "PC", "longo", "RPG sem combate, só diálogo e escolhas. Perfeito para discutir em grupo.", "Davi", t(2)),
    g(prev1, "Hollow Knight", "Multiplataforma", "longo", null, "Ana", t(40)),
    g(prev1, "Inside", "Multiplataforma", "curto", null, "Bruno", t(38)),
    g(prev2, "Stardew Valley", "Multiplataforma", "longo", null, "Carla", t(70)),
    g(prev2, "Portal 2", "PC", "curto", null, "Davi", t(68)),
  ];
  const plan = { "Outer Wilds": 4, Hades: 3, Celeste: 2, "Disco Elysium": 1, "Hollow Knight": 5, Inside: 2, "Stardew Valley": 4, "Portal 2": 3 };
  const votes = [];
  for (const game of games) for (let i = 0; i < plan[game.title]; i++) votes.push({ game_id: game.id, user_id: "demo-voter-" + i });
  return { games, votes, user: null };
}

export function createLocalStore() {
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch { db = seed(); }
  const listeners = new Set();
  const authListeners = new Set();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} };
  const emit = () => listeners.forEach((fn) => fn());
  save();

  // Mantém abas abertas em sincronia.
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    try { db = JSON.parse(e.newValue) || seed(); } catch { return; }
    emit();
    authListeners.forEach((fn) => fn(db.user));
  });

  return {
    mode: "demo",
    async init() {},
    getUser: () => db.user,
    onAuthChange(fn) { authListeners.add(fn); },
    async signIn({ name }) {
      db.user = { id: "local-" + uid(), name: name || "Visitante" };
      save();
      authListeners.forEach((fn) => fn(db.user));
      return { signedIn: true };
    },
    async signOut() {
      db.user = null;
      save();
      authListeners.forEach((fn) => fn(null));
    },
    async listGames() {
      const me = db.user?.id;
      return db.games.map((g) => {
        const vs = db.votes.filter((v) => v.game_id === g.id);
        return { ...g, votes: vs.length, mine: !!me && vs.some((v) => v.user_id === me) };
      });
    },
    async addGame(data) {
      if (!db.user) throw new Error("Entre para sugerir um jogo.");
      const month = currentMonth();
      if (db.games.some((g) => g.month === month && g.title.trim().toLowerCase() === data.title.trim().toLowerCase())) {
        throw Object.assign(new Error("Esse jogo já está na votação deste mês."), { code: "duplicate" });
      }
      db.games.push({ id: uid(), month, ...data, created_by: db.user.id, created_by_name: db.user.name, created_at: new Date().toISOString() });
      save(); emit();
    },
    async removeGame(id) {
      db.games = db.games.filter((g) => !(g.id === id && g.created_by === db.user?.id));
      db.votes = db.votes.filter((v) => db.games.some((g) => g.id === v.game_id));
      save(); emit();
    },
    async setVote(gameId, on) {
      if (!db.user) throw new Error("Entre para votar.");
      const me = db.user.id;
      const game = db.games.find((g) => g.id === gameId);
      if (!game || game.month !== currentMonth()) throw new Error("A votação desse mês já fechou.");
      const has = db.votes.some((v) => v.game_id === gameId && v.user_id === me);
      if (on && !has) db.votes.push({ game_id: gameId, user_id: me });
      if (!on) db.votes = db.votes.filter((v) => !(v.game_id === gameId && v.user_id === me));
      save(); emit();
    },
    subscribe(fn) { listeners.add(fn); },
    reset() { db = seed(); save(); emit(); authListeners.forEach((fn) => fn(null)); },
  };
}
