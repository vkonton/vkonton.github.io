import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEYS, normalizeKey, parseLine, pitch, songUrl, transposeChord } from './music.mjs';
import { song } from './songs.mjs';
test('transposes roots, minor qualities, extensions and slash basses', () => {
    assert.equal(transposeChord('Dm', 2, 'E'), 'Em');
    assert.equal(transposeChord('E', 2, 'E'), 'F#');
    assert.equal(transposeChord('D', 2, 'E'), 'E');
    assert.equal(transposeChord('C', 2, 'E'), 'D');
    assert.equal(transposeChord('Cmaj7/E', 2, 'D'), 'Dmaj7/F#');
    assert.equal(transposeChord('Bm7b5', 1, 'C'), 'Cm7b5');
    assert.equal(transposeChord('F#sus4/C#', 1, 'G'), 'Gsus4/D');
    assert.equal(transposeChord('N.C.', 3, 'F'), 'N.C.');
});
test('all twelve keys transpose the complete chart and reset without drift', () => {
    const chords = song.verses.flatMap(v => v.flatMap(l => parseLine(l).flatMap(s => s.chord ? [s.chord] : [])));
    for (const key of KEYS)
        for (const chord of chords) {
            const amount = pitch(key) - pitch('D');
            const moved = transposeChord(chord, amount, key);
            assert.equal(transposeChord(moved, -amount, 'D'), chord);
        }
});
test('enharmonics, flats, negative shifts and octave wrap', () => {
    assert.equal(normalizeKey('C#'), 'Db');
    assert.equal(normalizeKey('E♭'), 'Eb');
    assert.equal(normalizeKey('invalid'), null);
    assert.equal(transposeChord('Dm', -4, 'Bb'), 'Bbm');
    assert.equal(transposeChord('B7/F#', 1, 'C'), 'C7/G');
    assert.equal(transposeChord('Dm', 12, 'D'), 'Dm');
});
test('parsing preserves exact lyrics while keeping chords anchored', () => {
    const s = parseLine('[Dm]σε ψη[E]λή ρα[Dm]χούλα,');
    assert.equal(s.map(x => x.text).join(''), 'σε ψηλή ραχούλα,');
    assert.deepEqual(s.map(x => x.chord), ['Dm', 'E', 'Dm']);
    assert.deepEqual(parseLine('χωρίς συγχορδία'), [{ chord: null, text: 'χωρίς συγχορδία' }]);
});
test('key links survive reserved characters and select the pilot song', () => {
    const u = new URL(songUrl('https://example.com/?other=1', 'F#'));
    assert.equal(u.searchParams.get('key'), 'F#');
    assert.equal(u.searchParams.get('song'), song.id);
    assert.equal(u.searchParams.get('other'), '1');
});
