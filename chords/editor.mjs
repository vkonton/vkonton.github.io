import {parseChart,normalizeChart,readGithubChart,chartParts,withChartKey} from './chart.mjs?v=8';
import {currentUser,initialAuthError,isConfigured,didReturnFromLogin,signIn,signOut,request} from './auth.mjs?v=8';

export function setupEditor({song,getPublished,setPublished,preview,restore}){
  const el=id=>document.getElementById(id),input=el('chart-editor'),sourceKey=el('source-key');
  const storageKey='chords:draft:'+song.id,legacyKey='dimotika:draft:'+song.id;
  let base=getPublished(),busy=false,user=null;
  function draftText(){
    // Keep legacy charts byte-for-byte unchanged until the user changes them.
    if(!base.startsWith('{key:')&&(sourceKey.value||null)===song.baseKey)return normalizeChart(input.value);
    return withChartKey(input.value,sourceKey.value||null);
  }
  function displayDraft(text){
    const parts=chartParts(text,song.baseKey);input.value=parts.body;sourceKey.value=parts.baseKey||'';
  }
  const message=(text,error=false)=>{
    el('editor-status').textContent=text;el('editor-status').classList.toggle('error',error);
  };
  function remember(){
    try{localStorage.setItem(storageKey,JSON.stringify({text:draftText(),base}));return true;}catch{return false;}
  }
  function forget(){try{localStorage.removeItem(storageKey);localStorage.removeItem(legacyKey);}catch{}}
  function authControls(){
    el('auth-user').textContent=user?'Signed in as '+user.login:'';
    el('sign-in').hidden=Boolean(user);el('sign-out').hidden=!user;
    el('sign-in').disabled=busy;el('save-chart').disabled=busy;
  }
  function setBusy(value){
    busy=value;
    for(const id of ['preview-chart','reload-chart','cancel-edit','sign-out'])el(id).disabled=value;
    input.readOnly=value;sourceKey.disabled=value;el('editor-panel').setAttribute('aria-busy',String(value));authControls();
  }
  function usePublished(latest){base=latest.text;setPublished(latest.text);}
  async function openEditor(){
    if(!el('editor-panel').hidden){input.focus();return;}
    el('editor-panel').hidden=false;el('edit-song').setAttribute('aria-expanded','true');
    base=getPublished();displayDraft(base);
    let draft=null;
    try{draft=JSON.parse(localStorage.getItem(storageKey)??localStorage.getItem(legacyKey));}catch{}
    if(draft&&typeof draft.text==='string'&&typeof draft.base==='string'){base=draft.base;displayDraft(draft.text);}
    else draft=null;
    message('Loading from GitHub…');setBusy(true);
    const [latestResult,userResult]=await Promise.allSettled([readGithubChart(song.id),currentUser()]);
    let status='';
    if(latestResult.status==='fulfilled'){
      const latest=latestResult.value;setPublished(latest.text);
      if(draft&&normalizeChart(draft.text)!==latest.text){
        status=base===latest.text?'Your local draft was restored.':'There is a newer version on GitHub. Your local draft is preserved.';
      }else{usePublished(latest);displayDraft(latest.text);forget();}
    }else status=latestResult.reason.message;
    user=userResult.status==='fulfilled'?userResult.value:null;
    const error=initialAuthError()||(userResult.status==='rejected'?userResult.reason.message:'');
    message(error||status||(!isConfigured()?'GitHub sign-in is being configured. Your draft stays in this browser.':''),Boolean(error)||latestResult.status==='rejected');
    setBusy(false);input.focus();
  }
  el('edit-song').addEventListener('click',()=>void openEditor());
  function onDraftChange(){
    const retained=remember();message(retained?'Local draft · not published.':'Draft is only in this tab. Browser storage is unavailable.',!retained);
  }
  input.addEventListener('input',onDraftChange);
  sourceKey.addEventListener('change',onDraftChange);
  el('preview-chart').addEventListener('click',()=>{
    try{preview(parseChart(draftText()),draftText());remember();message('Preview · not published.');}catch(error){message(error.message,true);}
  });
  el('cancel-edit').addEventListener('click',()=>{
    if(!remember()&&draftText()!==base){message('Browser storage is unavailable. Copy your draft before closing.',true);return;}
    restore();el('editor-panel').hidden=true;el('edit-song').setAttribute('aria-expanded','false');el('edit-song').focus();
  });
  el('reload-chart').addEventListener('click',async()=>{
    if(draftText()!==base&&!confirm('Replace your local draft with the latest version from GitHub?'))return;
    setBusy(true);
    try{const latest=await readGithubChart(song.id);usePublished(latest);displayDraft(latest.text);forget();restore();message('Latest version loaded.');}
    catch(error){message(error.message,true);}finally{setBusy(false);}
  });
  el('sign-in').addEventListener('click',()=>{
    if(!remember()){message('Browser storage is unavailable. Copy your draft before signing in.',true);return;}
    try{signIn();}catch(error){message(error.message,true);}
  });
  el('sign-out').addEventListener('click',async()=>{
    setBusy(true);
    try{await signOut();user=null;message('Signed out.');}catch(error){message(error.message,true);}finally{setBusy(false);}
  });
  el('save-chart').addEventListener('click',async()=>{
    if(busy)return;
    if(!user){
      message(isConfigured()?'Sign in with GitHub, then save your changes.':'GitHub sign-in is not connected yet. Your draft is preserved.',true);
      el('sign-in').focus();return;
    }
    try{parseChart(draftText());}catch(error){message(error.message,true);return;}
    remember();setBusy(true);message('Saving to GitHub…');
    try{
      const saved=await request('/chart',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({song:song.id,text:draftText(),base})});
      parseChart(saved.text);
      if(draftText()!==saved.text)throw new Error('GitHub did not confirm this draft. It has been preserved.');
      usePublished(saved);displayDraft(saved.text);forget();preview(parseChart(saved.text),saved.text);
      message(saved.alreadySaved?'Already saved on GitHub.':'Saved on GitHub. The public page will update after publishing.');
    }catch(error){
      message(error.message||'Could not confirm the save. Your draft is preserved.',true);
      try{user=await currentUser();}catch{user=null;}
    }finally{setBusy(false);}
  });
  addEventListener('beforeunload',event=>{
    if(!el('editor-panel').hidden&&draftText()!==base&&!remember()){event.preventDefault();event.returnValue='';}
  });
  el('edit-song').disabled=false;authControls();
  if(didReturnFromLogin())void openEditor();
}
