const REPO='vkonton/vkonton.github.io';
const BRANCH='master';
const SONG_ID='pano-se-psili-rachoula';
const CHORD=/^(?:N\.C\.|[A-G][#b♯♭]?(?:(?:maj|min|dim|aug|sus|add|m|M|Δ|ø|°)|[0-9()+#b-])*(?:\/[A-G][#b♯♭]?)?)$/;

export function normalizeChart(text){
  if(typeof text!=='string')throw new Error('Το κείμενο του τραγουδιού δεν είναι έγκυρο.');
  return text.replace(/\r\n?/g,'\n').trim()+'\n';
}

export function parseChart(text){
  if(typeof text!=='string'||text.length>32000)throw new Error('Το τραγούδι πρέπει να είναι έως 32.000 χαρακτήρες.');
  const normalized=normalizeChart(text);
  if(!normalized.trim())throw new Error('Πρόσθεσε τους στίχους και τις συγχορδίες.');
  const lines=normalized.trimEnd().split('\n');
  if(lines.length>200)throw new Error('Το τραγούδι πρέπει να είναι έως 200 γραμμές.');
  for(const [i,line] of lines.entries()){
    const remaining=line.replace(/\[([^\[\]]+)\]/g,(_,chord)=>{
      if(!CHORD.test(chord))throw new Error(`Γραμμή ${i+1}: μη έγκυρη συγχορδία [${chord}].`);
      return '';
    });
    if(/[\[\]]/.test(remaining))throw new Error(`Γραμμή ${i+1}: έλεγξε τις αγκύλες των συγχορδιών.`);
  }
  return normalized.trimEnd().split(/\n[\t ]*\n(?:[\t ]*\n)*/).map(verse=>verse.split('\n'));
}

export function repositoryPath(songId){
  if(songId!==SONG_ID)throw new Error('Το τραγούδι δεν υποστηρίζεται ακόμη.');
  return `dimotika/charts/${songId}.txt`;
}

export function githubEditUrl(songId){
  return `https://github.com/${REPO}/edit/${BRANCH}/${repositoryPath(songId)}`;
}

export async function readGithubChart(songId,fetcher=fetch){
  const path=repositoryPath(songId);
  const response=await fetcher(`https://api.github.com/repos/${REPO}/contents/${path}?ref=${BRANCH}`,{
    cache:'no-store',credentials:'omit',headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(12000),
  });
  if(!response.ok)throw new Error('Δεν φορτώθηκε η τελευταία έκδοση από το GitHub. Δοκίμασε ξανά.');
  const file=await response.json();
  if(file.path!==path||file.type!=='file'||file.encoding!=='base64'||!/^[a-f0-9]{40,64}$/.test(file.sha??'')||typeof file.content!=='string'||file.content.length>180000)
    throw new Error('Το αρχείο του τραγουδιού δεν είναι έγκυρο.');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(file.content.replace(/\s/g,'')),c=>c.charCodeAt(0)));
  parseChart(text);
  return {text:normalizeChart(text),sha:file.sha};
}

export function checkSave(draft,base,latest){
  parseChart(draft);
  const normalized=normalizeChart(draft);
  if(normalized===latest.text)return {text:normalized,alreadySaved:true};
  if(base!==latest.text)throw new Error('Το τραγούδι άλλαξε στο GitHub. Το προσχέδιό σου διατηρήθηκε· φόρτωσε την τελευταία έκδοση πριν αποθηκεύσεις.');
  return {text:normalized,alreadySaved:false};
}
