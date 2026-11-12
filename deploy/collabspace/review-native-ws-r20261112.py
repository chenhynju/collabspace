"""Preserve the verified native database target when composing the WS upgrade."""
import json, os, subprocess
from pathlib import Path
from urllib.parse import urlsplit
stage=Path('/opt/collabspace/shared/review-r20261112-01')
data=json.loads(subprocess.check_output(['docker','inspect','collabspace-api-1'],text=True))[0]
url=next(v.split('=',1)[1] for v in data['Config']['Env'] if v.startswith('DATABASE_URL='))
target=urlsplit(url)
if (target.hostname,target.port,target.path)!=('172.25.0.1',5543,'/collabspace'):
    raise SystemExit('Unexpected native target')
os.umask(0o077)
result={'services':{'collab':{'environment':{'DATABASE_URL':url}}}}
dest=stage/'native-ws.json'
if dest.exists(): raise SystemExit('Native override exists; inspect before retry')
dest.write_text(json.dumps(result))
print('Native WS target preserved; credentials withheld')
