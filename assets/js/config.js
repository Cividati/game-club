/*
 * Configuração do Clube do Game.
 *
 * Enquanto SUPABASE_URL e SUPABASE_ANON_KEY estiverem vazios, o site roda em
 * "modo demonstração": tudo funciona, mas os votos ficam salvos só no navegador
 * de quem está usando.
 *
 * Para ligar a votação compartilhada, crie um projeto no Supabase, rode o
 * arquivo supabase/schema.sql e cole aqui a URL e a chave "anon public"
 * (Project Settings → API). A chave anon é pública por design: quem protege
 * os dados são as regras (RLS) do schema.sql.
 */
window.CLUBE_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",

  // Mostra o botão "Entrar com GitHub" (exige ativar o provedor GitHub no Supabase).
  ENABLE_GITHUB_LOGIN: false,

  // Fuso usado para decidir em que mês estamos. Precisa bater com o schema.sql.
  TIMEZONE: "America/Sao_Paulo",
};
