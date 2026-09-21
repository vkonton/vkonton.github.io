# Dimotika songbook

Public URL: https://vkonton.github.io/dimotika/

This self-contained folder is served by the existing GitHub Pages/Jekyll setup. It has no server, account requirement, remote runtime, API key or build dependencies. The homepage and Jekyll configuration are unchanged.

- `index.html`: minimal song page and controls.
- `songbook.css`: responsive black-and-white layout.
- `songs.mjs`: traditional lyrics and the **provisional** accompaniment in inline ChordPro notation, e.g. `[Dm]Πά… [E]μωρέ`.
- `music.mjs`: parsing and transposition.
- `songbook.mjs`: page rendering, controls, local preferences and share links.

The initial song chart remains a rehearsal draft, not a verified transcription of the linked recording. These research notes are kept here rather than on the performance page:

- Traditional [lyrics](https://el.wikisource.org/wiki/Πάνω_σε_ψηλή_ραχούλα).
- The opening Gm–A–Gm phrase follows the [publisher's public sample](https://www.nakas.gr/el/proionta/partitoures-online/gia-ola-ta-organa/dimotika-tragoudia/filippos-nakas-pano-se-psili-rachoula_570432/), transposed to D. Later chord placements and cadences are proposed accompaniment.
- [Kanellatou](https://kanellatou.gr/el/paradosiako/sterea-ellada/aitoloakarnania/pano-se-psili-rachoula.html) documents a syrtos 8/8 version, Nikriz changing to Rast; rhythmic versions differ.

Song links use `?song=pano-se-psili-rachoula`; add `&key=E` for a particular key. Encode a sharp as `%23` in URLs. Key changes are local to the browser, and do not change the audio recording or Google Sheet. The Google Sheet is a set list linking to the songbook; it is not a live source of chart data.

To preview locally from the repository root, run `python3 -m http.server 8000` and open `http://localhost:8000/dimotika/`. Run the transposition checks with `node --test dimotika/music.test.mjs`. No install step is needed.
