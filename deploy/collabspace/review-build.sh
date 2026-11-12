set -eu
umask 077
stage=/opt/collabspace/shared/review-r20261030-01
test ! -e "$stage"
test "$(df -Pk /opt | awk 'NR==2{print $4}')" -gt 4000000
mkdir -m 700 "$stage"
test "$(sha256sum /opt/collabspace/shared/backend-review-r20261030-01.tgz | cut -d ' ' -f1)" = 61aa48e617e00cd5a48401fbc67889aea63a086bba9c1c147c8a06f3e3498b3a
python3 - <<'PY'
import tarfile
from pathlib import PurePosixPath
with tarfile.open('/opt/collabspace/shared/backend-review-r20261030-01.tgz') as t:
 for m in t.getmembers():
  p=PurePosixPath(m.name)
  assert not p.is_absolute() and '..' not in p.parts and (m.isfile() or m.isdir())
PY
tar -xzf /opt/collabspace/shared/backend-review-r20261030-01.tgz -C "$stage"
cd "$stage"
python3 - <<'PY'
import json,hashlib
from pathlib import Path
for f in json.loads(Path('manifest.json').read_text())['files']:
 p=Path(f['path']);assert not p.is_absolute() and '..' not in p.parts
 assert hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256']
print('Backend manifest verified')
PY
DOCKER_BUILDKIT=0 docker build --memory=512m --cpu-quota=50000 -f Dockerfile.api -t collabspace-api:review-r20261030-01 . > api-build.log 2>&1
DOCKER_BUILDKIT=0 docker build --memory=384m --cpu-quota=50000 -f Dockerfile.ws -t collabspace-ws:review-r20261030-01 . > ws-build.log 2>&1
docker run --rm --network=none --memory=384m --cpus=0.5 --entrypoint node collabspace-api:review-r20261030-01 --test --test-concurrency=1 tests/assistant.test.cjs tests/extract-process.test.cjs tests/stripe.test.cjs tests/paypal.test.cjs tests/persona.test.cjs tests/voice.test.cjs > linux-tests.tap 2>&1
docker run --rm --network=none --memory=256m --entrypoint node collabspace-api:review-r20261030-01 -e 'require("./dist/modules/meetings/meetings.service");require("./dist/modules/meetings/meeting-media.service");require("./dist/modules/voice/eleven-speech");console.log("New runtime modules load")' > modules.log 2>&1
grep -q '# fail 0' linux-tests.tap
docker image inspect collabspace-api:review-r20261030-01 --format '{{.Id}}' > API_IMAGE_ID
docker image inspect collabspace-ws:review-r20261030-01 --format '{{.Id}}' > WS_IMAGE_ID
tail -n 8 linux-tests.tap
cat modules.log
