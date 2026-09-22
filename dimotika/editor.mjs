import {parseChart,normalizeChart,readGithubChart,githubEditUrl,checkSave} from './chart.mjs?v=5';

export function setupEditor({song,getPublished,setPublished,preview,restore}){
  const el=id=>document.getElementById(id);
  const input=el('chart-editor');
  const storageKey='dimotika:draft:'+song.id;
  let base=getPublished(),busy=false,pending=false;
  const message=(text,error=false)=>{
    el('editor-status').textContent=text;
    el('editor-status').classList.toggle('error',error);
  };
  function remember(){
    try{localStorage.setItem(storageKey,JSON.stringify({text:input.value,base}));}catch{}
  }
  function forget(){try{localStorage.removeItem(storageKey);}catch{}}
  function setBusy(value){
    busy=value;
    for(const id of ['preview-chart','save-chart','reload-chart','check-save','cancel-edit'])el(id).disabled=value;
    input.readOnly=value;
    el('editor-panel').setAttribute('aria-busy',String(value));
  }
  function usePublished(latest){base=latest.text;setPublished(latest.text);}
  function completed(latest){
    usePublished(latest);forget();pending=false;
    input.value=latest.text;
    preview(parseChart(latest.text));
    el('github-handoff').hidden=true;
    message('Αποθηκεύτηκε στο GitHub. Η δημόσια σελίδα θα ενημερωθεί μόλις ολοκληρωθεί η δημοσίευση.');
  }
  async function checkPublished(){
    if(busy||!pending)return;
    setBusy(true);
    try{
      const latest=await readGithubChart(song.id);
      if(normalizeChart(input.value)===latest.text)completed(latest);
      else message('Η αλλαγή δεν έχει αποθηκευτεί ακόμη. Ολοκλήρωσε το Commit changes στο GitHub.');
    }catch(error){message(error.message,true);}
    finally{setBusy(false);}
  }
  el('github-editor-link').href=githubEditUrl(song.id);
  el('edit-song').addEventListener('click',async()=>{
    if(!el('editor-panel').hidden){input.focus();return;}
    el('editor-panel').hidden=false;
    el('edit-song').setAttribute('aria-expanded','true');
    el('github-handoff').hidden=true;
    input.value=getPublished();base=getPublished();pending=false;
    let draft=null;
    try{draft=JSON.parse(localStorage.getItem(storageKey));}catch{}
    if(draft&&typeof draft.text==='string'&&typeof draft.base==='string'){
      input.value=draft.text;base=draft.base;
    }
    message('Φόρτωση από το GitHub…');setBusy(true);
    try{
      const latest=await readGithubChart(song.id);
      setPublished(latest.text);
      if(draft&&normalizeChart(draft.text)!==latest.text){
        message(base===latest.text?'Επαναφέρθηκε το τοπικό προσχέδιό σου.':'Υπάρχει νεότερη έκδοση στο GitHub. Το τοπικό προσχέδιό σου διατηρήθηκε.',base!==latest.text);
      }else{
        usePublished(latest);input.value=latest.text;forget();message('');
      }
    }catch(error){message(error.message,true);}
    finally{setBusy(false);input.focus();}
  });
  input.addEventListener('input',()=>{
    remember();el('github-handoff').hidden=true;pending=false;
    message('Τοπικό προσχέδιο · δεν έχει δημοσιευτεί.');
  });
  el('preview-chart').addEventListener('click',()=>{
    try{preview(parseChart(input.value));remember();message('Προεπισκόπηση · δεν έχει δημοσιευτεί.');}
    catch(error){message(error.message,true);}
  });
  el('cancel-edit').addEventListener('click',()=>{
    remember();restore();pending=false;
    el('editor-panel').hidden=true;el('edit-song').setAttribute('aria-expanded','false');el('edit-song').focus();
  });
  el('reload-chart').addEventListener('click',async()=>{
    if(normalizeChart(input.value)!==base&&!confirm('Να αντικατασταθεί το τοπικό προσχέδιο με την τελευταία έκδοση από το GitHub;'))return;
    setBusy(true);
    try{
      const latest=await readGithubChart(song.id);usePublished(latest);input.value=latest.text;forget();pending=false;
      el('github-handoff').hidden=true;restore();message('Φορτώθηκε η τελευταία έκδοση.');
    }catch(error){message(error.message,true);}
    finally{setBusy(false);}
  });
  el('save-chart').addEventListener('click',async()=>{
    try{parseChart(input.value);}catch(error){message(error.message,true);return;}
    // Open synchronously with the click so mobile browsers allow the GitHub tab.
    const tab=window.open('about:blank','_blank');
    if(tab)tab.opener=null;
    setBusy(true);remember();
    try{
      const latest=await readGithubChart(song.id);
      const checked=checkSave(input.value,base,latest);
      if(checked.alreadySaved){tab?.close();completed(latest);message('Η έκδοση αυτή υπάρχει ήδη στο GitHub.');return;}
      preview(parseChart(checked.text));
      pending=true;el('github-handoff').hidden=false;
      try{
        await navigator.clipboard.writeText(checked.text);
        message('Αντιγράφηκε. Στο GitHub: επίλεξε όλο το περιεχόμενο, κάνε επικόλληση και πάτησε Commit changes.');
        if(tab)tab.location.replace(githubEditUrl(song.id));
      }catch{
        tab?.close();input.focus();input.select();
        message('Αντέγραψε το επιλεγμένο κείμενο και άνοιξε το GitHub. Εκεί αντικατάστησε το περιεχόμενο και πάτησε Commit changes.');
      }
    }catch(error){tab?.close();message(error.message,true);}
    finally{setBusy(false);}
  });
  el('check-save').addEventListener('click',checkPublished);
  addEventListener('focus',()=>{void checkPublished();});
  el('edit-song').disabled=false;
}
