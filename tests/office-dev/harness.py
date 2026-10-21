"""Private ONLYOFFICE development harness, synthetic identities only.

This is NOT the production CollabSpace auth/storage adapter. Bind only the Docker
host bridge, access through SSH forwarding, and never publish this service.
"""
import argparse, base64, hashlib, hmac, io, json, os, secrets, threading, time, uuid, zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from urllib.request import Request, build_opener, HTTPRedirectHandler

USERS = {'alice': 'Alice · isolated editor', 'bob': 'Bob · isolated editor', 'viewer': 'Viewer · read only'}
FORMATS = {'word': 'docx', 'sheet': 'xlsx', 'slides': 'pptx'}
MAX = 20 * 1024 * 1024

def b64(value): return base64.urlsafe_b64encode(value).rstrip(b'=').decode()
def sign(value, secret):
    body = b64(json.dumps({'alg': 'HS256', 'typ': 'JWT'}, separators=(',', ':')).encode()) + '.' + b64(json.dumps(value, separators=(',', ':')).encode())
    return body + '.' + b64(hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest())
def verify(token, secret):
    if not isinstance(token, str) or len(token) > 65536: raise ValueError('invalid token')
    a, b, c = token.split('.')
    if not hmac.compare_digest(c, b64(hmac.new(secret.encode(), (a+'.'+b).encode(), hashlib.sha256).digest())): raise ValueError('signature')
    decode = lambda s: json.loads(base64.urlsafe_b64decode(s + '=' * (-len(s) % 4)))
    if decode(a).get('alg') != 'HS256': raise ValueError('algorithm')
    payload = decode(b)
    if 'exp' in payload and payload['exp'] < time.time(): raise ValueError('expired')
    return payload
def validate_ooxml(data, extension):
    if len(data) > MAX: raise ValueError('size limit')
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        entries = archive.infolist()
        if len(entries) > 10000 or sum(e.file_size for e in entries) > 100*1024*1024: raise ValueError('expanded size')
        names = {e.filename for e in entries}
        required = {'docx': 'word/document.xml', 'xlsx': 'xl/workbook.xml', 'pptx': 'ppt/presentation.xml'}[extension]
        if '[Content_Types].xml' not in names or required not in names: raise ValueError('not requested OOXML format')
        if any('vbaproject' in name.lower() or name.startswith('/') or '..' in name.split('/') for name in names): raise ValueError('unsafe archive')

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs): raise ValueError('redirect refused')

class Vault:
    def __init__(self, root, secret):
        self.root, self.secret, self.lock = Path(root), secret, threading.RLock()
        (self.root/'revisions').mkdir(exist_ok=True)
        (self.root/'conflicts').mkdir(exist_ok=True)
        for doc, ext in FORMATS.items():
            if not (self.root/(doc+'.json')).exists():
                data=(self.root/'fixtures'/('baseline.'+ext)).read_bytes();validate_ooxml(data,ext)
                (self.root/'revisions'/(doc+'-0.'+ext)).write_bytes(data)
                self.write(doc, {'revision':0,'generation':str(uuid.uuid4()),'closed':True,'users':[], 'issued':0,'saved':0,'receipts':{}})
    def read(self, doc):
        if doc not in FORMATS: raise ValueError('unknown document')
        return json.loads((self.root/(doc+'.json')).read_text())
    def write(self, doc, state):
        target=self.root/(doc+'.json');tmp=target.with_suffix('.tmp');tmp.write_text(json.dumps(state));os.replace(tmp,target)
    def key(self, doc, state): return hashlib.sha256((doc+':'+state['generation']).encode()).hexdigest()
    def capability(self, doc, key, purpose, user): return sign({'doc':doc,'key':key,'purpose':purpose,'user':user,'exp':int(time.time())+7200},self.secret)
    def check_capability(self, token, doc, purpose):
        claim=verify(token,self.secret)
        if claim.get('doc')!=doc or claim.get('purpose')!=purpose or claim.get('user') not in USERS: raise ValueError('capability scope')
        return claim
    def config(self, doc, user):
        if user not in USERS: raise ValueError('synthetic user required')
        with self.lock:
            state=self.read(doc)
            if state['closed']:
                state.update(generation=str(uuid.uuid4()),closed=False,users=[],issued=0,saved=0);self.write(doc,state)
            key=self.key(doc,state);edit=user!='viewer';base='http://host.docker.internal:3391'
            config={'documentType':{'word':'word','sheet':'cell','slides':'slide'}[doc], 'document':{'fileType':FORMATS[doc],'key':key,'title':'Isolated '+doc+'.'+FORMATS[doc], 'url':base+'/file?doc='+doc+'&cap='+self.capability(doc,key,'read',user), 'permissions':{'edit':edit,'download':True,'print':False,'comment':edit}}, 'editorConfig':{'mode':'edit' if edit else 'view','lang':'en','user':{'id':user,'name':USERS[user]},'callbackUrl':base+'/callback?doc='+doc+'&cap='+self.capability(doc,key,'callback',user),'coEditing':{'mode':'fast','change':False},'customization':{'forcesave':False}},'width':'100%','height':'100%'}
            config['token']=sign(config,self.secret);return config
    def state(self, doc):
        with self.lock:
            state=self.read(doc);data=self.bytes(doc,state['revision'])
            return {'document':doc,'revision':state['revision'],'closed':state['closed'],'editing':[USERS[u] for u in state['users'] if u in USERS and u!='viewer'],'checksum':hashlib.sha256(data).hexdigest(),'conflicts':len(list((self.root/'conflicts').glob(doc+'-*')))}
    def bytes(self, doc, revision): return (self.root/'revisions'/(doc+'-'+str(int(revision))+'.'+FORMATS[doc])).read_bytes()
    def download_candidate(self, url):
        parsed=urlparse(url)
        if parsed.scheme!='http' or parsed.netloc not in ['localhost:3390','127.0.0.1:3390'] or parsed.username or parsed.fragment or not parsed.path.startswith('/cache/files/'): raise ValueError('download source refused')
        with build_opener(NoRedirect()).open(Request(url),timeout=30) as response:
            data=response.read(MAX+1)
        if len(data)>MAX: raise ValueError('size limit')
        return data
    def callback(self, doc, claim, body):
        if body.get('key')!=claim['key'] or body.get('status') not in [1,2,3,4,6,7]: raise ValueError('callback scope')
        if body['status'] in [3,7]: return {'error':1}
        with self.lock:
            state=self.read(doc);current=self.key(doc,state)
            digest=hashlib.sha256(json.dumps(body,sort_keys=True).encode()).hexdigest()
            if digest in state['receipts']: return {'error':0}
            if body['status']==1:
                if current!=claim['key'] or state['closed']: return {'error':1}
                users=body.get('users',[])
                if not isinstance(users,list) or any(u not in USERS for u in users): raise ValueError('unknown engine identity')
                state['users']=users;self.write(doc,state);return {'error':0}
            if body['status']==4:
                if current==claim['key']: state.update(closed=True,users=[]);self.write(doc,state)
                return {'error':0}
        if claim['user']=='viewer': raise ValueError('view-only save')
        data=self.download_candidate(body.get('url',''));validate_ooxml(data,FORMATS[doc])
        with self.lock:
            state=self.read(doc)
            if digest in state['receipts']: return {'error':0}
            sequence=None
            if body['status']==6:
                parts=str(body.get('userdata','')).split(':')
                if len(parts)==3 and parts[0]=='checkpoint' and parts[1]==state['generation'] and parts[2].isdigit(): sequence=int(parts[2])
            stale=self.key(doc,state)!=claim['key'] or state['closed'] or (body['status']==6 and (sequence is None or sequence<=state['saved'] or sequence>state['issued']))
            if stale:
                (self.root/'conflicts'/(doc+'-'+str(uuid.uuid4())+'.'+FORMATS[doc])).write_bytes(data);return {'error':1}
            revision=state['revision']+1;(self.root/'revisions'/(doc+'-'+str(revision)+'.'+FORMATS[doc])).write_bytes(data)
            state['revision']=revision;state['receipts'][digest]=revision
            if sequence: state['saved']=sequence
            if body['status']==2: state.update(closed=True,users=[])
            self.write(doc,state);return {'error':0}
    def force(self, doc, user):
        if user=='viewer' or user not in USERS: raise ValueError('read only')
        with self.lock:
            state=self.read(doc)
            if state['closed']: raise ValueError('document not open')
            state['issued']+=1;self.write(doc,state)
            command={'c':'forcesave','key':self.key(doc,state),'userdata':'checkpoint:'+state['generation']+':'+str(state['issued'])}
        command['token']=sign(command,self.secret)
        with build_opener(NoRedirect()).open(Request('http://127.0.0.1:3390/command',data=json.dumps(command).encode(),headers={'Content-Type':'application/json'}),timeout=30) as response:return json.load(response)

class Handler(BaseHTTPRequestHandler):
    vault=None;access=None;assets=None
    def log_message(self,*args): pass # URLs can contain short-lived file capabilities.
    def json(self, value, status=200):
        data=json.dumps(value).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(data)
    def authorized(self): return hmac.compare_digest(self.headers.get('Cookie','').split('office_dev=',1)[-1].split(';',1)[0],self.access)
    def do_GET(self):
        try:
            parsed=urlparse(self.path);parsed=parsed._replace(path=parsed.path.removeprefix('/manager'));q=parse_qs(parsed.query);doc=q.get('doc',['word'])[0]
            if parsed.path=='/file':
                claim=self.vault.check_capability(q.get('cap',[''])[0],doc,'read')
                with self.vault.lock:
                    state=self.vault.read(doc)
                    if self.vault.key(doc,state)!=claim['key']: raise ValueError('stale read capability')
                    data=self.vault.bytes(doc,state['revision'])
                self.send_response(200);self.send_header('Content-Type','application/octet-stream');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(data);return
            if not self.authorized(): return self.json({'error':'private development login required'},401)
            if parsed.path=='/config': return self.json(self.vault.config(doc,q.get('user',['viewer'])[0]))
            if parsed.path=='/state': return self.json(self.vault.state(doc))
            if parsed.path=='/download':
                state=self.vault.state(doc);data=self.vault.bytes(doc,int(q.get('revision',[state['revision']])[0]));self.send_response(200);self.send_header('Content-Type','application/octet-stream');self.end_headers();self.wfile.write(data);return
            name='index.html' if parsed.path=='/' else 'app.js' if parsed.path=='/app.js' else None
            if not name:return self.json({'error':'not found'},404)
            data=(self.assets/name).read_bytes();self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8' if name.endswith('html') else 'text/javascript; charset=utf-8');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(data)
        except Exception as e:self.json({'error':type(e).__name__},400)
    def do_POST(self):
        try:
            length=int(self.headers.get('Content-Length','0'))
            if length<1 or length>100000: raise ValueError('request size')
            body=json.loads(self.rfile.read(length));parsed=urlparse(self.path);parsed=parsed._replace(path=parsed.path.removeprefix('/manager'));q=parse_qs(parsed.query);doc=q.get('doc',['word'])[0]
            if parsed.path=='/callback':
                claim=self.vault.check_capability(q.get('cap',[''])[0],doc,'callback')
                raw=self.headers.get('Authorization','').removeprefix('Bearer ') or body.get('token','')
                signed=verify(raw,self.vault.secret);payload=signed.get('payload',signed)
                if any(payload.get(k)!=body.get(k) for k in ['key','status','url','users','userdata']):raise ValueError('unsigned callback fields')
                return self.json(self.vault.callback(doc,claim,payload))
            if parsed.path=='/login':
                if not hmac.compare_digest(str(body.get('token','')),self.access):return self.json({'error':'unauthorized'},401)
                self.send_response(200);self.send_header('Set-Cookie','office_dev='+self.access+'; HttpOnly; SameSite=Strict; Path=/manager');self.end_headers();self.wfile.write(b'{}');return
            if not self.authorized():return self.json({'error':'unauthorized'},401)
            if parsed.path=='/force':return self.json(self.vault.force(doc,body.get('user','viewer')))
            return self.json({'error':'not found'},404)
        except Exception as e:self.json({'error':type(e).__name__},400)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--root',required=True);parser.add_argument('--bind',default='172.17.0.1');args=parser.parse_args();root=Path(args.root)
    env=dict(line.split('=',1) for line in (root/'.env').read_text().splitlines() if '=' in line)
    if 'HARNESS_ACCESS_TOKEN' not in env:
        env['HARNESS_ACCESS_TOKEN']=secrets.token_hex(32)
        with (root/'.env').open('a') as f:f.write('HARNESS_ACCESS_TOKEN='+env['HARNESS_ACCESS_TOKEN']+'\n')
    Handler.vault=Vault(root,env['OFFICE_JWT_SECRET']);Handler.access=env['HARNESS_ACCESS_TOKEN'];Handler.assets=root/'harness-assets'
    ThreadingHTTPServer((args.bind,3391),Handler).serve_forever()
if __name__=='__main__':main()
