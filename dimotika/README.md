# Dimotika songbook

Public URL: https://vkonton.github.io/dimotika/

This self-contained folder is served by the existing GitHub Pages/Jekyll setup. It has no server, account requirement, remote runtime, API key or build dependencies. The homepage and Jekyll configuration are unchanged.

- `index.html`: page structure and source notes.
- `songbook.css`: responsive layout.
- `songs.mjs`: traditional lyrics and the **provisional** accompaniment in inline ChordPro notation, e.g. `[Dm]Πά… [E]μωρέ`.
- `music.mjs`: parsing and transposition.
- `songbook.mjs`: page rendering, controls, local preferences and share links.

The initial song chart remains a rehearsal draft, not a verified transcription of the linked recording. See the page's sources section for the distinction.

Song links use `?song=pano-se-psili-rachoula`; add `&key=E` for a particular key. Encode a sharp as `%23` in URLs. Key changes are local to the browser, and do not change the audio recording or Google Sheet. The Google Sheet is a set list linking to the songbook; it is not a live source of chart data.

To preview locally from the repository root, run `python3 -m http.server 8000` and open `http://localhost:8000/dimotika/`. Run the transposition checks with `node --test dimotika/music.test.mjs`. No install step is needed.
