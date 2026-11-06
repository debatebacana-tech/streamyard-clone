# streamyard-clone

Estúdio de transmissão ao vivo self-hosted para o YouTube: host solo hoje,
convidados remotos pelo navegador amanhã, sem depender de um SaaS de terceiros.

Arquitetura: **LiveKit** (SFU self-hospedado) + **LiveKit Egress** (Web
Egress, carregando nossa própria página de composição) empurrando RTMP
direto pro YouTube. Veja o plano completo e as decisões de arquitetura em
[`docs/PLAN.md`](docs/PLAN.md).

## Estrutura

```
apps/web/   Next.js (Studio do host, página de layout, lobby do convidado, API)
infra/      docker-compose + configs de LiveKit/Egress/Caddy para a VPS
docs/       plano de arquitetura
```

## Desenvolvimento local

Você só consegue testar a UI/autenticação sem um LiveKit real; para ver a
transmissão de ponta a ponta, veja "Deploy na VPS" abaixo.

```bash
cd apps/web
npm install
cp .env.local.example .env.local   # edite os valores
echo 'DATABASE_URL="file:./dev.db"' > .env   # o CLI do Prisma só lê .env
npx prisma migrate dev --name init
npm run dev
```

Abra http://localhost:3000 — vai pedir a senha do host (`HOST_PASSWORD` no
`.env.local`).

## Deploy na VPS

Pré-requisitos: uma VPS com Docker + Docker Compose instalados (recomendação
do plano: ~4 vCPU / 8GB RAM, ex. Hetzner CPX31), e dois registros DNS
apontando pro IP da VPS:

- `studio.seudominio.com` → o app
- `livekit.seudominio.com` → o servidor LiveKit (sinalização WSS)

Na VPS:

```bash
git clone https://github.com/<seu-usuario>/streamyard-clone.git
cd streamyard-clone/infra

cp .env.example .env
# edite APP_DOMAIN e LIVEKIT_DOMAIN

cp livekit.yaml.example livekit.yaml
cp egress.yaml.example egress.yaml
cp web.env.example web.env
```

Gere as chaves e edite os três arquivos acima:

```bash
# chave/segredo do LiveKit (mesma em livekit.yaml, egress.yaml e web.env)
openssl rand -hex 16   # -> LIVEKIT_API_KEY
openssl rand -base64 32  # -> LIVEKIT_API_SECRET / SESSION_SECRET / ENCRYPTION_KEY
```

Em `livekit.yaml`, troque a linha `REPLACE_WITH_API_KEY: REPLACE_WITH_API_SECRET...`
pela chave/segredo gerados. Em `egress.yaml`, troque `api_key`/`api_secret`
pelos mesmos valores. Em `web.env`, preencha `HOST_PASSWORD`, `SESSION_SECRET`,
`ENCRYPTION_KEY`, `LIVEKIT_API_KEY` e `LIVEKIT_API_SECRET` (iguais aos dois
arquivos anteriores).

Depois:

```bash
docker compose up -d --build
```

O Caddy já emite TLS automaticamente para os dois domínios. Acesse
`https://studio.seudominio.com`, entre com a `HOST_PASSWORD`, cole a chave
de transmissão do YouTube (gerada em **YouTube Studio → Criar → Ao vivo**)
e clique em "Ir ao vivo".

### Verificação antes de ir ao ar de verdade

1. Teste com uma transmissão **Não listada** no YouTube Studio primeiro —
   observe o painel de "integridade do stream" lá.
2. Gere um link de convite no Studio e entre por outro navegador/dispositivo
   para testar o fluxo de convidado antes do programa de verdade.
3. Faça um ensaio com o número esperado de convidados por 15-30 min,
   observando `docker stats` do serviço `egress` e o gráfico de saúde do
   stream no YouTube Studio.

### Ajustando qualidade depois

O padrão é 720p30 (`EncodingOptionsPreset.H264_720P_30` em
`apps/web/src/lib/livekit.ts`). Para subir pra 1080p30: troque esse preset
para `H264_1080P_30` e redimensione a VPS para ~8 vCPU/16GB — nenhuma outra
mudança de arquitetura é necessária.
