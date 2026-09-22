import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeChart,parseChart,repositoryPath,readGithubChart,checkSave} from './chart.mjs';
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
test('chart paths are restricted to the expected song',()=>{
  assert.equal(repositoryPath(id),'chords/charts/pano-se-psili-rachoula.txt');
  assert.throws(()=>repositoryPath('../../other-repository'));
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
