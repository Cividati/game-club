// Armazenamento compartilhado: Supabase (Postgres + Auth + Realtime).
// As regras de "1 voto por jogo por pessoa" ficam no banco (supabase/schema.sql),
// não aqui: o front só reflete o que o banco permite.
import { currentMonth, shiftMonth } from "./util.js";

const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
const COLS = "id,month,title,platform,duration,pitch,cover_url,created_by,created_by_name,created_at";

function friendly(error) {
  if (!error) return null;
  const msg = error.message || String(error);
  if (error.code === "23505") return Object.assign(new Error("Esse jogo já está na votação deste mês."), { code: "duplicate" });
  if (error.code === "42501" || /row-level security/i.test(msg)) return new Error("Você não tem permissão para isso (a votação desse mês pode ter fechado).");
  if (/rate limit/i.test(msg)) return new Error("Muitas tentativas seguidas. Espere um minuto e tente de novo.");
  return new Error(msg);
}

function toUser(sbUser) {
  if (!sbUser) return null;
  const md = sbUser.user_metadata || {};
  const name = md.name || md.user_name || md.full_name || (sbUser.email || "").split("@")[0] || "Membro";
  return { id: sbUser.id, name, email: sbUser.email };
}

export async function createSupabaseStore({ SUPABASE_URL, SUPABASE_ANON_KEY }) {
  const { createClient } = await import(SUPABASE_JS);
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
  });

  let user = null;
  const listeners = new Set();
  const authListeners = new Set();
  const redirectTo = location.origin + location.pathname;

  sb.auth.onAuthStateChange((_event, session) => {
    const next = toUser(session?.user);
    if (next?.id === user?.id) return;
    user = next;
    authListeners.forEach((fn) => fn(user));
  });

  let realtimeTimer;
  const ping = () => { clearTimeout(realtimeTimer); realtimeTimer = setTimeout(() => listeners.forEach((fn) => fn()), 150); };

  return {
    mode: "supabase",
    async init() {
      const { data } = await sb.auth.getSession();
      user = toUser(data.session?.user);
      // Atualizações ao vivo: quando alguém vota ou sugere, todo mundo vê.
      sb.channel("clube")
        .on("postgres_changes", { event: "*", schema: "public", table: "votes" }, ping)
        .on("postgres_changes", { event: "*", schema: "public", table: "games" }, ping)
        .subscribe();
    },
    getUser: () => user,
    onAuthChange(fn) { authListeners.add(fn); },
    async signIn({ name, email }) {
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo, data: name ? { name } : undefined },
      });
      if (error) throw friendly(error);
      return { emailSent: true };
    },
    async signInWithGitHub() {
      const { error } = await sb.auth.signInWithOAuth({ provider: "github", options: { redirectTo } });
      if (error) throw friendly(error);
    },
    async signOut() { await sb.auth.signOut(); },
    async listGames() {
      // Mês atual + últimos 12 (para o hall da fama).
      const since = shiftMonth(currentMonth(), -12);
      const [games, mine] = await Promise.all([
        sb.from("games").select(`${COLS},votes(count)`).gte("month", since).order("created_at"),
        user ? sb.from("votes").select("game_id").eq("user_id", user.id) : Promise.resolve({ data: [] }),
      ]);
      if (games.error) throw friendly(games.error);
      if (mine.error) throw friendly(mine.error);
      const mineSet = new Set((mine.data || []).map((v) => v.game_id));
      return games.data.map(({ votes, ...g }) => ({ ...g, votes: votes?.[0]?.count ?? 0, mine: mineSet.has(g.id) }));
    },
    async addGame(data) {
      if (!user) throw new Error("Entre para sugerir um jogo.");
      const { error } = await sb.from("games").insert({ ...data, month: currentMonth(), created_by_name: user.name });
      if (error) throw friendly(error);
      ping();
    },
    async removeGame(id) {
      const { error } = await sb.from("games").delete().eq("id", id);
      if (error) throw friendly(error);
      ping();
    },
    async setVote(gameId, on) {
      if (!user) throw new Error("Entre para votar.");
      const { error } = on
        ? await sb.from("votes").insert({ game_id: gameId })
        : await sb.from("votes").delete().eq("game_id", gameId).eq("user_id", user.id);
      // 23505 = já existia esse voto (ex.: clique em duas abas). O banco barrou o duplicado; está tudo certo.
      if (error && error.code !== "23505") throw friendly(error);
      ping();
    },
    subscribe(fn) { listeners.add(fn); },
  };
}
