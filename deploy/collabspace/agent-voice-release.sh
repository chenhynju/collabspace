#!/usr/bin/env bash
set -euo pipefail
umask 077
base=/opt/collabspace/shared
version=r20261025-06
target="$base/agent-voice-$version"
old=sha256:d171444e1957206219d8a6e34069c8f8c3f437b1e80d5494edcbd5163144b1c4
oldws=sha256:e4862c6eb6ef3e283dee9a85ae287d1c9d6a6dd76221642bc02d0db9a279c307
resources(){
 date -u;uptime;free -m;df -h "$base"
 test "$(df -Pk "$base" | awk 'NR==2{print $4}')" -gt 5000000
 test "$(awk '/MemAvailable:/{print $2}' /proc/meminfo)" -gt 1000000
 awk -v n="$(nproc)" '{if($1>n*1.5)exit 1}' /proc/loadavg
}
case "${1:?phase}" in
 prepare)
  resources
  test "$(docker inspect collabspace-api-1 --format '{{.Image}}')" = "$old"
  test ! -e "$target";mkdir -m 700 "$target"
  python3 - "$base/agent-voice-$version.tgz" <<'PY'
import sys,tarfile
from pathlib import PurePosixPath
with tarfile.open(sys.argv[1]) as t:
 for m in t.getmembers():
  p=PurePosixPath(m.name)
  assert not p.is_absolute() and '..' not in p.parts and (m.isfile() or m.isdir())
PY
  tar -xzf "$base/agent-voice-$version.tgz" -C "$target"
  cd "$target"
  python3 - <<'PY'
import json,hashlib
from pathlib import Path
m=json.loads(Path('manifest.json').read_text())
assert m['base']=='sha256:d171444e1957206219d8a6e34069c8f8c3f437b1e80d5494edcbd5163144b1c4'
for f in m['files']:
 p=Path(f['path']);assert not p.is_absolute() and '..' not in p.parts
 assert hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256']
print('Verified source',m['commit'])
PY
  DOCKER_BUILDKIT=0 docker build --network=none --memory=256m --cpu-quota=50000 -t "collabspace-api:$version" .
  docker run --rm --network=none --memory=192m --cpus=0.5 --entrypoint node "collabspace-api:$version" -e "require('./apps/api/dist/modules/assistant/assistant.module');require('./apps/api/dist/modules/voice/speech-provider');console.log('Linux module load passed')"
  docker image inspect "collabspace-api:$version" --format '{{.Id}}' > IMAGE_ID
 ;;
 activate)
  resources
  test "$(docker inspect collabspace-api-1 --format '{{.Image}}')" = "$old"
  test -s "$target/IMAGE_ID"
  test "$(docker image inspect "collabspace-api:$version" --format '{{.Id}}')" = "$(cat "$target/IMAGE_ID")"
  test ! -e "$base/env-before-$version"
  cp -p "$base/.env.production" "$base/env-before-$version"
  docker inspect collabspace-api-1 --format '{{.Config.Image}} {{.Image}}' > "$base/image-before-$version"
  release="/opt/collabspace/releases/$version";test ! -e "$release";mkdir -p "$release/deploy/collabspace"
  cp "$target/compose.yml" "$release/deploy/collabspace/compose.yml";cp "$target/RELEASE_SOURCE" "$release/RELEASE_SOURCE"
  docker tag collabspace-ws:r20261024-02 "collabspace-ws:$version"
  rollback(){ cd /opt/collabspace/releases/r20261025-04; RELEASE=r20261025-04 docker compose --env-file "$base/env-before-$version" -f deploy/collabspace/compose.yml up -d --no-build --no-deps api; }
  cd "$release";export RELEASE="$version"
  if ! docker compose --env-file "$base/.env.production" -f deploy/collabspace/compose.yml up -d --no-build --no-deps api;then rollback;exit 1;fi
  ready=0;for i in $(seq 1 30);do if curl -fsS --max-time 3 http://127.0.0.1:3321/api/v1/health/ready >/dev/null;then ready=1;break;fi;sleep 2;done
  if [ "$ready" != 1 ];then rollback;exit 1;fi
  test "$(docker inspect collabspace-collab-1 --format '{{.Image}}')" = "$oldws"
  python3 - <<'PY'
from pathlib import Path
p=Path('/opt/collabspace/shared/.env.production')
p.write_text('\n'.join(s for s in p.read_text().splitlines() if not s.startswith('RELEASE='))+'\nRELEASE=r20261025-06\n');p.chmod(0o600)
PY
  echo 'API switched; no database schema or data migration'
 ;;
 verify)
  resources
  curl -fsS --max-time 10 http://127.0.0.1:3321/api/v1/health/ready
  curl -fsS --max-time 10 http://127.0.0.1:3396/healthcheck
  docker inspect collabspace-api-1 --format '{{.Image}} OOM={{.State.OOMKilled}} restarts={{.RestartCount}} memory={{.HostConfig.Memory}} cpu={{.HostConfig.NanoCpus}}'
  docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}' collabspace-api-1
 ;;
 *) exit 2;;
esac
