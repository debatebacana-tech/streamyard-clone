#!/bin/sh
# Tunnel for embeds that block datacenter IPs (e.g. Sofascore): tailscaled runs
# in userspace with an outbound HTTP proxy; traffic through that proxy leaves
# via the team's home computer, set up as a Tailscale exit node. Only Chrome
# requests matched by the app's /proxy.pac use it.
#
# The auth key is pasted in the director area; the web app writes it to the
# shared data volume, so nothing needs to be typed on the server.
KEYFILE=/shared/tailscale-authkey
STATUS=/status/status.json
SOCK=/tmp/tailscaled.sock
TS="tailscale --socket=$SOCK"

tailscaled --tun=userspace-networking --statedir=/var/lib/tailscale --socket="$SOCK" \
  --outbound-http-proxy-listen=0.0.0.0:1055 &

last=""
while true; do
  if [ -s "$KEYFILE" ]; then
    key=$(cat "$KEYFILE")
    if [ "$key" != "$last" ]; then
      if $TS up --authkey="$key" --hostname=studio-live --accept-dns=false --reset; then
        last="$key"
      fi
    fi
    # Use the home computer as exit node; reselect if it went away and came back.
    if ! $TS status --json 2>/dev/null | grep -q '"ExitNodeStatus"'; then
      $TS set --exit-node=auto:any 2>/dev/null || {
        node=$($TS exit-node list 2>/dev/null | awk '$1 ~ /^100\./ {print $1; exit}')
        [ -n "$node" ] && $TS set --exit-node="$node"
      }
    fi
  fi
  $TS status --json > "$STATUS.tmp" 2>/dev/null && mv "$STATUS.tmp" "$STATUS"
  sleep 15
done
