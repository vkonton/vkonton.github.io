"""One-use, loopback-only GitHub App manifest setup. Never prints credentials."""
import argparse
import html
import json
import os
from pathlib import Path
import secrets
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
from urllib.request import Request, urlopen

parser=argparse.ArgumentParser()
parser.add_argument('worker_origin')
parser.add_argument('--output',default='/private/tmp/chords-auth-secrets')
args=parser.parse_args()
origin=args.worker_origin.rstrip('/')
if not origin.startswith('https://') or urlparse(origin).path:
    raise SystemExit('Provide the deployed Worker HTTPS origin.')
output=Path(args.output)
output.mkdir(mode=0o700,parents=True,exist_ok=True)
os.chmod(output,0o700)
state=secrets.token_urlsafe(32)
manifest={
    'name':'VKonton Chords',
    'url':'https://vkonton.github.io/chords/',
    'description':'Sign in and save edited song chords to the personal website repository.',
    'redirect_url':'http://127.0.0.1:8766/callback',
    'callback_urls':[origin+'/callback'],
    'hook_attributes':{'url':origin+'/webhook','active':False},
    'public':False,
    'default_permissions':{'contents':'write','metadata':'read'},
    'default_events':[],
    'request_oauth_on_install':False,
}
class Handler(BaseHTTPRequestHandler):
    completed=False
    def log_message(self,*args):
        pass  # Callback URL contains a one-use credential.
    def page(self,text,status=200):
        body=('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Chords setup</title><body>'+text+'</body></html>').encode()
        self.send_response(status)
        self.send_header('Content-Type','text/html; charset=utf-8')
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Frame-Options','DENY')
        self.end_headers()
        self.wfile.write(body)
    def do_GET(self):
        if self.headers.get('Host')!='127.0.0.1:8766':
            return self.page('Invalid host.',403)
        url=urlparse(self.path)
        if url.path=='/':
            return self.page('<h1>Register Chords GitHub App</h1><p>Private app owned by vkonton. Contents read/write and Metadata read; install only on vkonton.github.io.</p><form method="post" action="https://github.com/settings/apps/new?state='+html.escape(state)+'"><input type="hidden" name="manifest" value="'+html.escape(json.dumps(manifest),quote=True)+'"><button>Review on GitHub</button></form>')
        if url.path!='/callback':
            return self.page('Not found.',404)
        query=parse_qs(url.query)
        if Handler.completed or query.get('state')!=[state] or not query.get('code'):
            return self.page('Invalid or already completed registration.',400)
        code=query['code'][0]
        if not code.isalnum():
            return self.page('Invalid registration code.',400)
        try:
            request=Request('https://api.github.com/app-manifests/'+code+'/conversions',data=b'',method='POST',headers={'Accept':'application/vnd.github+json','User-Agent':'vkonton-chords-setup'})
            with urlopen(request,timeout=20) as response:
                app=json.load(response)
            if app.get('owner',{}).get('login','').lower()!='vkonton':
                return self.page('The app must belong to vkonton.',403)
            secret_values={'GITHUB_CLIENT_ID':app['client_id'],'GITHUB_CLIENT_SECRET':app['client_secret'],'SESSION_SECRET':secrets.token_urlsafe(48)}
            filename=output/'worker-secrets.json'
            fd=os.open(filename,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
            with os.fdopen(fd,'w') as f:
                json.dump(secret_values,f)
            metadata={'slug':app['slug'],'id':app['id'],'client_id':app['client_id'],'html_url':app['html_url']}
            (output/'app-info.json').write_text(json.dumps(metadata))
            Handler.completed=True
            # The generated private key is not used or persisted.
            return self.page('<h1>App registered</h1><p>The credentials are stored locally for secure transfer to Cloudflare.</p><a href="'+html.escape(app['html_url']+'/installations/new',quote=True)+'">Install on vkonton.github.io</a>')
        except Exception:
            return self.page('Setup could not be completed. No credentials are shown here.',500)
print('Setup page: http://127.0.0.1:8766/',flush=True)
HTTPServer(('127.0.0.1',8766),Handler).serve_forever()
