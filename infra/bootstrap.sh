#!/usr/bin/env bash
# Deploy de um comando numa VPS Ubuntu nova (rodar como root).
# Idempotente: rodar de novo só atualiza o código e reconstrói, sem trocar as chaves.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/debatebacana-tech/streamyard-clone.git}"
BRANCH="${BRANCH:-main-2g0cpk}"
DIR="${DIR:-/opt/streamyard-clone}"

IP="$(hostname -I | awk '{print $1}')"
DASHED="${IP//./-}"
APP_DOMAIN="${APP_DOMAIN:-studio.$DASHED.sslip.io}"
LIVEKIT_DOMAIN="${LIVEKIT_DOMAIN:-livekit.$DASHED.sslip.io}"

echo ">> IP: $IP | app: $APP_DOMAIN | livekit: $LIVEKIT_DOMAIN"

if ! swapon --show | grep -q .; then
  echo ">> criando swap de 2GB"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

if ! command -v docker >/dev/null; then
  echo ">> instalando Docker"
  curl -fsSL https://get.docker.com | sh
fi
command -v git >/dev/null || apt-get install -y git

if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch origin "$BRANCH"
  git -C "$DIR" checkout -B "$BRANCH" "origin/$BRANCH"
else
  git clone -b "$BRANCH" "$REPO_URL" "$DIR"
fi
cd "$DIR/infra"

if [ ! -f web.env ]; then
  echo ">> gerando chaves e senha"
  API_KEY="API$(openssl rand -hex 8)"
  API_SECRET="$(openssl rand -hex 32)"
  HOST_PASSWORD="$(openssl rand -hex 6)"

  printf 'APP_DOMAIN=%s\nLIVEKIT_DOMAIN=%s\n' "$APP_DOMAIN" "$LIVEKIT_DOMAIN" > .env

  sed "s/REPLACE_WITH_API_KEY: REPLACE_WITH_API_SECRET_32_CHARS_MIN/$API_KEY: $API_SECRET/" \
    livekit.yaml.example > livekit.yaml
  sed -e "s/REPLACE_WITH_API_KEY/$API_KEY/" -e "s/REPLACE_WITH_API_SECRET_32_CHARS_MIN/$API_SECRET/" \
    egress.yaml.example > egress.yaml
  sed -e "s/^HOST_PASSWORD=.*/HOST_PASSWORD=$HOST_PASSWORD/" \
      -e "s/^SESSION_SECRET=.*/SESSION_SECRET=$(openssl rand -hex 32)/" \
      -e "s/^ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$(openssl rand -hex 32)/" \
      -e "s/^LIVEKIT_API_KEY=.*/LIVEKIT_API_KEY=$API_KEY/" \
      -e "s/^LIVEKIT_API_SECRET=.*/LIVEKIT_API_SECRET=$API_SECRET/" \
    web.env.example > web.env
  chmod 600 web.env livekit.yaml egress.yaml
fi

echo ">> subindo os containers (o primeiro build leva uns 5-10 min)"
docker compose up -d --build

echo
echo "=============================================="
echo " Pronto!  https://$(grep ^APP_DOMAIN .env | cut -d= -f2)"
echo " Senha do host: $(grep ^HOST_PASSWORD web.env | cut -d= -f2)"
echo "=============================================="
