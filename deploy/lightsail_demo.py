#!/usr/bin/env python3
"""Create (or update) the Connect Team demo server on Amazon Lightsail, without SSH.

Works from places where outbound SSH is blocked: the code goes up to a small
Lightsail bucket, and the server pulls it from there on boot. The server also
checks the bucket for a new code bundle every 30 seconds, so re-running this
script redeploys in place.

Needs AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY for a user allowed lightsail:*,
plus boto3 (pip install boto3). Run from the repo root:  python3 deploy/lightsail_demo.py
Demo data only. Real client data waits for the full AWS setup under the BAA.
"""
import hashlib
import io
import os
import subprocess
import sys
import time

import boto3
from botocore.config import Config

NAME = os.environ.get("NAME", "connect-team-demo")
REGION = os.environ.get("AWS_REGION", "us-east-2")
ZONE = os.environ.get("ZONE", REGION + "a")
BUNDLE = os.environ.get("BUNDLE", "small_3_0")  # 2 GB RAM, 2 vCPU
BUCKET_BUNDLE = "small_1_0"
WEEK = 7 * 24 * 3600  # longest a presigned link may live

ls = boto3.client("lightsail", region_name=REGION)


def find_bucket():
    for b in ls.get_buckets()["buckets"]:
        if b["name"].startswith(NAME + "-"):
            return b["name"]
    name = f"{NAME}-{hashlib.sha1(os.urandom(8)).hexdigest()[:8]}"
    print("Creating bucket", name)
    ls.create_bucket(bucketName=name, bundleId=BUCKET_BUNDLE)
    while ls.get_buckets(bucketName=name)["buckets"][0]["state"]["code"] != "OK":
        time.sleep(5)
    return name


def s3_client(bucket):
    # The bucket's own access key; Lightsail only shows the secret once, so keep it locally.
    path = os.path.expanduser(f"~/.config/lightsail-{bucket}.key")
    if os.path.exists(path):
        key_id, secret = open(path).read().split()
    else:
        for old in ls.get_bucket_access_keys(bucketName=bucket)["accessKeys"]:
            ls.delete_bucket_access_key(bucketName=bucket, accessKeyId=old["accessKeyId"])
        k = ls.create_bucket_access_key(bucketName=bucket)["accessKey"]
        key_id, secret = k["accessKeyId"], k["secretAccessKey"]
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            f.write(f"{key_id} {secret}\n")
        os.chmod(path, 0o600)
        time.sleep(10)  # new keys take a moment to work
    return boto3.client("s3", region_name=REGION, endpoint_url=f"https://s3.{REGION}.amazonaws.com",
                        config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
                        aws_access_key_id=key_id, aws_secret_access_key=secret)


def boot_script(get_code, get_ver, put_log):
    return f"""#!/bin/bash
exec > /var/log/connect-team-boot.log 2>&1
set -x
command -v docker >/dev/null || (curl -fsSL https://get.docker.com | sh)
cat > /usr/local/bin/connect-team-sync <<'EOF'
#!/bin/bash
# Pull a new code bundle from the bucket when its version changes, then rebuild.
ver=$(curl -fsS '{get_ver}') || exit 0
[ "$ver" = "$(cat /opt/app.ver 2>/dev/null)" ] && exit 0
{{
  set -x
  rm -rf /opt/app.new && mkdir -p /opt/app.new
  curl -fsS '{get_code}' | tar -xzf - -C /opt/app.new || exit 1
  [ -f /opt/app/deploy/.env ] && cp /opt/app/deploy/.env /opt/app.new/deploy/.env
  rm -rf /opt/app && mv /opt/app.new /opt/app
  cd /opt/app/deploy
  [ -f .env ] || printf 'DB_PASSWORD=%s\\nSITE_HOST=%s\\n' "$(openssl rand -hex 24)" \\
    "$(curl -fsS https://checkip.amazonaws.com | tr . -).sslip.io" > .env
  docker compose -f docker-compose.demo.yml up -d --build --remove-orphans || exit 1
  for i in $(seq 60); do docker compose -f docker-compose.demo.yml exec -T app npx prisma migrate status && break; sleep 5; done
  docker compose -f docker-compose.demo.yml exec -T -e ALLOW_DEMO_SEED=1 app npx tsx prisma/seed.ts || exit 1
  echo "$ver" > /opt/app.ver
  cat .env | grep SITE_HOST
  docker compose -f docker-compose.demo.yml ps
}} > /var/log/connect-team-deploy.log 2>&1
rc=$?
echo "exit=$rc ver=$ver" >> /var/log/connect-team-deploy.log
curl -fsS -X PUT --upload-file /var/log/connect-team-deploy.log '{put_log}'
EOF
chmod +x /usr/local/bin/connect-team-sync
cat > /etc/systemd/system/connect-team-sync.service <<'EOF'
[Service]
Type=oneshot
ExecStart=/usr/bin/flock -n /run/connect-team-sync.lock /usr/local/bin/connect-team-sync
EOF
cat > /etc/systemd/system/connect-team-sync.timer <<'EOF'
[Timer]
OnBootSec=10
OnUnitInactiveSec=30
[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now connect-team-sync.timer
"""


def main():
    bucket = find_bucket()
    s3 = s3_client(bucket)
    code = subprocess.run(["git", "archive", "--format=tar.gz", "HEAD"], check=True, capture_output=True).stdout
    ver = subprocess.run(["git", "rev-parse", "HEAD"], check=True, capture_output=True, text=True).stdout.strip()
    ver += "-" + str(int(time.time()))
    s3.upload_fileobj(io.BytesIO(code), bucket, "app.tar.gz")
    s3.put_object(Bucket=bucket, Key="version", Body=ver.encode())
    print("Uploaded code version", ver)

    try:
        inst = ls.get_instance(instanceName=NAME)["instance"]
    except ls.exceptions.NotFoundException:
        inst = None
    if inst is None:
        sign = lambda op, key: s3.generate_presigned_url(op, Params={"Bucket": bucket, "Key": key}, ExpiresIn=WEEK)
        script = boot_script(sign("get_object", "app.tar.gz"), sign("get_object", "version"), sign("put_object", "deploy.log"))
        print(f"Creating instance {NAME} ({BUNDLE} in {ZONE})")
        ls.create_instances(instanceNames=[NAME], availabilityZone=ZONE, blueprintId="ubuntu_24_04",
                            bundleId=BUNDLE, userData=script)
        try:
            ls.allocate_static_ip(staticIpName=NAME + "-ip")
        except ls.exceptions.InvalidInputException:
            pass
        while ls.get_instance(instanceName=NAME)["instance"]["state"]["name"] != "running":
            time.sleep(5)
        ls.attach_static_ip(staticIpName=NAME + "-ip", instanceName=NAME)
        ls.put_instance_public_ports(instanceName=NAME, portInfos=[
            {"fromPort": p, "toPort": p, "protocol": "tcp"} for p in (22, 80, 443)])

    ip = ls.get_static_ip(staticIpName=NAME + "-ip")["staticIp"]["ipAddress"]
    print("Waiting for the server to build and start (first boot takes ~10 minutes)...")
    for _ in range(120):
        time.sleep(15)
        try:
            log = s3.get_object(Bucket=bucket, Key="deploy.log")["Body"].read().decode()
        except s3.exceptions.NoSuchKey:
            continue
        if f"ver={ver}" in log:
            print(log[-3000:])
            ok = "exit=0" in log.splitlines()[-1]
            print(("Done: https://" if ok else "Deploy FAILED. Site: https://") + ip.replace(".", "-") + ".sslip.io")
            sys.exit(0 if ok else 1)
    sys.exit("Timed out waiting for the deploy log.")


if __name__ == "__main__":
    main()
