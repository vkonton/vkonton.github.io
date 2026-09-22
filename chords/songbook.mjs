import {BASE_KEY,KEYS,mod12,normalizeKey,parseLine,pitch,songUrl,transposeChord} from './music.mjs';
import {song} from './songs.mjs?v=6';
import {parseChart,normalizeChart} from './chart.mjs?v=6';
import {setupEditor} from './editor.mjs?v=6';

const STORAGE='chords:key:'+song.id;
const byId=id=>document.getElementById(id);
const selector=byId('song-key');
let currentKey=BASE_KEY;
let publishedText='';
let displayedVerses=[];

function span(className,text){
  const element=document.createElement('span');
  element.className=className;
  if(text!==undefined)element.textContent=text;
  return element;
}
function renderScore(key){
  const fragment=document.createDocumentFragment();
  const shift=pitch(key)-pitch(BASE_KEY);
  displayedVerses.forEach(verse=>{
    const section=document.createElement('section');
    section.className='verse';
    for(const line of verse){
      const paragraph=document.createElement('p');
      paragraph.className='song-line';
      // Keep syllables of a word together when the line wraps on a phone.
      for(const word of line.split(/(\s+)/).filter(Boolean)){
        const group=span('word');
        for(const segment of parseLine(word)){
          const phrase=span('phrase');
          phrase.append(span('chord',segment.chord?transposeChord(segment.chord,shift,key):'\u00a0'),span('lyric',segment.text));
          group.append(phrase);
        }
        paragraph.append(group);
      }
      section.append(paragraph);
    }
    fragment.append(section);
  });
  byId('score').replaceChildren(fragment);
}
function applyKey(value,{persist=true}={}){
  const next=normalizeKey(value);
  if(!next)throw new Error('Invalid key');
  currentKey=next;
  selector.value=next;
  byId('copy-status').textContent='';
  byId('manual-link').hidden=true;
  renderScore(next);
  if(persist){
    try{localStorage.setItem(STORAGE,next);}catch{/* A private window may disable storage. */}
    history.replaceState(null,'',songUrl(location.href,next));
  }
  return {song:song.id,key:next};
}
selector.replaceChildren(...KEYS.map(key=>{
  const option=document.createElement('option');option.value=key;option.textContent=key;return option;
}));
selector.addEventListener('change',()=>applyKey(selector.value));
byId('key-down').addEventListener('click',()=>applyKey(KEYS[mod12(pitch(currentKey)-1)]));
byId('key-up').addEventListener('click',()=>applyKey(KEYS[mod12(pitch(currentKey)+1)]));
byId('reset-key').addEventListener('click',()=>applyKey(BASE_KEY));
byId('copy-link').addEventListener('click',async()=>{
  const url=songUrl(location.href,currentKey);
  try{
    await navigator.clipboard.writeText(url);
    byId('copy-status').textContent='Copied';
    byId('manual-link').hidden=true;
  }catch{
    byId('manual-link').hidden=false;
    byId('share-url').value=url;
    byId('copy-status').textContent='Select and copy the link below.';
    byId('share-url').focus();byId('share-url').select();
  }
});
byId('share-url').addEventListener('focus',event=>event.target.select());

const params=new URL(location.href).searchParams;
const requestedSong=params.get('song');
byId('unknown-song').hidden=!requestedSong||requestedSong===song.id;
let saved=null;
try{saved=localStorage.getItem(STORAGE)??localStorage.getItem('dimotika:key:'+song.id);}catch{/* Device preferences are optional. */}
try{
  const response=await fetch(song.chart,{cache:'no-cache',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error('Chart unavailable');
  publishedText=normalizeChart(await response.text());
  displayedVerses=parseChart(publishedText);
  applyKey(normalizeKey(params.get('key'))??normalizeKey(saved)??BASE_KEY);
  for(const id of ['song-key','key-down','key-up','reset-key','copy-link'])byId(id).disabled=false;
  setupEditor({
    song,
    getPublished:()=>publishedText,
    setPublished:text=>{publishedText=text;displayedVerses=parseChart(text);renderScore(currentKey);},
    preview:verses=>{displayedVerses=verses;renderScore(currentKey);},
    restore:()=>{displayedVerses=parseChart(publishedText);renderScore(currentKey);},
  });
}catch{
  byId('score').textContent='Could not load the song. Please refresh the page.';
}
addEventListener('popstate',()=>applyKey(normalizeKey(new URL(location.href).searchParams.get('key'))??BASE_KEY,{persist:false}));

// Optional browser-agent access uses the same validated action as the controls.
if(document.modelContext?.registerTool){
  const lifecycle=new AbortController();
  try{
    void Promise.resolve(document.modelContext.registerTool({
      name:'set_song_key',title:'Transpose song',
      description:'Transpose the displayed song to a tonic. Changes only this browser and its shareable URL.',
      inputSchema:{type:'object',properties:{key:{type:'string',enum:KEYS}},required:['key'],additionalProperties:false},
      annotations:{readOnlyHint:false,untrustedContentHint:false},
      execute(input){
        if(!input||typeof input!=='object'||!KEYS.includes(input.key)||Object.keys(input).length!==1)throw new Error('Invalid key');
        return applyKey(input.key);
      },
    },{signal:lifecycle.signal})).catch(()=>{});
  }catch{/* Regular browser controls remain available. */}
  addEventListener('pagehide',event=>{if(!event.persisted)lifecycle.abort();},{once:true});
}
