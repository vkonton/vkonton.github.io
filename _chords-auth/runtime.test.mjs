import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(process.env.CHORDS_TEST_DEPS?resolve(process.env.CHORDS_TEST_DEPS,'package.json'):import.meta.url);
const {Miniflare,convertV4MiniflareOptions}=require('miniflare');
const {build}=require('esbuild');

test('Cloudflare runtime completes OAuth and sends an authenticated chart commit',async()=>{
  const built=await build({stdin:{resolveDir:dirname(fileURLToPath(import.meta.url)),contents:`
    import {createHandler} from './worker.mjs';
    let chart='[Dm]Πάνω\\n',writes=[];
    const path='chords/charts/pano-se-psili-rachoula.txt';
    const handler=createHandler(async(url,options)=>{
      // Validate every outbound request with Cloudflare's actual Request implementation.
      new Request(url,options);
      if(url.includes('/login/oauth/access_token'))return Response.json({access_token:'ghu_runtime-test',expires_in:28800});
      if(url.endsWith('/user'))return Response.json({login:'vkonton'});
      if(url.endsWith('/repos/vkonton/vkonton.github.io'))return Response.json({permissions:{push:true}});
      if(options.method==='PUT'){
        const body=JSON.parse(options.body);writes.push(body);
        chart=new TextDecoder().decode(Uint8Array.from(atob(body.content),c=>c.charCodeAt(0)));
        return Response.json({content:{path,sha:'b'.repeat(40)},commit:{sha:'c'.repeat(40)}});
      }
      return Response.json({path,type:'file',encoding:'base64',sha:'a'.repeat(40),content:btoa(String.fromCharCode(...new TextEncoder().encode(chart)))});
    });
    export default {fetch(request,env){return new URL(request.url).pathname==='/test-writes'?Response.json(writes):handler(request,env);}};
  `},bundle:true,write:false,format:'esm',platform:'browser'});
  const convertOptions=convertV4MiniflareOptions??(options=>options);
  const mf=new Miniflare(convertOptions({modules:true,compatibilityDate:'2026-09-01',script:built.outputFiles[0].text,bindings:{GITHUB_CLIENT_ID:'test',GITHUB_CLIENT_SECRET:'test',SESSION_SECRET:'s'.repeat(64)}}));
  try{
    const start=await mf.dispatchFetch('https://auth.example/login?state='+'a'.repeat(64),{redirect:'manual'});
    assert.equal(start.status,302);
    const state=new URL(start.headers.get('Location')).searchParams.get('state');
    const callback=await mf.dispatchFetch('https://auth.example/callback?code=fake&state='+state,{redirect:'manual',headers:{Cookie:start.headers.get('Set-Cookie').split(';')[0]}});
    const fragment=new URLSearchParams(new URL(callback.headers.get('Location')).hash.slice(1));
    assert.equal(fragment.has('auth_error'),false,fragment.get('auth_error'));
    const headers={Origin:'https://vkonton.github.io',Authorization:'Bearer '+fragment.get('session'),'Content-Type':'application/json'};
    const session=await mf.dispatchFetch('https://auth.example/session',{headers});
    assert.equal((await session.json()).login,'vkonton');
    const response=await mf.dispatchFetch('https://auth.example/chart',{method:'PUT',headers,body:JSON.stringify({song:'pano-se-psili-rachoula',base:'[Dm]Πάνω\n',text:'[Em]Πάνω\n'})});
    assert.equal(response.status,200);assert.equal((await response.json()).text,'[Em]Πάνω\n');
    const writes=await (await mf.dispatchFetch('https://auth.example/test-writes')).json();
    assert.equal(writes.length,1);assert.equal(writes[0].branch,'master');assert.equal(writes[0].sha,'a'.repeat(40));
    assert.equal(Buffer.from(writes[0].content,'base64').toString(),'[Em]Πάνω\n');
  }finally{await mf.dispose();}
});
