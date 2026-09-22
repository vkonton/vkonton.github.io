import {ApiError,REPO,githubFetch,saveChart} from './github.mjs';
import {parseChart,repositoryPath} from '../chords/chart.mjs';

export const SITE='https://vkonton.github.io';
const PAGE=SITE+'/chords/';
const COOKIE='__Host-chords_oauth';
const MAX_AGE=8*60*60;
const encode=value=>btoa(String.fromCharCode(...value)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const decode=value=>Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const random=()=>encode(crypto.getRandomValues(new Uint8Array(32)));
const cookie=(value,age=600)=>`${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;

async function encryptionKey(secret){
  if(typeof secret!=='string'||secret.length<43)throw new ApiError('Sign-in service is not configured.',503);
  return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret)),{name:'AES-GCM'},false,['encrypt','decrypt']);
}
export async function seal(data,secret){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},await encryptionKey(secret),new TextEncoder().encode(JSON.stringify(data)));
  return encode(iv)+'.'+encode(new Uint8Array(encrypted));
}
export async function unseal(value,secret,type,now=Date.now()){
  try{
    if(typeof value!=='string'||value.length>8000)throw new Error();
    const [iv,encrypted,extra]=value.split('.');
    if(extra!==undefined)throw new Error();
    const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv)},await encryptionKey(secret),decode(encrypted));
    const data=JSON.parse(new TextDecoder().decode(plaintext));
    if(data.type!==type||!Number.isFinite(data.exp)||data.exp<=now)throw new Error();
    return data;
  }catch{throw new ApiError('Your session expired. Please sign in again.',401);}
}
function headers(origin){
  return {'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff',
    'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",...(origin===SITE?{'Access-Control-Allow-Origin':SITE,'Vary':'Origin'}:{})};
}
function json(data,status=200,origin){return Response.json(data,{status,headers:headers(origin)});}
function redirect(location,setCookie){
  return new Response(null,{status:302,headers:{...headers(),Location:location,...(setCookie?{'Set-Cookie':setCookie}:{})}});
}
async function authorizedUser(token,fetcher){
  const gh=githubFetch(token,fetcher);
  const response=await gh('https://api.github.com/user');
  if(!response.ok)throw new ApiError('Your GitHub session expired. Please sign in again.',401);
  const user=await response.json();
  // This is a personal editor. Public visitors can still read and transpose.
  if(user.login?.toLowerCase()!=='vkonton')throw new ApiError('Only the website owner can save changes.',403);
  return user.login;
}
export function createHandler(fetcher=globalThis.fetch.bind(globalThis),now=()=>Date.now()){
  return async function handle(request,env){
    const url=new URL(request.url),origin=request.headers.get('Origin');
    try{
      if(url.pathname==='/health'&&request.method==='GET')return json({ready:Boolean(env.GITHUB_CLIENT_ID&&env.GITHUB_CLIENT_SECRET&&env.SESSION_SECRET)},200,origin);
      if(!env.GITHUB_CLIENT_ID||!env.GITHUB_CLIENT_SECRET||!env.SESSION_SECRET)throw new ApiError('GitHub sign-in is being configured. Your draft stays in this browser.',503);
      if(url.pathname==='/login'&&request.method==='GET'){
        const clientState=url.searchParams.get('state');
        if(!/^[a-f0-9]{64}$/.test(clientState??''))throw new ApiError('Start sign-in from the song page.',400);
        const verifier=random(),state=random();
        const challenge=encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
        const flow={type:'oauth',state,clientState,verifier,exp:now()+600000};
        const auth=new URL('https://github.com/login/oauth/authorize');
        auth.search=new URLSearchParams({client_id:env.GITHUB_CLIENT_ID,redirect_uri:url.origin+'/callback',state,code_challenge:challenge,code_challenge_method:'S256'});
        return redirect(auth.href,cookie(await seal(flow,env.SESSION_SECRET)));
      }
      if(url.pathname==='/callback'&&request.method==='GET'){
        try{
          const stored=request.headers.get('Cookie')?.split('; ').find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
          const flow=await unseal(stored,env.SESSION_SECRET,'oauth',now());
          if(url.searchParams.get('state')!==flow.state||!url.searchParams.get('code'))throw new ApiError('GitHub sign-in was cancelled or could not be verified.',400);
          const response=await fetcher('https://github.com/login/oauth/access_token',{
            method:'POST',redirect:'manual',signal:AbortSignal.timeout(15000),headers:{Accept:'application/json','Content-Type':'application/json','User-Agent':'vkonton-chords'},
            body:JSON.stringify({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code:url.searchParams.get('code'),redirect_uri:url.origin+'/callback',code_verifier:flow.verifier}),
          });
          const auth=await response.json();
          if(!response.ok||typeof auth.access_token!=='string'||!auth.access_token.startsWith('ghu_'))throw new ApiError('Could not complete GitHub sign-in. Please try again.',401);
          const login=await authorizedUser(auth.access_token,fetcher);
          const access=await githubFetch(auth.access_token,fetcher)(`https://api.github.com/repos/${REPO}`);
          const repo=await access.json();
          if(!access.ok||repo.permissions?.push!==true)throw new ApiError('Install the GitHub App on vkonton.github.io with Contents write access first.',403);
          const exp=now()+Math.min(MAX_AGE,Number(auth.expires_in)||MAX_AGE)*1000;
          const session=await seal({type:'session',token:auth.access_token,login,exp},env.SESSION_SECRET);
          return redirect(PAGE+'#'+new URLSearchParams({session,state:flow.clientState}),cookie('',0));
        }catch(error){
          const message=error instanceof ApiError?error.message:'GitHub sign-in failed. Please try again.';
          return redirect(PAGE+'#'+new URLSearchParams({auth_error:message}),cookie('',0));
        }
      }
      if(origin!==SITE)throw new ApiError('This origin is not allowed.',403);
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers(origin),'Access-Control-Allow-Methods':'GET, PUT, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600'}});
      const session=await unseal(request.headers.get('Authorization')?.replace(/^Bearer /,''),env.SESSION_SECRET,'session',now());
      if(session.login?.toLowerCase()!=='vkonton'||!session.token?.startsWith('ghu_'))throw new ApiError('Please sign in again.',401);
      if(url.pathname==='/session'&&request.method==='GET'){
        await authorizedUser(session.token,fetcher);
        return json({login:session.login,expires:session.exp},200,origin);
      }
      if(url.pathname==='/logout'&&request.method==='POST'){
        const response=await fetcher(`https://api.github.com/applications/${env.GITHUB_CLIENT_ID}/token`,{
          method:'DELETE',redirect:'manual',signal:AbortSignal.timeout(15000),
          headers:{Accept:'application/vnd.github+json','Content-Type':'application/json','User-Agent':'vkonton-chords',Authorization:'Basic '+btoa(env.GITHUB_CLIENT_ID+':'+env.GITHUB_CLIENT_SECRET)},
          body:JSON.stringify({access_token:session.token}),
        });
        if(!response.ok&&response.status!==404)throw new ApiError('Could not revoke the GitHub session. Please try Sign out again.',502);
        return json({signedOut:true},200,origin);
      }
      if(url.pathname==='/chart'&&request.method==='PUT'){
        if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw new ApiError('Expected JSON.',415);
        // Limit bytes as they arrive, not just the caller-controlled Content-Length.
        const reader=request.body?.getReader();let chunks=[],length=0;
        if(!reader)throw new ApiError('Missing chart.',400);
        while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>200000){await reader.cancel();throw new ApiError('Chart too large.',413);}chunks.push(value);}
        const bytes=new Uint8Array(length);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
        let body;
        try{body=JSON.parse(new TextDecoder().decode(bytes));repositoryPath(body.song);parseChart(body.text);parseChart(body.base,{allowEmpty:true});}catch(error){throw new ApiError(error.message||'Invalid chart.',400);}
        const saved=await saveChart(body,session.token,fetcher);
        return json(saved,200,origin);
      }
      return json({error:'Not found.'},404,origin);
    }catch(error){return json({error:error instanceof ApiError?error.message:'The service is temporarily unavailable. Your draft is preserved.'},error instanceof ApiError?error.status:502,origin);}
  };
}
export default {fetch:createHandler()};
