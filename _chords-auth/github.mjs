import {readGithubChart,checkSave,repositoryPath} from '../chords/chart.mjs';

export const REPO='vkonton/vkonton.github.io';
export const BRANCH='master';
export class ApiError extends Error {
  constructor(message,status=502){super(message);this.status=status;}
}
export function githubFetch(token,fetcher=fetch){
  return (url,options={})=>fetcher(url,{
    ...options,redirect:'error',credentials:'omit',signal:AbortSignal.timeout(15000),
    headers:{...options.headers,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'vkonton-chords',Authorization:`Bearer ${token}`},
  });
}
export async function readChart(song,token,fetcher=fetch){
  return readGithubChart(song,githubFetch(token,fetcher));
}
export async function saveChart({song,text,base},token,fetcher=fetch){
  const path=repositoryPath(song);
  const latest=await readChart(song,token,fetcher);
  let checked;
  try{checked=checkSave(text,base,latest);}catch(error){throw new ApiError(error.message,409);}
  if(checked.alreadySaved)return {...latest,alreadySaved:true};
  const bytes=new TextEncoder().encode(checked.text);
  const content=btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''));
  let response;
  try{
    response=await githubFetch(token,fetcher)(`https://api.github.com/repos/${REPO}/contents/${path}`,{
      method:'PUT',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({message:`Update chords: ${song}`,branch:BRANCH,sha:latest.sha,content}),
    });
    if(!response.ok){
      if(response.status===409)throw new ApiError('This song changed while saving. Your draft is preserved. Load the latest version before saving.',409);
      if(response.status===401)throw new ApiError('Your GitHub session expired. Please sign in again.',401);
      if(response.status===403||response.status===404)throw new ApiError('GitHub denied this save. The app and your account need write access to this repository.',403);
      if(response.status===422)throw new ApiError('GitHub rejected the commit. Check the repository’s branch rules.',422);
      throw new Error('Unconfirmed save');
    }
    const saved=await response.json();
    if(saved.content?.path!==path||!/^[a-f0-9]{40,64}$/.test(saved.content?.sha??'')||!/^[a-f0-9]{40,64}$/.test(saved.commit?.sha??''))throw new Error('Invalid save response');
    return {text:checked.text,sha:saved.content.sha,commit:saved.commit.sha};
  }catch(error){
    if(error instanceof ApiError)throw error;
    // A timed-out PUT may already have committed. Reconcile without retrying it.
    try{
      const current=await readChart(song,token,fetcher);
      if(current.text===checked.text)return {...current,reconciled:true};
    }catch{}
    throw new ApiError('Could not confirm the save. Your draft is preserved. Try Save again to check GitHub before retrying.',502);
  }
}
