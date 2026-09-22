export const KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const BASE_KEY = 'D';
const PITCH = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const mod12 = (n) => ((n % 12) + 12) % 12;
export function pitch(note) {
    const match = /^([A-G])([#b♯♭]?)$/.exec(note);
    if (!match)
        throw new Error('Invalid note');
    return mod12(PITCH[match[1]] + (['#', '♯'].includes(match[2]) ? 1 : ['b', '♭'].includes(match[2]) ? -1 : 0));
}
export function normalizeKey(value) {
    if (!value)
        return null;
    try {
        return KEYS[pitch(value)];
    }
    catch {
        return null;
    }
}
export function transposeChord(chord, semitones, targetKey) {
    if (chord === 'N.C.')
        return chord;
    const m = /^([A-G][#b♯♭]?)([^/]*)(?:\/([A-G][#b♯♭]?))?$/.exec(chord);
    if (!m || !Number.isInteger(semitones))
        throw new Error('Invalid chord or interval');
    const names = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'].includes(targetKey) ? FLATS : SHARPS;
    const root = names[mod12(pitch(m[1]) + semitones)];
    const bass = m[3] ? '/' + names[mod12(pitch(m[3]) + semitones)] : '';
    return root + m[2] + bass;
}
export function parseLine(line) {
    const segments = [];
    const regex = /\[([^\]]+)\]/g;
    let last = 0, chord = null;
    for (const match of line.matchAll(regex)) {
        if (match.index > last)
            segments.push({ chord, text: line.slice(last, match.index) });
        chord = match[1];
        last = match.index + match[0].length;
    }
    if (last < line.length || chord)
        segments.push({ chord, text: line.slice(last) });
    return segments;
}
export function songUrl(origin, key) {
    const url = new URL(origin);
    url.searchParams.set('song', 'pano-se-psili-rachoula');
    url.searchParams.set('key', normalizeKey(key) ?? BASE_KEY);
    return url.toString();
}
