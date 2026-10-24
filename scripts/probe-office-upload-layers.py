"""Replay a synthetic native upload in memory. Never print credentials or signed URLs."""
import json, sys, re, shlex, http.client, base64, time
from pathlib import Path
import paramiko

packet = json.load(sys.stdin)
if not packet['path'].startswith('/') or '/upload/' not in packet['path']:
    raise SystemExit('Expected native synthetic upload path')

remote = r'''
import json,sys,base64,time,http.client,socket
p=json.load(sys.stdin);body=base64.b64decode(p['body'])
headers={k:v for k,v in p['headers'].items() if k.lower() in ['content-type','authorization','cookie','origin','referer','user-agent']}
headers.update({'Host':'collabspace-api.purelamp.uk','X-Forwarded-Proto':'https','X-Forwarded-Host':'collabspace-api.purelamp.uk/office-engine'})
rows=[]
for n in range(2):
 if p['port']==443:
  c=http.client.HTTPSConnection('collabspace-api.purelamp.uk',443,timeout=40)
  c._create_connection=lambda address,timeout,source_address:socket.create_connection(('127.0.0.1',443),timeout,source_address)
  path='/office-engine'+p['path']
 else:c=http.client.HTTPConnection('127.0.0.1',p['port'],timeout=40);path=p['path']
 t=time.perf_counter();c.request('POST',path,body,headers);sent=time.perf_counter();r=c.getresponse();first=time.perf_counter();data=r.read();end=time.perf_counter();c.close()
 try:
  result=json.loads(data);valid='/media/' in json.dumps(result);error=result.get('error') if isinstance(result,dict) else None
 except Exception:valid=False;error='non-json'
 rows.append({'status':r.status,'bytes':len(body),'sendMs':round((sent-t)*1000,2),'waitMs':round((first-sent)*1000,2),'totalMs':round((end-t)*1000,2),'mediaResult':valid,'error':error})
print(json.dumps(rows))
'''

def connect(host):
    c=paramiko.SSHClient();c.load_host_keys(str(Path.home()/'.ssh/known_hosts'));c.set_missing_host_key_policy(paramiko.RejectPolicy())
    options=dict(username='root',allow_agent=False,look_for_keys=False,timeout=20)
    if host=='170.106.161.82': options['key_filename']=str(Path.home()/'.ssh/toolkit_deploy')
    else:
        config=Path(r'D:\appspace\server_config.txt').read_text(encoding='utf-8-sig')
        for block in re.split(r'(?m)(?=^\s*公网 IP\s*[：:])',config):
            fields={}
            for line in block.splitlines():
                parts=re.split('[：:]',line,maxsplit=1)
                if len(parts)==2:fields[parts[0].strip()]=parts[1].strip()
            if fields.get('公网 IP')==host:options['password']=fields['登录密码'];break
        else:raise RuntimeError('Engine credential not found')
    c.connect(host,**options);return c

try:
    results={}
    rows=[]
    for attempt in range(2):
        headers={k:v for k,v in packet['headers'].items() if k.lower() in ['content-type','authorization','cookie','origin','referer','user-agent']}
        body=base64.b64decode(packet['body']);connection=http.client.HTTPSConnection('collabspace-api.purelamp.uk',timeout=40)
        started=time.perf_counter();connection.request('POST','/office-engine'+packet['path'],body,headers);sent=time.perf_counter()
        response=connection.getresponse();first=time.perf_counter();data=response.read();ended=time.perf_counter();connection.close()
        valid='/media/' in json.dumps(json.loads(data))
        if response.status!=200 or not valid:raise RuntimeError('Public replay rejected')
        rows.append({'status':response.status,'bytes':len(body),'sendMs':round((sent-started)*1000,2),'waitMs':round((first-sent)*1000,2),'totalMs':round((ended-started)*1000,2),'mediaResult':valid})
    results['client-public-http1']=rows
    for label,host,port in [('application-proxy','170.106.161.82',443),('application-tunnel','170.106.161.82',3396),('engine-loopback','43.130.127.57',3390)]:
        client=connect(host)
        try:
            payload=dict(packet,port=port)
            wrapped="import json\ntry:\n exec("+repr(remote)+")\nexcept Exception as error:\n print(json.dumps({'remoteError':type(error).__name__}))"
            i,o,e=client.exec_command('python3 -c '+shlex.quote(wrapped),timeout=100)
            i.write(json.dumps(payload));i.channel.shutdown_write()
            stdout=o.read().decode();code=o.channel.recv_exit_status()
            if code:raise RuntimeError('Remote synthetic probe failed')
            results[label]=json.loads(stdout)
            if not isinstance(results[label],list) or not all(row.get('status')==200 and row.get('mediaResult') for row in results[label]):
                print(json.dumps({'error':'InvalidProbeResult','layer':label,'detail':results[label]}),file=sys.stderr);sys.exit(1)
        finally:client.close()
    print(json.dumps(results))
except Exception as error:
    # Exceptions can contain signed paths; keep failures deliberately generic.
    print(json.dumps({'error':type(error).__name__}),file=sys.stderr);sys.exit(1)
