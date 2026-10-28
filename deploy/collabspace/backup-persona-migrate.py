"""Approved additive persona migration; never prints connection credentials."""
import os, shlex, subprocess, sys
from pathlib import Path
from urllib.parse import urlsplit, unquote, parse_qs

root = Path(sys.argv[1]).resolve()
if not str(root).startswith('/opt/collabspace/shared/persona-release-'):
    raise SystemExit('Unexpected release directory')
values = {}
for line in Path('/opt/collabspace/shared/.env.production').read_text().splitlines():
    if not line.strip() or line.lstrip().startswith('#') or '=' not in line:
        continue
    key, value = line.split('=', 1)
    parts = shlex.split(value, comments=False)
    values[key.strip()] = parts[0] if len(parts) == 1 else value
url = urlsplit(values['DATABASE_ADMIN_URL'])
if url.path != '/collabspace':
    raise SystemExit('Unexpected database')
env = dict(os.environ, PGHOST=url.hostname, PGPORT=str(url.port or 5432),
           PGDATABASE=url.path[1:], PGUSER=unquote(url.username or ''),
           PGPASSWORD=unquote(url.password or ''))
for key, value in parse_qs(url.query).items():
    if key in ('sslmode', 'sslrootcert'):
        env['PG'+key.upper()] = value[0]
backup = root / 'before-persona.dump'
if backup.exists():
    raise SystemExit('Backup already exists; inspect previous run rather than repeat')
os.umask(0o077)
role = subprocess.check_output(['psql', '-XAt', '-v', 'ON_ERROR_STOP=1', '-c',
    'SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user'], env=env, text=True).strip()
if role != 't':
    raise SystemExit('Backup connection cannot read all tenant rows')
subprocess.run(['pg_dump', '--format=custom', '--file', str(backup)], env=env, check=True, timeout=180)
listing = subprocess.check_output(['pg_restore', '--list', str(backup)], text=True)
if 'org_organization' not in listing or 'TABLE DATA' not in listing:
    raise SystemExit('Backup listing missing business data entries')
print('Verified backup archive listing; bytes='+str(backup.stat().st_size), flush=True)
subprocess.run(['psql', '-X', '--single-transaction', '-v', 'ON_ERROR_STOP=1', '-f',
    str(root/'deploy/collabspace/digital-human-migration.sql')], env=env, check=True, timeout=90)
print('Approved additive persona transaction committed; backup retained', flush=True)
