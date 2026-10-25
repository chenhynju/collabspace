#!/usr/bin/env bash
# Invoked explicitly after user authorization. Never prunes shared Docker resources.
set -euo pipefail
umask 077
base=/opt/collabspace/shared
version=r20261025-04
target="$base/voice-$version"
old=sha256:67315d7eddf867828496eb205dec2880af7542e8a7507ee371c07ed6f3acd3a8
oldws=sha256:e4862c6eb6ef3e283dee9a85ae287d1c9d6a6dd76221642bc02d0db9a279c307
phase="${1:?phase required}"
resources(){
 date -u; uptime; free -m; df -h "$base"
 docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}' collabspace-api-1 collabspace-postgres-1 collabspace-collab-1
 test "$(df -Pk "$base" | awk 'NR==2 {print $4}')" -gt 5000000
 test "$(awk '/MemAvailable:/{print $2}' /proc/meminfo)" -gt 1000000
 awk -v cores="$(nproc)" '{if($1>cores*1.5)exit 1}' /proc/loadavg
}
case "$phase" in
 prepare)
  resources
  test "$(docker inspect collabspace-api-1 --format '{{.Image}}')" = "$old"
  test ! -e "$target"
  mkdir -m 700 "$target"
  python3 - "$base/voice-$version.tgz" <<'PY'
import sys,tarfile
from pathlib import PurePosixPath
with tarfile.open(sys.argv[1]) as t:
 for m in t.getmembers():
  p=PurePosixPath(m.name)
  assert not p.is_absolute() and '..' not in p.parts and (m.isfile() or m.isdir()), 'Invalid archive member'
PY
  tar -xzf "$base/voice-$version.tgz" -C "$target"
  cd "$target"
  python3 - <<'PY'
import hashlib,json
from pathlib import Path
m=json.loads(Path('manifest.json').read_text())
for f in m['files']:
 p=Path(f['path']);assert not p.is_absolute() and '..' not in p.parts
 assert hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256']
print('Verified overlay:',m['baseCommit'],'worktree=',m['dirtyWorktree'],'files=',len(m['files']))
PY
  check=collabspace-voice-schema-r04
  test -z "$(docker ps -aq --filter name="^/$check$")"
  cleanup(){ docker rm -f "$check" >/dev/null 2>&1 || true; }
  trap cleanup EXIT
  docker run -d --name "$check" --network=none --memory=192m --cpus=0.5 --pids-limit=128 --tmpfs /var/lib/postgresql/data:rw,size=128m -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine -c shared_buffers=16MB -c max_connections=10 >/dev/null
  ready=0
  for i in $(seq 1 30);do if docker exec "$check" pg_isready -U postgres >/dev/null 2>&1;then ready=1;break;fi;sleep 1;done
  test "$ready" = 1
  docker cp "$target/voice.sql" "$check:/tmp/voice.sql"
  docker cp "$base/voice-schema-check.sql" "$check:/tmp/check.sql"
  docker exec "$check" psql -U postgres -d postgres -f /tmp/check.sql
  cleanup;trap - EXIT
  DOCKER_BUILDKIT=0 docker build --network=none --memory=256m --cpu-quota=50000 -t "collabspace-api:$version" .
  docker run --rm --network=none --memory=192m --cpus=0.5 --entrypoint node -w /app/apps/api "collabspace-api:$version" -e "require('./dist/modules/voice/voice.module');require('./dist/modules/im/im.controller');require('./dist/app.module');const p=new (require('./dist/modules/voice/speech-provider').SpeechProvider)();if(p.ready)throw Error('Unexpected speech credentials');console.log('Linux voice/IM/application smoke passed; cloud speech disabled')"
  docker image inspect "collabspace-api:$version" --format '{{.Id}} {{.Size}}' | tee "$target/IMAGE_ID"
  resources
 ;;
 activate)
  resources
  test "$(docker inspect collabspace-api-1 --format '{{.Image}}')" = "$old"
  test "$(docker inspect collabspace-collab-1 --format '{{.Image}}')" = "$oldws"
  test -s "$target/IMAGE_ID"
  test "$(docker image inspect "collabspace-api:$version" --format '{{.Id}}')" = "$(awk '{print $1}' "$target/IMAGE_ID")"
  for f in "before-$version.dump" "uploads-before-$version.tgz" "env-before-$version";do test ! -e "$base/$f";done
  (ulimit -f 262144; timeout 180 docker exec collabspace-postgres-1 pg_dump -U collabspace -d collabspace -Fc > "$base/before-$version.dump")
  (ulimit -f 1048576; timeout 180 docker exec collabspace-api-1 tar -C /app/uploads -czf - . > "$base/uploads-before-$version.tgz")
  docker exec -i collabspace-postgres-1 pg_restore -l < "$base/before-$version.dump" > "$base/before-$version.catalog"
  test "$(wc -l < "$base/before-$version.catalog")" -gt 100
  cp -p "$base/.env.production" "$base/env-before-$version"
  stat -c '%n %s bytes mode=%a' "$base/before-$version.dump" "$base/uploads-before-$version.tgz" "$base/env-before-$version"
  sha256sum "$base/before-$version.dump" "$base/uploads-before-$version.tgz"
  { printf "SET lock_timeout='3s'; SET statement_timeout='15s';\n";cat "$target/voice.sql"; } | docker exec -i collabspace-postgres-1 psql -U collabspace -d collabspace -v ON_ERROR_STOP=1 --single-transaction
  release="/opt/collabspace/releases/$version"
  test ! -e "$release"
  mkdir -p "$release/deploy/collabspace"
  cp "$target/compose.yml" "$release/deploy/collabspace/compose.yml"
  cp "$target/RELEASE_SOURCE" "$release/RELEASE_SOURCE"
  docker tag collabspace-ws:r20261024-02 "collabspace-ws:$version"
  rollback(){
   cp -p "$base/env-before-$version" "$base/.env.production"
   cd /opt/collabspace/releases/r20261025-03
   RELEASE=r20261025-03 docker compose --env-file "$base/.env.production" -f deploy/collabspace/compose.yml up -d --no-build --no-deps api
  }
  cd "$release";export RELEASE="$version";export VOICE_QUEUE_ENABLED=false
  if ! docker compose --env-file "$base/.env.production" -f deploy/collabspace/compose.yml up -d --no-build --no-deps api;then rollback;exit 1;fi
  ready=0
  for i in $(seq 1 30);do if curl -fsS --max-time 3 http://127.0.0.1:3321/api/v1/health/ready >/dev/null;then ready=1;break;fi;sleep 2;done
  if [ "$ready" != 1 ];then rollback;exit 1;fi
  test "$(docker inspect collabspace-collab-1 --format '{{.Image}}')" = "$oldws"
  python3 - <<'PY'
from pathlib import Path
p=Path('/opt/collabspace/shared/.env.production')
p.write_text('\n'.join(s for s in p.read_text().splitlines() if not s.startswith('RELEASE='))+'\nRELEASE=r20261025-04\n')
p.chmod(0o600)
PY
  docker inspect collabspace-api-1 collabspace-collab-1 --format '{{.Name}} {{.Config.Image}} {{.Image}} {{.State.Status}} restarts={{.RestartCount}}'
  resources
 ;;
 verify)
  resources
  curl -fsS --max-time 10 http://127.0.0.1:3321/api/v1/health/ready
  curl -fsS --max-time 10 http://127.0.0.1:3396/healthcheck
  docker inspect collabspace-api-1 --format '{{.State.OOMKilled}} {{.RestartCount}} memory={{.HostConfig.Memory}} cpu={{.HostConfig.NanoCpus}}'
 ;;
 *) exit 2;;
esac
