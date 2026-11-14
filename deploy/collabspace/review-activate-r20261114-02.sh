set -eu
umask 077
stage=/opt/collabspace/shared/review-r20261114-02
previous=/opt/collabspace/shared/review-r20261114-01
cd "$stage"
test "$(docker inspect collabspace-api-1 --format '{{.Image}}')" = sha256:4f28dad9d2f6b9f879eeaba3c11d46bc7d41a77a304abdb8945d7fffc5104d49
test "$(docker inspect collabspace-collab-1 --format '{{.Image}}')" = sha256:0264eb32a2229f43270abada116fb3eeeb7957a1001641335e016e347332938f
test -s API_IMAGE_ID && test -s WS_IMAGE_ID
grep -q '# fail 0' linux-tests.tap
grep -q 'Mail sink active' modules.log
test ! -e env-before
cp -p "$previous/base-compose.yml" base-compose.yml
cp -p "$previous/override.yml" previous-override.yml
cp -p "$previous/env-before" env-before
docker inspect collabspace-api-1 --format '{{.Image}}' > previous-api-image
docker inspect collabspace-collab-1 --format '{{.Image}}' > previous-ws-image
cat > override.yml <<'YAML'
services:
  api:
    image: collabspace-api:review-r20261114-02
    environment:
      MEETINGS_ENABLED: 'false'
      MEETINGS_ACCESS_MONITOR_ENABLED: 'false'
YAML
python3 /opt/collabspace/shared/review-native-ws-r20261114-02.py
compose(){ docker compose --project-name collabspace --env-file env-before -f base-compose.yml -f previous-override.yml -f override.yml -f native-ws.json "$@"; }
compose config --quiet
python3 /opt/collabspace/shared/review-migrate-backup-only.py "$stage" > migration.log 2>&1
cat migration.log
uploads=$(docker inspect collabspace-api-1 --format '{{range .Mounts}}{{if eq .Destination "/app/uploads"}}{{.Source}}{{end}}{{end}}')
case "$uploads" in /var/lib/docker/volumes/collabspace_uploads/_data) ;; *) echo 'Unverified upload target'; exit 1;; esac
tar -czf before-uploads.tgz -C "$uploads" .
sha256sum before-uploads.tgz > before-uploads.sha256
rollback(){
 printf 'services:\n  api:\n    image: %s\n' "$(cat previous-api-image)" > rollback.yml
 docker compose --project-name collabspace --env-file env-before -f base-compose.yml -f previous-override.yml -f rollback.yml -f native-ws.json up -d --no-build --no-deps api
}
if ! compose up -d --no-build --no-deps api; then rollback; exit 1; fi
ready=0
for i in $(seq 1 30); do
 if curl -fsS --max-time 3 http://127.0.0.1:3321/api/v1/health/ready > api-ready.json; then ready=1;break;fi
 sleep 2
done
if test "$ready" != 1; then rollback;exit 1;fi
test "$(docker inspect collabspace-api-1 --format '{{.Image}}')" = "$(cat API_IMAGE_ID)"
cat api-ready.json
docker stats --no-stream --format '{{.Name}} CPU={{.CPUPerc}} MEM={{.MemUsage}}' collabspace-api-1
df -h /opt
