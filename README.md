<div align="center">

<img src="site/assets/icon.png" alt="Ouce" width="112">

# Ouce

Player de música no navegador com slowed, reverb e speed up em tempo real. Cada pessoa guarda a própria biblioteca, monta playlists e pode publicar faixas para qualquer um ouvir.

![Supabase](https://img.shields.io/badge/Supabase-4000ff?style=flat-square&labelColor=0B0B0B&logo=supabase&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20%2B-4000ff?style=flat-square&labelColor=0B0B0B&logo=nodedotjs&logoColor=white)
![Web Audio](https://img.shields.io/badge/Web_Audio-API-4000ff?style=flat-square&labelColor=0B0B0B)
![ES Modules](https://img.shields.io/badge/JavaScript-ES_Modules-4000ff?style=flat-square&labelColor=0B0B0B&logo=javascript&logoColor=white)
![Remix Icon](https://img.shields.io/badge/Remix_Icon-4.6-4000ff?style=flat-square&labelColor=0B0B0B)
![Licença](https://img.shields.io/badge/licen%C3%A7a-PolyForm--Noncommercial--1.0.0-4000ff?style=flat-square&labelColor=0B0B0B)

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

Depois de publicar uma mudança de visual e não ver diferença, faça um recarregamento forçado (`Ctrl+Shift+R`). Os CSS dos temas têm `?v=` no link do `index.html`; suba o número quando mudar um deles.

## O que tem

- Slowed, speed up, reverb e grave ajustáveis na hora, com presets
- Vinil que gira junto com a velocidade e, atrás de tudo, uma linha de barras que reage ao áudio, com uma luz bem leve na cor do tema embaixo
- O reverb aparece como discos empilhados atrás do vinil, quanto mais reverb, mais ecos
- Capa em 3D com espessura e vinil que sai por trás; o cartão inclina ao passar o mouse
- Modo foco com cartão largo, detalhes na cor do tema e painel de efeitos flutuante
- Três temas: Padrão, Liquid Glass e Frutiger Aero, escolhidos em Configurações
- Modo editor no player: título, artista, capa (inclusive GIF) e som só mudam quando você salva
- Etiqueta embaixo do artista mostrando de onde a música está tocando: Biblioteca, Histórico ou Playlist com o nome
- Capa automática da biblioteca do Ouce para músicas sem capa embutida
- Download da música já editada, em WAV, com os efeitos aplicados
- Extração de áudio de vídeos (MP4, WebM, MOV e outros que o navegador abra)
- Editor de corte com forma de onda: mantém ou remove um trecho
- A cor do site acompanha a capa da música, ou fica na cor que você escolher em hex
- Histórico, playlists e biblioteca pública com login
- Busca na biblioteca com sugestões enquanto digita (ignora acentos, aceita pequenos erros de digitação, destaca o trecho encontrado) e filtros por Slowed, Speed up, Reverb e Grave
- Upload por clique ou arrastando arquivos, com capa lida direto do arquivo (MP3 em ID3v2.2, v2.3 e v2.4, FLAC e M4A)
- Layout para desktop e celular

## Temas

Em Configurações, na seção Tema. A escolha fica no `localStorage` (`ouce_style`) e é aplicada antes da página aparecer, sem piscar o tema antigo. Os temas só mudam o visual: nenhum deles move ou redimensiona elementos.

| Tema | Arquivo | Como é |
|---|---|---|
| Padrão | `css/tokens.css` e demais | Escuro, com a cor da capa |
| Liquid Glass | `css/glass.css` | Vidro quase transparente com a cor da capa ao fundo. O reflexo e a borda iluminada dos painéis seguem a luz (`js/light.js`): o mouse no computador, a inclinação do aparelho no celular |
| Frutiger Aero | `css/aero.css` | Céu e água desfocados ao fundo (`assets/aero/bg.jpg`), vidro com gloss, botões em forma de bolha e ícones no lugar das capas |

No Frutiger Aero a paleta é fixa (azul e verde-água, com um verde de folha no botão de tocar). A cor da capa e a cor personalizada ficam desligadas, e a seção de cor some das configurações. Ao voltar para outro tema, a cor da capa volta.

As capas viram ícones de vidro desenhados em SVG (`js/aero-icons.js`). O ícone é fixo para cada música: vem de palavras do título ou do artista (por exemplo, "love" vira coração e "night" vira lua) e, sem nenhuma palavra reconhecida, usa um ícone neutro escolhido pelo nome. As capas reais e os GIFs continuam guardados e voltam ao trocar de tema.

Para trocar a foto de fundo do Frutiger Aero, substitua `app/assets/aero/bg.jpg`. Uma imagem em 1920x1080 e até uns 200 KB é suficiente, porque ela aparece desfocada.

## Capas

- A capa escolhida em Modo editor aceita JPG, PNG, WebP e GIF. JPG e PNG viram um quadrado de 512 px; o GIF é guardado como está para continuar animado (até 4 MB).
- Se o arquivo de áudio não trouxer capa, o Ouce sorteia uma imagem ou GIF da pasta `app/assets/covers/` e não repete a mesma duas vezes seguidas. A capa automática fica guardada na música como uma referência (`ouce:arquivo.gif`), sem copiar o arquivo para o Storage.
- Para incluir uma capa automática nova, coloque o arquivo na pasta (nome só com letras, números, `-`, `_` e `.`) e acrescente uma linha em `app/assets/covers/covers.json`:

```json
{ "file": "nome.gif" }
```

Use só imagens que você pode usar publicamente. Se o `covers.json` não carregar, o app usa uma lista padrão com `ponte-neve.gif`.

## Modo editor

O botão "Modo editor" fica ao lado de Cortar e Publicar, nas músicas que você pode editar. Dentro dele:

- Título e artista viram campos no próprio player.
- O botão Capa mostra a nova capa como prévia, sem gravar ainda.
- Os controles de som continuam funcionando.
- **Salvar** grava título, artista, capa e o som que você deixou. **Cancelar** (ou `Esc` dentro dos campos de título e artista) desfaz tudo.

Fora do modo editor, mexer em slowed, reverb ou nos outros controles só muda o que você ouve. Nada é gravado na música, nem nas publicadas. Título e artista também continuam editáveis pela biblioteca e pelo histórico.

## Conta admin

Uma conta pode editar e apagar músicas da biblioteca pública mesmo que não sejam dela. Os botões só aparecem no app para essa conta, mas quem decide a permissão de verdade são as políticas do Supabase, então os dois lados precisam usar o mesmo e-mail:

1. Em `app/js/state.js`, troque `ADMIN_EMAIL` pelo e-mail da conta.
2. Rode o SQL abaixo no SQL Editor, trocando o e-mail da função `is_admin()`. Ele pode ser repetido sem problema, porque as políticas são recriadas.

<details>
<summary>SQL da conta admin</summary>

```sql
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'seu-email@exemplo.com'
$$;

grant execute on function public.is_admin() to authenticated;

drop policy if exists "history: admin le" on public.history;
drop policy if exists "history: admin edita" on public.history;
drop policy if exists "history: admin apaga" on public.history;

create policy "history: admin le" on public.history
  for select to authenticated using (public.is_admin());
create policy "history: admin edita" on public.history
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "history: admin apaga" on public.history
  for delete to authenticated using (public.is_admin());

drop policy if exists "audio: admin gerencia" on storage.objects;
create policy "audio: admin gerencia" on storage.objects
  for all to authenticated
  using (bucket_id = 'audio' and public.is_admin())
  with check (bucket_id = 'audio' and public.is_admin());
```

</details>

A conta admin é identificada pelo e-mail do token de login. Isso é seguro enquanto o Supabase exigir confirmação para trocar o e-mail da conta.

## Limites

| Item | Limite |
|---|---|
| Vídeo para extrair o áudio | 250 MB |
| Duração do áudio (extração, corte e download) | 15 minutos |
| Arquivo guardado na conta | 50 MB (o limite padrão de upload do Supabase) |
| Capa em GIF | 4 MB |

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
| Principal | ![#4000ff](https://img.shields.io/badge/-%234000FF-4000ff?style=flat-square) |
| Preto | ![#0B0B0B](https://img.shields.io/badge/-%230B0B0B-0B0B0B?style=flat-square) |
| Cinza escuro | ![#0F0F0F](https://img.shields.io/badge/-%230F0F0F-0F0F0F?style=flat-square) |

Os tons de destaque (`--accent-hi`, `--accent-lo`) são derivados da cor principal em `app/js/theme.js`. O logo "ouce" (`site/assets/wordmark.png` e `logo.png`) fica nos espaços grandes. O símbolo de música (`symbol.png`, `icon.png`) fica nos pequenos, como o ícone da barra e da aba. Todos os ícones são brancos sobre a cor principal. A cor escolhida fica no `localStorage` (`ouce_pref_accent`); a que vem da capa vale só para a música atual e some ao recarregar. No tema Frutiger Aero essas cores não valem (veja Temas).

## Atalhos

| Tecla | Ação |
|---|---|
| `Espaço` | Tocar ou pausar |
| `←` `→` | Voltar ou avançar 5 s |
| `N` `P` | Próxima e anterior |
| `F` | Modo foco |
| `Esc` | Fechar painel de efeitos ou sair do foco (nos campos do Modo editor, cancela a edição) |

## Estrutura

```
Ouce/
├─ app/                    o player
│  ├─ index.html
│  ├─ assets/
│  │  ├─ covers/           capas automáticas (covers.json lista os arquivos)
│  │  └─ aero/bg.jpg       fundo do tema Frutiger Aero
│  ├─ css/                 tokens, base, layout, player, focus, library, components,
│  │                       editor, responsive, glass (tema), aero (tema)
│  └─ js/
│     ├─ main.js           ponto de entrada
│     ├─ config.js         dados do Supabase
│     ├─ supabase.js       cliente
│     ├─ state.js          estado global, elemento de áudio e conta admin
│     ├─ engine.js         grafo do Web Audio (reverb, grave)
│     ├─ player.js         reprodução e fila
│     ├─ effects.js        sliders e presets
│     ├─ library.js        listas e abas
│     ├─ suggest.js        busca com sugestões e filtros
│     ├─ tracks.js         envio, edição, publicação, exclusão, capas
│     ├─ editmode.js       Modo editor do player
│     ├─ autocover.js      capa automática da pasta assets/covers
│     ├─ download.js       exporta a música editada em WAV
│     ├─ editor.js         editor de corte com forma de onda
│     ├─ video.js          extrai o áudio de vídeos
│     ├─ playlists.js      playlists
│     ├─ auth.js           login, cadastro, foto de perfil
│     ├─ theme.js          temas e cor automática pela capa
│     ├─ light.js          luz do tema Liquid Glass (mouse ou inclinação)
│     ├─ aero-icons.js     ícones de capa do tema Frutiger Aero
│     ├─ views.js          troca de telas e modo foco
│     ├─ visuals.js        equalizador de fundo e animações
│     ├─ stats.js          contadores do site
│     ├─ ui.js             avisos e utilitários de interface
│     ├─ yt-search.js      busca de músicas (ainda não ligada ao player)
│     └─ lib/              funções puras (dom, áudio, busca, imagem e capas embutidas, efeitos)
├─ site/                   página de info (ouce.site)
│  ├─ index.html           conteúdo, SEO e dados estruturados
│  ├─ robots.txt, sitemap.xml, vercel.json
│  ├─ assets/              logo, wordmark, imagem de compartilhamento, ícones
│  ├─ css/
│  └─ js/                  demo de áudio, mesa 3D da demo, cena 3D ligada à rolagem e menu mobile
└─ supabase/schema.sql     tabelas, funções e políticas
```

## Licença

[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/). O código é aberto para leitura: você pode estudar, copiar para uso pessoal e modificar. Uso comercial precisa de autorização do autor. Veja o arquivo `LICENSE`.
