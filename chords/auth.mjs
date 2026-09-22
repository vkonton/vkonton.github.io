import {AUTH_ORIGIN} from './auth-config.mjs?v=6';
const SESSION='chords:session',FLOW='chords:login';
let token='',authError='',returned=false;
try{token=sessionStorage.getItem(SESSION)||'';}catch{}
const fragment=new URLSearchParams(location.hash.slice(1));
if(fragment.has('session')||fragment.has('auth_error')){
  returned=true;
  history.replaceState(null,'',location.pathname+location.search);
  try{
    const flow=JSON.parse(sessionStorage.getItem(FLOW));
    sessionStorage.removeItem(FLOW);
    if(fragment.has('auth_error'))throw new Error(fragment.get('auth_error'));
    if(!flow||flow.state!==fragment.get('state')||Date.now()-flow.started>600000)throw new Error('Sign-in could not be verified. Please try again.');
    token=fragment.get('session');sessionStorage.setItem(SESSION,token);
    const back=new URL(flow.url,location.origin);
    if(back.origin===location.origin&&back.pathname==='/chords/')history.replaceState(null,'',back.pathname+back.search);
  }catch(error){authError=error.message;token='';try{sessionStorage.removeItem(SESSION);}catch{}}
}
export function isConfigured(){return Boolean(AUTH_ORIGIN);}
export function didReturnFromLogin(){return returned;}
export function initialAuthError(){return authError;}
export function clearSession(){token='';try{sessionStorage.removeItem(SESSION);}catch{}}
export async function request(path,options={}){
  if(!AUTH_ORIGIN)throw new Error('GitHub sign-in is being configured. Your draft stays in this browser.');
  const response=await fetch(AUTH_ORIGIN+path,{
    ...options,credentials:'omit',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(40000),
    headers:{...options.headers,...(token?{Authorization:'Bearer '+token}:{})},
  });
  const data=await response.json();
  if(!response.ok){
    if(response.status===401)clearSession();
    throw new Error(data.error||'Could not contact GitHub. Your draft is preserved.');
  }
  return data;
}
export async function currentUser(){return token?request('/session'):null;}
export function signIn(){
  if(!AUTH_ORIGIN)throw new Error('GitHub sign-in is being configured. Your draft stays in this browser.');
  const state=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
  sessionStorage.setItem(FLOW,JSON.stringify({state,started:Date.now(),url:location.href}));
  location.assign(AUTH_ORIGIN+'/login?'+new URLSearchParams({state}));
}
export async function signOut(){if(token)await request('/logout',{method:'POST'});clearSession();}
