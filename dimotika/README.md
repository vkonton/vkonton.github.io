# Dimotika songbook

Public URL: https://vkonton.github.io/dimotika/

This self-contained folder is served by the existing GitHub Pages/Jekyll setup. It has no server, account requirement, remote runtime, API key or build dependencies. The homepage and Jekyll configuration are unchanged.

- `index.html`: minimal song page and controls.
- `songbook.css`: responsive black-and-white layout.
- `songs.mjs`: traditional lyrics and the user-corrected accompaniment in inline ChordPro notation, e.g. `[Dm]πάνω σε ψη[E]λή ρα[Dm]χούλα`.
- `music.mjs`: parsing and transposition.
- `songbook.mjs`: page rendering, controls, local preferences and share links.

The chord progression was corrected by the user: hold Dm through the first two lines, then Dm–E–Dm on each of the next two lines. The same pattern is applied to the following verses. Chord-to-syllable placement is an editorial alignment, not a timed transcription. These provenance notes are kept here rather than on the performance page:

- Traditional [lyrics](https://el.wikisource.org/wiki/Πάνω_σε_ψηλή_ραχούλα).
- The earlier chart extrapolated from a [publisher's public sample](https://www.nakas.gr/el/proionta/partitoures-online/gia-ola-ta-organa/dimotika-tragoudia/filippos-nakas-pano-se-psili-rachoula_570432/) and unrelated modal research. Its opening changes and D-major/C cadences were incorrect for the user's arrangement and have been removed. The current chart follows the user's correction, not those sources.

Song links use `?song=pano-se-psili-rachoula`; add `&key=E` for a particular key. Encode a sharp as `%23` in URLs. Key changes are local to the browser, and do not change the audio recording or Google Sheet. The Google Sheet is a set list linking to the songbook; it is not a live source of chart data.

To preview locally from the repository root, run `python3 -m http.server 8000` and open `http://localhost:8000/dimotika/`. Run the transposition checks with `node --test dimotika/music.test.mjs`. No install step is needed.
