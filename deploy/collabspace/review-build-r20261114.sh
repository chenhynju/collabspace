set -eu
umask 077
stage=/opt/collabspace/shared/review-r20261114-01
test ! -e "$stage"
test "$(df -Pk /opt | awk 'NR==2{print $4}')" -gt 4000000
mkdir -m 700 "$stage"
test "$(sha256sum /opt/collabspace/shared/backend-review-r20261114-01.tgz | cut -d ' ' -f1)" = 6cfa1210736f6071a81e5876bad2e75f48f86f2e9e125dca1b89e10eade6d163
python3 - <<'PY'
import tarfile
from pathlib import PurePosixPath
with tarfile.open('/opt/collabspace/shared/backend-review-r20261114-01.tgz') as t:
 for m in t.getmembers():
  p=PurePosixPath(m.name)
  assert not p.is_absolute() and '..' not in p.parts and (m.isfile() or m.isdir())
PY
tar -xzf /opt/collabspace/shared/backend-review-r20261114-01.tgz -C "$stage"
cd "$stage"
python3 - <<'PY'
import json,hashlib
from pathlib import Path
for f in json.loads(Path('manifest.json').read_text())['files']:
 p=Path(f['path']);assert not p.is_absolute() and '..' not in p.parts
 assert hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256']
print('Backend manifest verified')
PY
DOCKER_BUILDKIT=0 docker build --memory=512m --cpu-quota=50000 -f Dockerfile.api -t collabspace-api:review-r20261114-01 . > api-build.log 2>&1
docker run --rm --network=none --memory=384m --cpus=0.5 --entrypoint node collabspace-api:review-r20261114-01 --test --test-concurrency=1 tests/assistant.test.cjs tests/extract-process.test.cjs tests/stripe.test.cjs tests/paypal.test.cjs tests/persona.test.cjs tests/voice.test.cjs > linux-tests.tap 2>&1
docker run --rm --network=none --memory=256m --entrypoint node collabspace-api:review-r20261114-01 -e 'const{MailService}=require("./dist/modules/mail/mail.service.js");let called=false;const fake={resend:{emails:{send:()=>{called=true}}},logger:{warn:()=>{}}};(async()=>{const r=await MailService.prototype.send.call(fake,"probe@example.invalid","s","h","[verify] probe@example.invalid -> https://collabspace.purelamp.uk/verify-email?token=abc");if(!r||r.provider!=="console"||called)throw Error("Mail sink broken");const real=await MailService.prototype.send.call({resend:null,logger:{warn:()=>{}}},"real-user@example.com","s","h","[verify] x");if(!real||real.provider!=="console")throw Error("console fallback broken");console.log("Mail sink active; non-synthetic path intact")})().catch(e=>{console.error(e.message);process.exitCode=1})' > modules.log 2>&1
grep -q '# fail 0' linux-tests.tap
grep -q 'Mail sink active' modules.log
docker image inspect collabspace-api:review-r20261114-01 --format '{{.Id}}' > API_IMAGE_ID
docker inspect collabspace-collab-1 --format '{{.Image}}' > WS_IMAGE_ID
tail -n 8 linux-tests.tap
cat modules.log
