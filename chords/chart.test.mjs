import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeChart,parseChart,repositoryPath,readGithubChart,checkSave,chartParts,withChartKey} from './chart.mjs';
import {songs} from './songs.mjs';
import {readFile} from 'node:fs/promises';
import {parseLine,transposeChord} from './music.mjs';

const id='pano-se-psili-rachoula';
const original='[Dm]Πάνω σε ψηλή ραχούλα\n\n[Dm]κάθεται [E]μια βλαχο[Dm]πούλα.\n';
const changed=original.replace('[Dm]Πάνω','[Am]Πάνω');
test('plain text keeps Greek lyrics and verse boundaries, including CRLF and blank lines',()=>{
  assert.deepEqual(parseChart(original.replaceAll('\n','\r\n')), [['[Dm]Πάνω σε ψηλή ραχούλα'],['[Dm]κάθεται [E]μια βλαχο[Dm]πούλα.']]);
  assert.equal(normalizeChart('  [Dm]πάνω\r\n\r\n'), '[Dm]πάνω\n');
});
test('invalid brackets, chord names and empty or excessive charts are rejected',()=>{
  for(const text of ['', '[Hm]πάνω', '[Dmπάνω', '[Dm]]πάνω','[D[Em]]πάνω','[Djavascript]πάνω','x'.repeat(32001),'x\n'.repeat(201)])
    assert.throws(()=>parseChart(text));
  assert.doesNotThrow(()=>parseChart('[Cmaj7/E]one [F#m7b5]two [Bb7(b9)]three [N.C.]four'));
});
test('edited chords transpose without changing their lyrics or qualities',()=>{
  const [line]=parseChart(changed)[0];
  const segments=parseLine(line);
  assert.equal(transposeChord(segments[0].chord,2,'E'),'Bm');
  assert.equal(segments.map(s=>s.text).join(''),'Πάνω σε ψηλή ραχούλα');
});
test('chart paths are restricted to the 52 catalogued songs',()=>{
  assert.equal(repositoryPath(id),'chords/charts/pano-se-psili-rachoula.txt');
  assert.equal(songs.length,52);
  for(const song of songs)assert.equal(repositoryPath(song.id),`chords/charts/${song.id}.txt`);
  for(const invalid of ['../../other-repository','song-00','song-53','song-21','song-01.txt','song-01/../README'])assert.throws(()=>repositoryPath(invalid));
});
test('source key metadata keeps unknown lyrics untransposed and separates metadata from verses',()=>{
  assert.deepEqual(chartParts(original,'D'),{body:original.trim(),baseKey:'D'});
  const unknown=withChartKey('Πάνω\n\nκάθεται',null);
  assert.equal(chartParts(unknown,'D').baseKey,null);
  assert.deepEqual(parseChart(unknown),[['Πάνω'],['κάθεται']]);
  const edited=withChartKey('[Am]Πάνω','A');
  assert.equal(chartParts(edited).baseKey,'A');
  assert.deepEqual(parseChart(edited),[['[Am]Πάνω']]);
  assert.throws(()=>parseChart('{key: H}\ntext'));
  assert.deepEqual(parseChart('{key: unknown}\n',{allowEmpty:true}),[]);
  assert.throws(()=>parseChart('{key: unknown}\n'));
});
test('all catalogued chart files exist, parse, and match the research coverage',async()=>{
  let lyrics=0,empty=0,scored=0;
  for(const song of songs){
    const text=await readFile(new URL(song.chart,import.meta.url),'utf8');
    const verses=parseChart(text,{allowEmpty:true});
    if(song.id===id)continue;
    if(song.number===2){
      assert.equal(chartParts(text).baseKey,'E');
      const chords=verses.flat().flatMap(line=>parseLine(line).filter(s=>s.chord).map(s=>s.chord));
      assert.deepEqual([...new Set(chords)].sort(),['Am','Em','G']);
      assert.equal(song.status,'draft');
      assert.ok(song.arrangementNote,'Source arrangement must be identified above the chart');
      scored++;
    }else{
      assert.equal(chartParts(text).baseKey,null);
      assert.ok(!text.includes('['),'No inferred chord symbols in lyrics-only entries');
    }
    if(verses.length)lyrics++;else empty++;
  }
  assert.equal(lyrics,31);assert.equal(empty,20);assert.equal(scored,1);
});
test('save detects remote conflicts but recognises a completed commit',()=>{
  assert.deepEqual(checkSave(changed,original,{text:original}),{text:changed,alreadySaved:false});
  assert.throws(()=>checkSave(changed,original,{text:original.replace('[E]','[F]')}),/changed/);
  assert.deepEqual(checkSave(changed,original,{text:changed}),{text:changed,alreadySaved:true});
  assert.throws(()=>checkSave('[H]bad',original,{text:original}));
});
test('read-only GitHub request decodes Greek and verifies file identity',async()=>{
  const payload={path:repositoryPath(id),type:'file',sha:'a'.repeat(40),encoding:'base64',content:Buffer.from(original).toString('base64')};
  const result=await readGithubChart(id,async(url,options)=>{
    assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');
    assert.ok(url.startsWith('https://api.github.com/repos/vkonton/vkonton.github.io/contents/chords/charts/'));
    return {ok:true,json:async()=>payload};
  });
  assert.deepEqual(result,{text:original,sha:'a'.repeat(40)});
  await assert.rejects(readGithubChart(id,async()=>({ok:true,json:async()=>({...payload,path:'other.txt'})})));
  await assert.rejects(readGithubChart(id,async()=>({ok:false})),/GitHub/);
});
