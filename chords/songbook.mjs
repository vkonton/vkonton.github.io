import {KEYS,mod12,normalizeKey,parseLine,pitch,songUrl,transposeChord} from './music.mjs?v=8';
import {songs,song as defaultSong,getSong,statusLabels} from './songs.mjs?v=8';
import {parseChart,normalizeChart,chartParts} from './chart.mjs?v=8';
import {setupEditor} from './editor.mjs?v=8';

// Auth restores the pre-login URL before this module selects the song.
const params=new URL(location.href).searchParams;
const song=getSong(params.get('song'))??defaultSong;
const STORAGE='chords:key:'+song.id;
const byId=id=>document.getElementById(id);
const selector=byId('song-key');
let currentKey=song.baseKey,sourceKey=song.baseKey;
let publishedText='',displayedVerses=[],hasChords=false;

function setSongStatus(text){
  const status=byId('song-status');
  status.textContent=text;status.hidden=!text;
}
function span(className,text){
  const element=document.createElement('span');
  element.className=className;
  if(text!==undefined)element.textContent=text;
  return element;
}
function renderScore(){
  const fragment=document.createDocumentFragment();
  const shift=sourceKey&&currentKey?pitch(currentKey)-pitch(sourceKey):0;
  displayedVerses.forEach(verse=>{
    const section=document.createElement('section');section.className='verse';
    for(const line of verse){
      const paragraph=document.createElement('p');paragraph.className='song-line';
      // Keep syllables of a word together when the line wraps on a phone.
      for(const word of line.split(/(\s+)/).filter(Boolean)){
        const group=span('word');
        for(const segment of parseLine(word)){
          const phrase=span('phrase');
          phrase.append(span('chord',segment.chord?transposeChord(segment.chord,shift,currentKey):'\u00a0'),span('lyric',segment.text));
          group.append(phrase);
        }
        paragraph.append(group);
      }
      section.append(paragraph);
    }
    fragment.append(section);
  });
  if(!displayedVerses.length){
    const empty=document.createElement('p');empty.className='empty-chart';
    empty.textContent=song.status==='instrumental'?'Instrumental selection. Add an accompaniment with Edit.':song.status==='linked'?'Lyrics are linked under Sources & version notes. You can add your own chart with Edit.':'The lyrics for this version still need to be identified. You can add them with Edit.';
    fragment.append(empty);
  }
  byId('score').replaceChildren(fragment);
  byId('score').classList.toggle('lyrics-only',!hasChords);
}
function updateKeyControls(){
  const enabled=Boolean(sourceKey&&hasChords);
  byId('transpose-controls').hidden=!enabled;byId('reset-key').hidden=!enabled;
  for(const id of ['song-key','key-down','key-up','reset-key'])byId(id).disabled=!enabled;
  selector.value=currentKey||'';
  byId('reset-key').textContent='↺ '+(sourceKey||'');
  byId('reset-key').setAttribute('aria-label','Reset to '+(sourceKey||'source key'));
}
function displayChart(text,verses=parseChart(text,{allowEmpty:true})){
  const previous=sourceKey;
  sourceKey=chartParts(text,song.baseKey).baseKey;
  displayedVerses=verses;hasChords=verses.some(verse=>verse.some(line=>/\[[^\]]+\]/.test(line)));
  if(!sourceKey)currentKey=null;
  else if(!currentKey||previous!==sourceKey)currentKey=sourceKey;
  updateKeyControls();renderScore();
  history.replaceState(null,'',shareUrl());
  setSongStatus(hasChords?(sourceKey?'':'Chords added · source key unknown'):verses.length?'Lyrics · chords needed':statusLabels[song.status]);
}
function shareUrl(){return songUrl(location.href,hasChords&&sourceKey?currentKey:null,song.id);}
function applyKey(value,{persist=true}={}){
  const next=normalizeKey(value);
  if(!next||!sourceKey||!hasChords)throw new Error('Set the source key and add chords before transposing.');
  currentKey=next;selector.value=next;
  byId('copy-status').textContent='';byId('manual-link').hidden=true;
  renderScore();
  if(persist){
    try{localStorage.setItem(STORAGE,next);}catch{/* A private window may disable storage. */}
    history.replaceState(null,'',shareUrl());
  }
  return {song:song.id,key:next};
}
const fold=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('el').replace(/ς/g,'σ');
function renderCollection(){
  const query=fold(byId('song-search').value.trim()),filter=byId('song-filter').value;
  const filtered=songs.filter(entry=>{
    const status=entry.id===song.id?(displayedVerses.length?'lyrics':entry.status):entry.status;
    return (!query||fold(entry.title+' '+entry.youtubeLabel+' '+entry.section).includes(query))&&
      (filter==='all'||filter==='lyrics'&&['lyrics','draft'].includes(status)||filter==='needed'&&['pending','linked'].includes(status)||filter==='instrumental'&&status==='instrumental');
  });
  byId('song-list').replaceChildren(...filtered.map(entry=>{
    const link=document.createElement('a');link.href=songUrl(location.href,null,entry.id);
    const title=span('catalog-title',String(entry.number).padStart(2,'0')+'. '+entry.title);title.lang='el';
    link.append(title,span('catalog-status',statusLabels[entry.status]));
    if(entry.id===song.id)link.setAttribute('aria-current','page');
    return link;
  }));
  byId('collection-count').textContent=filtered.length+' of '+songs.length+' songs';
}
byId('song-search').addEventListener('input',renderCollection);
byId('song-filter').addEventListener('change',renderCollection);
renderCollection();
const index=songs.indexOf(song);
for(const [id,entry] of [['previous-song',songs[index-1]],['next-song',songs[index+1]]]){
  byId(id).hidden=!entry;if(entry)byId(id).href=songUrl(location.href,null,entry.id);
}
byId('song-number').textContent=String(song.number).padStart(2,'0')+' / '+songs.length;
byId('song-title').textContent=song.title;document.title=song.title+' · Chords';
setSongStatus(song.status==='draft'?'':statusLabels[song.status]);
byId('youtube').href=song.youtube;byId('youtube').setAttribute('aria-label','YouTube · '+song.youtubeLabel);
byId('unknown-song').hidden=!params.get('song')||Boolean(getSong(params.get('song')));
byId('version-note').textContent=song.notes;
byId('chord-evidence').textContent=song.chordEvidence;
byId('song-sources').replaceChildren(...song.sources.map(source=>{
  const item=document.createElement('li'),link=document.createElement('a');
  link.href=source.url;link.textContent=source.label;link.target='_blank';link.rel='noopener noreferrer';item.append(link);return item;
}));
if(song.audio){
  byId('song-audio').src=song.audio;byId('song-audio').hidden=false;
  byId('song-audio').setAttribute('aria-label','Recording · '+song.title);byId('audio-download').href=song.audio;
}
selector.replaceChildren(...KEYS.map(key=>{
  const option=document.createElement('option');option.value=key;option.textContent=key;return option;
}));
byId('source-key').append(...KEYS.map(key=>{
  const option=document.createElement('option');option.value=key;option.textContent=key;return option;
}));
selector.addEventListener('change',()=>applyKey(selector.value));
byId('key-down').addEventListener('click',()=>applyKey(KEYS[mod12(pitch(currentKey)-1)]));
byId('key-up').addEventListener('click',()=>applyKey(KEYS[mod12(pitch(currentKey)+1)]));
byId('reset-key').addEventListener('click',()=>applyKey(sourceKey));
byId('copy-link').addEventListener('click',async()=>{
  const url=shareUrl();
  try{
    await navigator.clipboard.writeText(url);byId('copy-status').textContent='Copied';byId('manual-link').hidden=true;
  }catch{
    byId('manual-link').hidden=false;byId('share-url').value=url;
    byId('copy-status').textContent='Select and copy the link below.';byId('share-url').focus();byId('share-url').select();
  }
});
byId('share-url').addEventListener('focus',event=>event.target.select());
let saved=null;
try{saved=localStorage.getItem(STORAGE)??localStorage.getItem('dimotika:key:'+song.id);}catch{/* Preferences are optional. */}
try{
  const response=await fetch(song.chart,{cache:'no-cache',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error('Chart unavailable');
  publishedText=normalizeChart(await response.text());displayChart(publishedText);renderCollection();
  if(sourceKey&&hasChords)applyKey(normalizeKey(params.get('key'))??normalizeKey(saved)??sourceKey);
  else history.replaceState(null,'',shareUrl());
  byId('copy-link').disabled=false;
  setupEditor({
    song,
    getPublished:()=>publishedText,
    setPublished:text=>{publishedText=text;displayChart(text);},
    preview:(verses,text)=>displayChart(text,verses),
    restore:()=>displayChart(publishedText),
  });
}catch{
  byId('score').textContent='Could not load the song. Please refresh the page.';
}
addEventListener('popstate',()=>{
  const next=new URL(location.href).searchParams;
  if((getSong(next.get('song'))??defaultSong).id!==song.id){location.reload();return;}
  if(sourceKey&&hasChords)applyKey(normalizeKey(next.get('key'))??sourceKey,{persist:false});
});

if(document.modelContext?.registerTool){
  const lifecycle=new AbortController();
  try{
    void Promise.resolve(document.modelContext.registerTool({
      name:'set_song_key',title:'Transpose song',
      description:'Transpose the displayed song to a tonic when its source key is known. Changes only this browser and its shareable URL.',
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
