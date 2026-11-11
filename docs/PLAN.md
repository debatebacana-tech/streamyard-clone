# Clone do StreamYard — Transmissão ao vivo para YouTube (self-hosted)

## Contexto

O usuário produz programas ao vivo que sempre têm convidados e quer uma
alternativa própria ao StreamYard: transmitir para o YouTube, começando
sozinho (solo) e evoluindo para múltiplos convidados remotos entrando pelo
navegador, sem depender de um SaaS de terceiros. A decisão de hospedagem foi
VPS (nuvem), para que convidados remotos funcionem de forma confiável sem
depender da rede doméstica do host. A arquitetura foi validada para evitar
reescrever o pipeline de transmissão quando os convidados forem adicionados:
a fase solo já constrói ~80% do sistema completo.

## Arquitetura escolhida: LiveKit (self-hosted) + Egress "Room Composite"

Em vez de construir do zero (WebRTC mesh + canvas de composição + encoder +
bridge RTMP manual), usamos:

- **LiveKit server** (open source, Apache-2.0, self-hospedado via Docker) —
  SFU que roteia o áudio/vídeo WebRTC de host e convidados, com NAT
  traversal e TURN embutido.
- **LiveKit Egress (Room Composite)** — renderiza uma página web customizada
  (o "layout" do programa: grade de convidados, overlays, rodapé com nome,
  logo) num Chrome headless e já envia o resultado via **RTMP direto pro
  YouTube**, usando a chave de transmissão do canal. Isso elimina a
  necessidade de compositor/encoder/bridge próprios.
- **Redis** — barramento de mensagens entre LiveKit server e Egress
  (dependência obrigatória, mesmo em single-node).
- **Next.js** — app único com: dashboard do host (Studio), página de layout
  (o que o Egress renderiza) e página de entrada do convidado (join/lobby).
- **Caddy** — proxy reverso com TLS automático (necessário: `getUserMedia`
  exige HTTPS).

Alternativas descartadas (mesh WebRTC manual, mediasoup, Jitsi/Jibri,
OvenMediaEngine/Owncast) — todas exigiriam reconstruir manualmente o que o
Egress já resolve, ou não têm o modelo de "sala com múltiplos
participantes" necessário.

## Qualidade/custo escolhido

**720p30 para começar** (pode ser ajustado depois sem reescrever nada — é
config do Egress + redimensionamento da VPS):

- VPS inicial: ~4 vCPU / 8GB RAM (ex: Hetzner CPX31, ~$16/mês)
- Caminho de upgrade futuro para 1080p30: ~8 vCPU / 16GB RAM (~$30-33/mês
  Hetzner, ou ~$40-48/mês DigitalOcean/Vultr) — só mudança de specs da VPS
  + bitrate no Egress, sem mudança de arquitetura.

## Estrutura do repositório

```
/apps/web
  app/
    (studio)/studio/page.tsx                  # dashboard do host: go-live, overlays, controle de convidados
    (layout)/layout-view/[roomName]/page.tsx  # página que o Egress renderiza — só tiles + overlays, sem chrome de UI
    (guest)/join/[inviteToken]/page.tsx       # lobby do convidado: checagem de câmera/mic, preview, entrar
    api/
      token/route.ts                    # emite JWT do LiveKit (papel host ou guest)
      egress/start/route.ts             # chama EgressClient.startRoomCompositeEgress
      egress/stop/route.ts
      invite/route.ts                   # gera link de convite assinado (JWT)
      settings/youtube-key/route.ts     # salva a chave de transmissão do YouTube criptografada
  lib/
    livekit.ts     # wrappers server-side: AccessToken / RoomServiceClient / EgressClient
    auth.ts        # sessão simples do host (senha + cookie httpOnly)
    crypto.ts       # AES-256-GCM para criptografar a chave do YouTube em repouso
    db.ts           # cliente Prisma (SQLite)
  components/
    studio/        (LayoutSwitcher, GuestList, LowerThirdEditor, GoLiveButton)
    layout-view/    (TileGrid, Spotlight, PictureInPicture, LowerThird, LogoOverlay)
    join/           (DevicePreview, LobbyWaiting)
  prisma/schema.prisma   # configurações do programa, chave de stream criptografada
  .env.local.example

/infra
  docker-compose.yml   # redis, livekit, egress, caddy, web
  livekit.yaml          # chaves, endereço do redis, faixa de portas RTC
  egress.yaml           # endereço do redis
  caddy/Caddyfile        # TLS + proxy reverso (app, WSS do LiveKit, WHIP do OBS)
  .env                    # LIVEKIT_API_KEY/SECRET, config do Redis (rede interna apenas)
```

Bibliotecas principais: `livekit-server-sdk` (tokens, RoomService, controle
de Egress), `livekit-client` + `@livekit/components-react` (entrar na sala,
renderizar tiles), Prisma + SQLite (config persistente leve), `iron-session`
ou NextAuth Credentials (login único do host).

## Segredos

- `LIVEKIT_API_KEY`/`SECRET`: só no servidor, nunca vão pro navegador —
  cliente só recebe um JWT de curta duração emitido por `/api/token`.
- **Chave de transmissão do YouTube**: inserida uma vez no Studio →
  criptografada (AES-256-GCM) no SQLite via Prisma → só descriptografada
  dentro de `/api/egress/start`, nunca exposta a um navegador.
- **Página de layout** (carregada pelo Chrome headless do Egress): sem
  cookies disponíveis, então usa um token assinado de curta duração via
  query param, validado no servidor antes de renderizar.
- **Links de convite para convidados**: JWT assinado com nome da sala +
  validade + `role=guest`.

## Rede (docker-compose + firewall)

- `443/tcp`, `80/tcp` → Caddy (TLS, proxy para o app + WSS de sinalização
  do LiveKit em `:7880`)
- `7881/tcp` → fallback TCP do LiveKit RTC
- `50000-50200/udp` (faixa customizada via `livekit.yaml`) → mídia WebRTC
  (ICE/SRTP)
- Redis e as portas internas do Egress: **não expostas publicamente**,
  apenas na rede interna do Docker

## Entrega em fases

**Fase 1 — Solo (MVP que valida todo o pipeline)**
1. `docker-compose up`: redis, livekit, egress, caddy, web
2. `lib/livekit.ts` + `/api/token`
3. Página `layout-view` mínima: um tile de vídeo + logo + rodapé com texto
4. Página Studio: host entra na própria sala, liga câmera/compartilhamento
   de tela, edita texto do rodapé, botão "Ir ao vivo"
5. "Ir ao vivo" → `/api/egress/start` chama
   `startRoomCompositeEgress(roomName, layoutUrl+token, { stream: { urls: [rtmpYoutube] } })`.
   "Encerrar" → `/api/egress/stop`

**Fase 2 — Convidados**
1. Geração de link de convite (JWT assinado) no Studio
2. Página de lobby do convidado: permissão de câmera/mic, preview, entrar
3. Tokens de convidado com `canPublish: true`, sem permissões de admin da sala
4. Página de layout dinâmica via hooks do `@livekit/components-react`
   (`useParticipants`/`useTracks`), trocando grade/destaque/picture-in-picture
   conforme metadata da sala que o host atualiza pelo Studio
5. Controles do host (mutar/remover convidado) via
   `RoomServiceClient.mutePublishedTrack` / `removeParticipant`

## Verificação

- **Iteração local**: abrir `layout-view` direto num Chrome normal pra
  ajustar estilo/overlays antes de rodar via Egress (muito mais rápido)
- **Checagem Fase 1 no YouTube**: criar uma transmissão "Não listada" no
  YouTube Studio com uma chave de teste reutilizável; observar o painel de
  "integridade do stream" antes de ir ao público. RTMP + chave de stream
  não consome cota da API do YouTube.
- **Teste local da Fase 2**: 2-3 perfis de navegador entrando na mesma sala
  via túnel HTTPS (certificados locais do Caddy ou túnel Cloudflare/ngrok —
  `getUserMedia` exige contexto seguro) antes de usar a chave real do
  YouTube.
- **Ensaio geral**: antes de um programa de verdade, rodar com o número
  esperado de convidados por 15-30 min, observando `docker stats` do
  container do Egress e o gráfico de saúde do stream no YouTube Studio.

## Arquivos críticos da implementação inicial

- `/apps/web/lib/livekit.ts`
- `/apps/web/app/(layout)/layout-view/[roomName]/page.tsx`
- `/apps/web/app/api/egress/start/route.ts`
- `/infra/docker-compose.yml`
- `/infra/livekit.yaml`

## Pré-requisitos do usuário (antes de começar a implementação)

- Uma VPS provisionada (recomendação: Hetzner CPX31, ~4 vCPU/8GB, ~$16/mês)
  com Docker instalado
- Um domínio (ou subdomínio) apontando pra VPS, para o Caddy emitir TLS
- A chave de transmissão RTMP do canal do YouTube (gerada no YouTube Studio
  em "Criar > Ao vivo")
