"""Backup-first additive review release migration; never prints credentials."""
import hashlib, json, os, shlex, subprocess, sys
from pathlib import Path
from urllib.parse import urlsplit, unquote

root = Path(sys.argv[1]).resolve()
if root.parent != Path('/opt/collabspace/shared') or not root.name.startswith('review-r'):
    raise SystemExit('Unexpected release directory')
values = {}
for line in Path('/opt/collabspace/shared/.env.production').read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        key, value = line.split('=', 1)
        parts = shlex.split(value, comments=False)
        values[key.strip()] = parts[0] if len(parts) == 1 else value
url = urlsplit(values['DATABASE_ADMIN_URL'])
target = json.loads(subprocess.check_output(['docker','exec','collabspace-api-1','node','-e',
    'const u=new URL(process.env.DATABASE_URL);console.log(JSON.stringify({host:u.hostname,port:u.port,database:u.pathname}))'],text=True))
if url.path != '/collabspace' or target != {'host':'172.25.0.1','port':'5543','database':'/collabspace'}:
    raise SystemExit('Unverified database target')
env = dict(os.environ, PGHOST='127.0.0.1', PGPORT='5543', PGDATABASE='collabspace',
           PGUSER=unquote(url.username or ''), PGPASSWORD=unquote(url.password or ''))
os.umask(0o077)
backup = root/'before-review.dump'
if backup.exists():
    raise SystemExit('Backup exists; inspect before retry')
role = subprocess.check_output(['psql','-XAt','-v','ON_ERROR_STOP=1','-c',
    'SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user'],env=env,text=True).strip()
if role != 't':
    raise SystemExit('Incomplete backup role')
subprocess.run(['pg_dump','--format=custom','--file',str(backup)],env=env,check=True,timeout=180)
listing = subprocess.check_output(['pg_restore','--list',str(backup)],text=True)
if 'TABLE DATA' not in listing or 'org_organization' not in listing:
    raise SystemExit('Backup listing incomplete')
receipt={'bytes':backup.stat().st_size,'sha256':hashlib.sha256(backup.read_bytes()).hexdigest()}
(root/'backup-receipt.json').write_text(json.dumps(receipt))
print('Backup verified',json.dumps(receipt),flush=True)
# Compatible columns/index plus new meeting tables. Do not rerun historical schemas.
sql="""ALTER TABLE collab_version ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'MANUAL' CHECK(source IN ('MANUAL','AUTO'));
CREATE INDEX IF NOT EXISTS collab_version_timeline ON collab_version(organization_id,document_id,created_at DESC,id DESC);
ALTER TABLE voice_job ADD COLUMN IF NOT EXISTS speech_route text;
"""+(root/'packages/collab-store/meetings.sql').read_text()
subprocess.run(['psql','-X','--single-transaction','-v','ON_ERROR_STOP=1'],input=sql,env=env,text=True,check=True,timeout=90)
print('Review additive migration committed; backup retained',flush=True)
