# streamyard-clone

Estúdio de transmissão ao vivo self-hosted para o YouTube, com vários
programas (Debate Bacana, Futebol Bacana, Sábado Bacana), convidados remotos
pelo navegador e uma Área do Diretor no estilo mesa de corte — sem depender
de um SaaS de terceiros.

## O que tem

- **Área do Diretor** (`/diretor`): escolhe o programa e controla tudo. Um
  programa no ar por vez (um canal, uma transmissão por vez).
- **Prévia e No ar**: o diretor monta a próxima cena na prévia e manda pro ar
  com "CORTAR" (ou marca "direto no ar").
- **Participantes**: convidados entram pelo link do programa e ficam nos
  bastidores até o diretor pôr em cena; destaque, mutar, remover.
- **Layouts**: grade, destaque, PiP e só um.
- **GC** com escudo/imagem e lista de GCs salvos; **letreiro**; **patrocinador**.
- **Placar e cronômetro** (selo no canto ou barra embaixo), gol com um clique,
  períodos, cronômetro calculado pela hora do servidor.
- **Central de áudio e vinhetas**: botões de som (MP3/WAV) e vinhetas em vídeo
  (MP4/WEBM), teclas 1–9, Esc para parar. Entram no áudio da live.
- **Identidade por programa**: nome, cores, logo e fundo (envio de arquivos
  pelo próprio painel).
- **OBS**: entrada WHIP (recomendado, OBS 30+) ou RTMP por programa; o OBS
  aparece como participante e entra na cena.

Arquitetura: **LiveKit** (SFU self-hospedado) + **LiveKit Egress** (Web
Egress, carregando nossa própria página de composição) empurrando RTMP
direto pro YouTube. Veja o plano completo e as decisões de arquitetura em
[`docs/PLAN.md`](docs/PLAN.md).

## Estrutura

```
apps/web/   Next.js (Área do Diretor, página de composição, lobby do convidado, API)
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

Uma VPS Ubuntu 24.04 com 2+ vCPU / 4+ GB (ex.: Hetzner CPX22). Não precisa
comprar domínio: o script usa `studio.<ip>.sslip.io` e `livekit.<ip>.sslip.io`,
que apontam pro IP sozinhos e recebem HTTPS do Let's Encrypt.

**Jeito mais fácil (sem terminal):** ao criar o servidor na Hetzner, cole em
**Cloud config**:

```yaml
#cloud-config
runcmd:
  - export HOST_PASSWORD=SuaSenha123 && curl -fsSL https://raw.githubusercontent.com/debatebacana-tech/streamyard-clone/main-2g0cpk/infra/bootstrap.sh | bash > /var/log/streamyard-bootstrap.log 2>&1
```

Ou, por SSH na VPS: `curl -fsSL .../infra/bootstrap.sh | HOST_PASSWORD=SuaSenha123 bash`.

O [`infra/bootstrap.sh`](infra/bootstrap.sh) instala Docker e swap, clona o
repo, gera todas as chaves (LiveKit, Egress, sessão, criptografia) e sobe os
containers. Ele também instala uma **atualização automática**: a cada 2
minutos a VPS confere o branch no GitHub e, se houver commit novo, reconstrói.
Ou seja, para atualizar o servidor basta dar push.

Portas usadas (a Hetzner não tem firewall por padrão): 80/443 (site e HTTPS),
7881/tcp e 50000-50200/udp (vídeo WebRTC), 1935/tcp (RTMP do OBS),
7885/udp (WHIP do OBS com transcodificação).

Depois: abra `https://studio.<ip>.sslip.io`, entre com a senha, cole a chave
de transmissão do YouTube em **Canal do YouTube** e escolha o programa.

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
