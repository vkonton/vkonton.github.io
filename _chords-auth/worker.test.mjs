import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHandler,seal,unseal,SITE} from './worker.mjs';
import {saveChart} from './github.mjs';
import {repositoryPath} from '../chords/chart.mjs';
const id='pano-se-psili-rachoula',base='[Dm]Πάνω\n',text='[Em]Πάνω\n';
const env={GITHUB_CLIENT_ID:'test-client',GITHUB_CLIENT_SECRET:'test-secret',SESSION_SECRET:'s'.repeat(64)};
const file=(chart=base)=>({path:repositoryPath(id),type:'file',encoding:'base64',sha:'a'.repeat(40),content:Buffer.from(chart).toString('base64')});
const response=(data,status=200)=>Response.json(data,{status});
const auth=()=>seal({type:'session',login:'vkonton',token:'ghu_test-only',exp:Date.now()+60000},env.SESSION_SECRET);

test('sessions are encrypted and reject tampering, wrong type, and expiry',async()=>{
  const value=await auth();assert.ok(!value.includes('ghu_test-only'));
  assert.equal((await unseal(value,env.SESSION_SECRET,'session')).login,'vkonton');
  await assert.rejects(unseal(value,env.SESSION_SECRET,'oauth'));
  await assert.rejects(unseal(value,env.SESSION_SECRET,'session',Date.now()+120000));
  await assert.rejects(unseal('x'+value.slice(1),env.SESSION_SECRET,'session'));
});
test('unauthorized, cross-origin, and unconfigured requests never call GitHub',async()=>{
  const handler=createHandler(()=>{throw new Error('Unexpected network request');});
  for(const [origin,bearer,status] of [[SITE,'',401],['https://evil.example',await auth(),403]]){
    const result=await handler(new Request('https://auth.example/chart',{method:'PUT',headers:{Origin:origin,Authorization:'Bearer '+bearer}}),env);
    assert.equal(result.status,status);
  }
  assert.equal((await handler(new Request('https://auth.example/login'),{})).status,503);
});
test('OAuth sets a secure state cookie and PKCE challenge',async()=>{
  const handler=createHandler();const state='a'.repeat(64);
  const result=await handler(new Request('https://auth.example/login?state='+state),env);
  assert.equal(result.status,302);
  const target=new URL(result.headers.get('Location'));
  assert.equal(target.origin,'https://github.com');assert.equal(target.searchParams.get('code_challenge_method'),'S256');
  assert.equal(target.searchParams.get('redirect_uri'),'https://auth.example/callback');
  const cookie=result.headers.get('Set-Cookie');assert.match(cookie,/HttpOnly; Secure; SameSite=Lax/);
  const stored=await unseal(cookie.split(';')[0].split('=')[1],env.SESSION_SECRET,'oauth');
  assert.equal(stored.clientState,state);assert.equal(stored.state,target.searchParams.get('state'));
});
test('OAuth rejects a forged state before exchanging any code',async()=>{
  const handler=createHandler(()=>{throw new Error('Must not exchange invalid code');});
  const cookie=await seal({type:'oauth',state:'real',exp:Date.now()+60000},env.SESSION_SECRET);
  const result=await handler(new Request('https://auth.example/callback?state=wrong&code=fake',{headers:{Cookie:'__Host-chords_oauth='+cookie}}),env);
  assert.match(result.headers.get('Location'),/^https:\/\/vkonton.github.io\/chords\/#auth_error=/);
});
test('OAuth succeeds only for owner with repository write permission and returns an opaque session',async()=>{
  const cookie=await seal({type:'oauth',state:'real',clientState:'a'.repeat(64),verifier:'verifier',exp:Date.now()+60000},env.SESSION_SECRET);
  const handler=createHandler(async(url,options)=>{
    if(url.includes('access_token')){const body=JSON.parse(options.body);assert.equal(body.code_verifier,'verifier');return response({access_token:'ghu_test-only',expires_in:28800});}
    if(url.endsWith('/user'))return response({login:'vkonton'});
    return response({permissions:{push:true}});
  });
  const result=await handler(new Request('https://auth.example/callback?state=real&code=fake',{headers:{Cookie:'__Host-chords_oauth='+cookie}}),env);
  const target=new URL(result.headers.get('Location')),fragment=new URLSearchParams(target.hash.slice(1));
  assert.equal(fragment.get('state'),'a'.repeat(64));assert.ok(!target.href.includes('ghu_test-only'));
  assert.equal((await unseal(fragment.get('session'),env.SESSION_SECRET,'session')).login,'vkonton');
});
test('direct save sends exact Greek edits, original SHA, and master branch to GitHub',async()=>{
  let writes=0;
  const saved=await saveChart({song:id,text,base},'ghu_test-only',async(url,options)=>{
    assert.equal(options.headers.Authorization,'Bearer ghu_test-only');
    if(options.method!=='PUT')return response(file());
    writes++;const body=JSON.parse(options.body);
    assert.equal(Buffer.from(body.content,'base64').toString('utf8'),text);
    assert.equal(body.sha,'a'.repeat(40));assert.equal(body.branch,'master');
    assert.ok(url.endsWith('/chords/charts/'+id+'.txt'));
    return response({content:{path:repositoryPath(id),sha:'b'.repeat(40)},commit:{sha:'c'.repeat(40)}});
  });
  assert.equal(writes,1);assert.equal(saved.text,text);assert.equal(saved.commit,'c'.repeat(40));
});
test('unchanged save makes no commit; stale base and invalid songs cannot write',async()=>{
  const fetcher=async(url,options)=>{assert.notEqual(options.method,'PUT');return response(file());};
  assert.equal((await saveChart({song:id,text:base,base},'ghu_test-only',fetcher)).alreadySaved,true);
  await assert.rejects(saveChart({song:id,text,base:'[Am]old\n'},'ghu_test-only',fetcher),/changed/);
  await assert.rejects(saveChart({song:'../../README',text,base},'ghu_test-only',fetcher));
});
test('concurrent GitHub update and denied write preserve errors without blind retry',async()=>{
  for(const status of [401,403,404,409,422]){
    let writes=0;
    await assert.rejects(saveChart({song:id,text,base},'ghu_test-only',async(url,options)=>{
      if(options.method==='PUT'){writes++;return response({},status);}return response(file());
    }));assert.equal(writes,1);
  }
});
test('uncertain PUT is reconciled with a read, never a second PUT',async()=>{
  let writes=0,reads=0;
  const saved=await saveChart({song:id,text,base},'ghu_test-only',async(url,options)=>{
    if(options.method==='PUT'){writes++;throw new Error('Connection lost after commit');}
    return response(file(++reads===1?base:text));
  });assert.equal(writes,1);assert.equal(saved.reconciled,true);
});
test('worker accepts only authenticated JSON chart writes with allowed origin',async()=>{
  const handler=createHandler(async(url,options)=>options.method==='PUT'?response({content:{path:repositoryPath(id),sha:'b'.repeat(40)},commit:{sha:'c'.repeat(40)}}):response(file()));
  const headers={Origin:SITE,Authorization:'Bearer '+await auth(),'Content-Type':'application/json'};
  const result=await handler(new Request('https://auth.example/chart',{method:'PUT',headers,body:JSON.stringify({song:id,text,base})}),env);
  assert.equal(result.status,200);assert.equal(result.headers.get('Access-Control-Allow-Origin'),SITE);assert.equal((await result.json()).text,text);
  const invalid=await handler(new Request('https://auth.example/chart',{method:'PUT',headers,body:JSON.stringify({song:id,text:'[H]bad',base})}),env);
  assert.equal(invalid.status,400);
});

test('OAuth rejects other users or missing repository write permission',async()=>{
  for(const login of ['another-user','vkonton']){
    const flow=await seal({type:'oauth',state:'state',clientState:'a'.repeat(64),verifier:'v',exp:Date.now()+60000},env.SESSION_SECRET);
    const handler=createHandler(async url=>url.includes('access_token')?response({access_token:'ghu_test-only'}):url.endsWith('/user')?response({login}):response({permissions:{push:false}}));
    const result=await handler(new Request('https://auth.example/callback?state=state&code=code',{headers:{Cookie:'__Host-chords_oauth='+flow}}),env);
    assert.ok(new URLSearchParams(new URL(result.headers.get('Location')).hash.slice(1)).has('auth_error'));
  }
});
test('logout revokes only the current GitHub token with server-side credentials',async()=>{
  let calls=0;
  const handler=createHandler(async(url,options)=>{
    calls++;assert.equal(url,'https://api.github.com/applications/test-client/token');
    assert.equal(options.method,'DELETE');assert.equal(JSON.parse(options.body).access_token,'ghu_test-only');
    assert.equal(options.headers.Authorization,'Basic '+btoa('test-client:test-secret'));
    return new Response(null,{status:204});
  });
  const result=await handler(new Request('https://auth.example/logout',{method:'POST',headers:{Origin:SITE,Authorization:'Bearer '+await auth()}}),env);
  assert.equal(result.status,200);assert.equal(calls,1);
});
