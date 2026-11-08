<div align="center">

<img src="site/assets/logo.png" alt="Ouce" width="120">

# Ouce

Player de música no navegador com slowed, reverb e speed up em tempo real. Cada pessoa guarda a própria biblioteca, monta playlists e pode publicar faixas para qualquer um ouvir.

![Supabase](https://img.shields.io/badge/Supabase-5b1592?style=flat-square&labelColor=0B0B0B&logo=supabase&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20%2B-5b1592?style=flat-square&labelColor=0B0B0B&logo=nodedotjs&logoColor=white)
![Web Audio](https://img.shields.io/badge/Web_Audio-API-5b1592?style=flat-square&labelColor=0B0B0B)
![ES Modules](https://img.shields.io/badge/JavaScript-ES_Modules-5b1592?style=flat-square&labelColor=0B0B0B&logo=javascript&logoColor=white)
![Remix Icon](https://img.shields.io/badge/Remix_Icon-4.6-5b1592?style=flat-square&labelColor=0B0B0B)
![Licença](https://img.shields.io/badge/licen%C3%A7a-PolyForm--Noncommercial--1.0.0-5b1592?style=flat-square&labelColor=0B0B0B)

</div>

## Instalação

Requer Node.js 20+ (só para servir os arquivos) e um projeto no [Supabase](https://supabase.com).

```bash
git clone https://github.com/Ouce-Project/Ouce
cd Ouce
```

Não há dependências para instalar. Tudo é HTML, CSS e módulos ES puros.

## Configuração

Edite `app/js/config.js` (o modelo está em `app/js/config.example.js`):

| Variável | Obrigatória | Padrão |
|---|---|---|
| `supabaseUrl` | Sim | nenhum |
| `supabaseAnonKey` | Sim | nenhum |
| `bucket` | Não | `audio` |

> [!IMPORTANT]
> Rode `supabase/schema.sql` no SQL Editor do seu projeto antes de abrir o site. Sem ele não existem as tabelas, o bucket nem as políticas, e login, histórico, playlists e biblioteca pública não funcionam.

A chave `anon` é pública por natureza: ela vai para o navegador de qualquer jeito, por isso o `config.js` é versionado e a Vercel consegue publicá-lo. Quem protege os dados são as políticas de RLS do `schema.sql`. Nunca use a chave `service_role` aqui.

O schema foi reconstruído a partir de como o código usa as tabelas. Se você já tem um banco rodando, confira os tipos das colunas antes de aplicar.

## Execução

```bash
npm run dev        # player em http://localhost:3000
npm run dev:site   # página de info em http://localhost:3001
```

Abrir o `index.html` direto pelo explorador de arquivos não funciona, porque o player usa módulos ES e o navegador bloqueia imports em `file://`.

## Publicação

O repositório tem duas pastas publicáveis, cada uma em um projeto da Vercel (Framework Preset `Other`, sem build):

| Projeto | Root Directory | Domínio |
|---|---|---|
| Página de info | `site` | `ouce.site` (e `www.ouce.site` redirecionando) |
| Player | `app` | `app.ouce.site` |

DNS na Hostinger (Domínios, DNS / Servidores de nomes):

| Tipo | Nome | Valor |
|---|---|---|
| A | `@` | `76.76.21.21` |
| CNAME | `app` | valor exibido pela Vercel no domínio |
| CNAME | `www` | valor exibido pela Vercel no domínio |

Apague antes os registros A, AAAA e o `www` padrão que a Hostinger cria. No Supabase, em Authentication, URL Configuration, use `https://app.ouce.site` como Site URL e `https://app.ouce.site/**` em Redirect URLs.

Para aparecer no Google, adicione `ouce.site` como propriedade de domínio no Search Console (a verificação é um registro TXT no DNS da Hostinger) e envie o sitemap `https://ouce.site/sitemap.xml`.

## O que tem

- Slowed, speed up, reverb e grave ajustáveis na hora, com presets
- Vinil que gira junto com a velocidade e equalizador de fundo que reage ao áudio
- Capa em 3D com espessura e vinil que sai por trás; o cartão inclina ao passar o mouse
- Modo foco com cartão largo, detalhes na cor do tema e painel de efeitos flutuante
- Download da música já editada, em WAV, com os efeitos aplicados
- Extração de áudio de vídeos (MP4, WebM, MOV e outros que o navegador abra)
- Editor de corte com forma de onda: mantém ou remove um trecho
- A cor do site acompanha a capa da música, ou fica na cor que você escolher em hex
- Histórico, playlists e biblioteca pública com login
- Upload por clique ou arrastando arquivos, com capa lida direto do MP3
- Layout para desktop e celular

## Limites

| Item | Limite |
|---|---|
| Vídeo para extrair o áudio | 250 MB |
| Duração do áudio (extração, corte e download) | 15 minutos |
| Arquivo guardado na conta | 50 MB (o limite padrão de upload do Supabase) |

A extração e o corte geram arquivos WAV, que são grandes (cerca de 10 MB por minuto em estéreo). Arquivos acima de 50 MB tocam normalmente, mas não são guardados na conta.

## Como o som é processado

| Controle | Faixa | O que faz |
|---|---|---|
| Slowed | 0 a 100% | Velocidade de 1.00x até 0.50x |
| Speed up | 0 a 100% | Velocidade de 1.00x até 1.80x |
| Reverb | 0 a 100% | Mistura o áudio com uma resposta de impulso de 3 s |
| Grave | 0 a 100% | Realce de até +15 dB abaixo de 140 Hz |

Slowed e speed up se anulam. O tom acompanha a velocidade (`preservesPitch` desligado), como num vinil de verdade.

## Cores

| Uso | Hex |
|---|---|
| Principal | ![#5b1592](https://img.shields.io/badge/-%235B1592-5b1592?style=flat-square) |
| Preto | ![#0B0B0B](https://img.shields.io/badge/-%230B0B0B-0B0B0B?style=flat-square) |
| Cinza escuro | ![#0F0F0F](https://img.shields.io/badge/-%230F0F0F-0F0F0F?style=flat-square) |

Os tons de destaque (`--accent-hi`, `--accent-lo`) são derivados da cor principal em `app/js/theme.js`. O logo "ouce" (`site/assets/logo.png` e `wordmark.png`) fica nos espaços grandes. O símbolo de música (`symbol.png`, `app/assets/logo.png`) fica nos pequenos, como o ícone da barra e da aba. A cor escolhida fica no `localStorage` (`ouce_pref_accent`); a que vem da capa vale só para a música atual e some ao recarregar.

## Atalhos

| Tecla | Ação |
|---|---|
| `Espaço` | Tocar ou pausar |
| `←` `→` | Voltar ou avançar 5 s |
| `N` `P` | Próxima e anterior |
| `F` | Modo foco |
| `Esc` | Fechar painel de efeitos ou sair do foco |

## Estrutura

```
Ouce/
├─ app/                    o player
│  ├─ index.html
│  ├─ css/                 tokens, base, layout, player, focus, library, components, responsive
│  └─ js/
│     ├─ main.js           ponto de entrada
│     ├─ config.js         dados do Supabase
│     ├─ supabase.js       cliente
│     ├─ state.js          estado global e elemento de áudio
│     ├─ engine.js         grafo do Web Audio (reverb, grave)
│     ├─ player.js         reprodução e fila
│     ├─ effects.js        sliders e presets
│     ├─ library.js        listas e abas
│     ├─ tracks.js         envio, edição, publicação, exclusão
│     ├─ download.js       exporta a música editada em WAV
│     ├─ editor.js         editor de corte com forma de onda
│     ├─ video.js          extrai o áudio de vídeos
│     ├─ playlists.js      playlists
│     ├─ auth.js           login, cadastro, foto de perfil
│     ├─ theme.js          cor automática pela capa
│     ├─ views.js          troca de telas e modo foco
│     ├─ visuals.js        equalizador de fundo e animações
│     ├─ stats.js          contadores do site
│     ├─ ui.js             avisos e utilitários de interface
│     └─ lib/              funções puras (dom, áudio, imagem, ID3, efeitos)
├─ site/                   página de info (ouce.site)
│  ├─ index.html           conteúdo, SEO e dados estruturados
│  ├─ robots.txt, sitemap.xml, vercel.json
│  ├─ assets/              logo, wordmark, imagem de compartilhamento, ícones
│  ├─ css/
│  └─ js/                  demo de áudio e cena 3D do topo
└─ supabase/schema.sql     tabelas, funções e políticas
```

## Licença

[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/). O código é aberto para leitura: você pode estudar, copiar para uso pessoal e modificar. Uso comercial precisa de autorização do autor. Veja o arquivo `LICENSE`.
