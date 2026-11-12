set -eu
umask 077
stage=/opt/collabspace/shared/review-r20261112-01
previous=/opt/collabspace/shared/review-r20261030-01
cd "$stage"
test "$(docker inspect collabspace-api-1 --format '{{.Image}}')" = sha256:c47eb2f45feefcee24fedcd13fadf1a3a19f5740a39031cf00d0e7d22522a74d
test "$(docker inspect collabspace-collab-1 --format '{{.Image}}')" = sha256:4b52be9ced045d05bc1746f782308a0af2c049ef1f86431c1a02ed442355445b
test -s API_IMAGE_ID && test -s WS_IMAGE_ID
grep -q '# fail 0' linux-tests.tap
test ! -e env-before
cp -p "$previous/base-compose.yml" base-compose.yml
cp -p "$previous/override.yml" previous-override.yml
cp -p "$previous/env-before" env-before
docker inspect collabspace-api-1 --format '{{.Image}}' > previous-api-image
docker inspect collabspace-collab-1 --format '{{.Image}}' > previous-ws-image
cat > override.yml <<'YAML'
services:
  api:
    image: collabspace-api:review-r20261112-01
    environment:
      MEETINGS_ENABLED: 'false'
      MEETINGS_ACCESS_MONITOR_ENABLED: 'false'
  collab:
    image: collabspace-ws:review-r20261112-01
YAML
python3 /opt/collabspace/shared/review-native-ws-20261112.py
compose(){ docker compose --project-name collabspace --env-file env-before -f base-compose.yml -f previous-override.yml -f override.yml -f native-ws.json "$@"; }
compose config --quiet
python3 /opt/collabspace/shared/review-migrate-backup-only.py "$stage" > migration.log 2>&1
cat migration.log
uploads=$(docker inspect collabspace-api-1 --format '{{range .Mounts}}{{if eq .Destination "/app/uploads"}}{{.Source}}{{end}}{{end}}')
case "$uploads" in /var/lib/docker/volumes/collabspace_uploads/_data) ;; *) echo 'Unverified upload target'; exit 1;; esac
tar -czf before-uploads.tgz -C "$uploads" .
sha256sum before-uploads.tgz > before-uploads.sha256
rollback(){
 printf 'services:\n  api:\n    image: %s\n  collab:\n    image: %s\n' "$(cat previous-api-image)" "$(cat previous-ws-image)" > rollback.yml
 docker compose --project-name collabspace --env-file env-before -f base-compose.yml -f previous-override.yml -f rollback.yml -f native-ws.json up -d --no-build --no-deps api collab
}
if ! compose up -d --no-build --no-deps api collab; then rollback; exit 1; fi
ready=0
for i in $(seq 1 30); do
 if curl -fsS --max-time 3 http://127.0.0.1:3321/api/v1/health/ready > api-ready.json && curl -fsS --max-time 3 http://127.0.0.1:3322/health/ready > ws-ready.json; then ready=1;break;fi
 sleep 2
done
if test "$ready" != 1; then rollback;exit 1;fi
test "$(docker inspect collabspace-api-1 --format '{{.Image}}')" = "$(cat API_IMAGE_ID)"
test "$(docker inspect collabspace-collab-1 --format '{{.Image}}')" = "$(cat WS_IMAGE_ID)"
cat api-ready.json ws-ready.json
docker stats --no-stream --format '{{.Name}} CPU={{.CPUPerc}} MEM={{.MemUsage}}' collabspace-api-1 collabspace-collab-1
df -h /opt
