#!/usr/bin/env bash
# Create (or update) the Connect Team demo server on Amazon Lightsail.
# Needs AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY for a user allowed lightsail:*.
# Usage: deploy/lightsail-demo.sh            (from the repo root)
set -euo pipefail

NAME=${NAME:-connect-team-demo}
REGION=${AWS_REGION:-us-east-2}
ZONE=${ZONE:-${REGION}a}
BUNDLE=${BUNDLE:-small_3_0}         # 2 GB RAM, 2 vCPU
BLUEPRINT=${BLUEPRINT:-ubuntu_24_04}
KEY=${KEY:-$HOME/.ssh/lightsail-$REGION.pem}
export AWS_DEFAULT_REGION=$REGION
lsail() { aws lightsail "$@"; }

if ! lsail get-instance --instance-name "$NAME" >/dev/null 2>&1; then
  echo "Creating instance $NAME ($BUNDLE in $ZONE)..."
  lsail create-instances --instance-names "$NAME" --availability-zone "$ZONE" \
    --blueprint-id "$BLUEPRINT" --bundle-id "$BUNDLE" >/dev/null
  lsail allocate-static-ip --static-ip-name "$NAME-ip" >/dev/null || true
  until [ "$(lsail get-instance --instance-name "$NAME" --query 'instance.state.name' --output text)" = running ]; do sleep 5; done
  lsail attach-static-ip --static-ip-name "$NAME-ip" --instance-name "$NAME" >/dev/null
  lsail put-instance-public-ports --instance-name "$NAME" --port-infos \
    fromPort=22,toPort=22,protocol=tcp fromPort=80,toPort=80,protocol=tcp fromPort=443,toPort=443,protocol=tcp >/dev/null
fi

IP=$(lsail get-static-ip --static-ip-name "$NAME-ip" --query 'staticIp.ipAddress' --output text)
HOST="${IP//./-}.sslip.io"   # free hostname that points at the IP, so Caddy can get an HTTPS certificate

if [ ! -f "$KEY" ]; then
  mkdir -p "$(dirname "$KEY")"
  lsail download-default-key-pair --query privateKeyBase64 --output text > "$KEY"
  chmod 600 "$KEY"
fi
SSH="ssh -i $KEY -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 ubuntu@$IP"
until $SSH true 2>/dev/null; do echo "Waiting for SSH..."; sleep 5; done

echo "Installing Docker (first run only)..."
$SSH 'command -v docker >/dev/null || (curl -fsSL https://get.docker.com | sudo sh && sudo usermod -aG docker ubuntu)'

echo "Uploading code..."
git archive --format=tar.gz HEAD | $SSH 'mkdir -p ~/app && tar -xzf - -C ~/app'

$SSH "cd ~/app/deploy && { [ -f .env ] || printf 'DB_PASSWORD=%s\nSITE_HOST=%s\n' \"\$(openssl rand -hex 24)\" '$HOST' > .env; } \
  && sudo docker compose -f docker-compose.demo.yml up -d --build \
  && sudo docker compose -f docker-compose.demo.yml exec -T -e ALLOW_DEMO_SEED=1 app npx tsx prisma/seed.ts"

echo "Done: https://$HOST"
