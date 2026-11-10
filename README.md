# Clube do Game

Como um clube do livro, só que de games: a turma sugere jogos, cada pessoa vota **uma vez em cada jogo**, e o mais votado vira o **jogo do mês**. Quando o mês vira, o vencedor entra no hall da fama e começa uma votação nova.

Site estático (HTML, CSS e JS puro, sem build) publicado no GitHub Pages, com fundo 3D em [Three.js](https://threejs.org/) e votos guardados no [Supabase](https://supabase.com/).

## Como está organizado

| Arquivo | O que faz |
| --- | --- |
| `index.html` | A página |
| `assets/css/style.css` | Visual |
| `assets/js/app.js` | Votação, ranking, jogo do mês, hall da fama |
| `assets/js/scene.js` | Fundo 3D (carrega depois da página; se o WebGL falhar, o site segue normal) |
| `assets/js/store-local.js` | Modo demonstração: votos no navegador de quem usa |
| `assets/js/store-supabase.js` | Modo real: votos compartilhados no Supabase |
| `assets/js/config.js` | URL e chave do Supabase |
| `supabase/schema.sql` | Tabelas e regras de segurança do banco |

## Publicar no GitHub Pages

1. Em **Settings → Pages** do repositório, em *Build and deployment*, escolha **Deploy from a branch**.
2. Branch **main**, pasta **/ (root)**, e clique em **Save**.
3. Em um ou dois minutos o site aparece em `https://cividati.github.io/game-club/`.

Sem banco ligado, o site abre em **modo demonstração** (com uma faixa amarela avisando): dá para testar tudo, mas cada navegador vê só os próprios votos.

## Ligar a votação compartilhada (Supabase)

O GitHub Pages só serve arquivos, então os votos precisam morar em outro lugar. O Supabase resolve banco, login e atualização ao vivo num plano gratuito, sem servidor para manter.

1. Crie uma conta e um projeto em [supabase.com](https://supabase.com/dashboard) (região *South America (São Paulo)*).
2. Abra **SQL Editor → New query**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.
3. Em **Authentication → URL Configuration**, coloque `https://cividati.github.io/game-club/` em **Site URL** e também em **Redirect URLs**.
4. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public** para `assets/js/config.js`.
5. Faça commit. Pronto: a faixa de demonstração some e os votos passam a ser de todo mundo.

A chave *anon* é pública por design (vai no navegador de qualquer forma). Quem protege os dados são as regras do `schema.sql`.

### Como o "1 voto por jogo por pessoa" é garantido

- Cada pessoa entra com o próprio e-mail por **link mágico** (sem senha). Opcionalmente, ative o login com GitHub em *Authentication → Providers* e mude `ENABLE_GITHUB_LOGIN` para `true`.
- A tabela `votes` tem chave primária `(game_id, user_id)`: o banco recusa um segundo voto da mesma pessoa no mesmo jogo, mesmo que alguém tente burlar o site.
- As regras (RLS) só deixam votar em nome próprio, só em jogos do mês atual, e só tirar o próprio voto.
- O mês é calculado no fuso de Brasília, no banco e no site.

No empate, vence o jogo sugerido primeiro.

## Rodar localmente

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```
