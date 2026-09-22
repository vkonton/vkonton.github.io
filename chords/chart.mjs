import {SONG_IDS} from './song-ids.mjs';
import {normalizeKey} from './music.mjs';
const REPO='vkonton/vkonton.github.io';
const BRANCH='master';
const CHORD=/^(?:N\.C\.|[A-G][#b♯♭]?(?:(?:maj|min|dim|aug|sus|add|m|M|Δ|ø|°)|[0-9()+#b-])*(?:\/[A-G][#b♯♭]?)?)$/;

export function normalizeChart(text){
  if(typeof text!=='string')throw new Error('Invalid song text.');
  return text.replace(/\r\n?/g,'\n').trim()+'\n';
}

export function chartParts(text,fallbackKey=null){
  const normalized=normalizeChart(text);
  const header=/^\{key:\s*([^}\n]+)\}\n?/i.exec(normalized);
  if(!header)return {body:normalized.trim(),baseKey:fallbackKey};
  const value=header[1].trim();
  const baseKey=value==='unknown'?null:normalizeKey(value);
  if(value!=='unknown'&&!baseKey)throw new Error('Invalid source key.');
  return {body:normalized.slice(header[0].length).trim(),baseKey};
}

export function withChartKey(body,key){
  if(key!==null&&!normalizeKey(key))throw new Error('Invalid source key.');
  return normalizeChart(`{key: ${key===null?'unknown':normalizeKey(key)}}\n\n${body.trim()}`);
}

export function parseChart(text,{allowEmpty=false}={}){
  if(typeof text!=='string'||text.length>32000)throw new Error('The song must be no longer than 32,000 characters.');
  const normalized=chartParts(text).body;
  if(!normalized.trim()){
    if(allowEmpty)return [];
    throw new Error('Add lyrics and chords.');
  }
  const lines=normalized.trimEnd().split('\n');
  if(lines.length>200)throw new Error('The song must be no longer than 200 lines.');
  for(const [i,line] of lines.entries()){
    const remaining=line.replace(/\[([^\[\]]+)\]/g,(_,chord)=>{
      if(!CHORD.test(chord))throw new Error(`Line ${i+1}: invalid chord [${chord}].`);
      return '';
    });
    if(/[\[\]]/.test(remaining))throw new Error(`Line ${i+1}: check the chord brackets.`);
  }
  return normalized.trimEnd().split(/\n[\t ]*\n(?:[\t ]*\n)*/).map(verse=>verse.split('\n'));
}

export function repositoryPath(songId){
  if(!SONG_IDS.includes(songId))throw new Error('This song is not supported yet.');
  return `chords/charts/${songId}.txt`;
}

export async function readGithubChart(songId,fetcher=fetch){
  const path=repositoryPath(songId);
  const response=await fetcher(`https://api.github.com/repos/${REPO}/contents/${path}?ref=${BRANCH}`,{
    cache:'no-store',credentials:'omit',headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(12000),
  });
  if(!response.ok)throw new Error('Could not load the latest version from GitHub. Please try again.');
  const file=await response.json();
  if(file.path!==path||file.type!=='file'||file.encoding!=='base64'||!/^[a-f0-9]{40,64}$/.test(file.sha??'')||typeof file.content!=='string'||file.content.length>180000)
    throw new Error('Invalid chart file.');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(file.content.replace(/\s/g,'')),c=>c.charCodeAt(0)));
  parseChart(text,{allowEmpty:true});
  return {text:normalizeChart(text),sha:file.sha};
}

export function checkSave(draft,base,latest){
  parseChart(draft);
  const normalized=normalizeChart(draft);
  if(normalized===latest.text)return {text:normalized,alreadySaved:true};
  if(base!==latest.text)throw new Error('This song changed on GitHub. Your draft is preserved. Load the latest version before saving.');
  return {text:normalized,alreadySaved:false};
}
