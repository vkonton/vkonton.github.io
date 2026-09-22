# Chords

Public URL: https://vkonton.github.io/chords/

The songbook is served by the existing GitHub Pages/Jekyll setup. `/dimotika/` redirects here and preserves song/key parameters. The interface is English; song titles and lyrics remain Greek. Reading, transposing and playing recordings require no account.

The September 2026 research supplies 31 traditional lyric texts (including one score-based rehearsal arrangement), 7 instrumental entries, 4 external lyric links (Γιάντα covers only half of its medley), and 9 entries still requiring reliable text or version identification, alongside the existing Rachoula chart. Six Kithara chart bodies were inspected and compared with other sources. Γιάννη uses the identified helmiaut score arrangement; Σηλυβριανός uses an explicitly labelled vocal variant. Neither is presented as an exact transcription of the linked recording. See [the Kithara follow-up](research/KITHARA-FOLLOWUP.md) for agreements, discrepancies and remaining gaps.

Permanent saves use a private GitHub App and a small Cloudflare Worker. The website stays on GitHub Pages. Only the owner, `vkonton`, can save. The GitHub App must be installed on `vkonton/vkonton.github.io` with Contents write permission. There is no manual GitHub editor or clipboard save step.

- `charts/*.txt`: one editable chart for each of the 52 songs. Chords use inline notation such as `[Dm]πάνω`; blank lines separate verses. New songs start with `{key: unknown}` until a source key is selected. Rachoula keeps its existing D reference key and user edits.
- `songs.mjs`: ordered collection, recording links, research status, version notes and source links.
- `song-ids.mjs`: explicit list of song IDs accepted by the editor and save service.
- `research/`: song-by-song evidence, unresolved variants and unverified Kithara candidates.
- `music.mjs`, `songbook.mjs`: transposition and rendering.
- `chart.mjs`: notation validation and latest-file loading.
- `editor.mjs`, `auth.mjs`: draft recovery, preview, login and direct saving.
- `auth-config.mjs`: public authentication-service URL; no secrets.
- `audio/pano-se-psili-rachoula.m4a`: the user's original 48-second AAC recording. Transposing the displayed chords does not change its pitch.
- `../_chords-auth/`: service code and deployment instructions (excluded from the Pages site by Jekyll's underscore convention).

For **Πάνω σε ψηλή ραχούλα**, the chord progression was corrected by the user: hold Dm through the first two lines, then Dm–E–Dm on each of the next two lines. The same pattern is applied to the following verses. Chord-to-syllable placement is an editorial alignment, not a timed transcription. These provenance notes are kept here rather than on the performance page:

- Traditional [lyrics](https://el.wikisource.org/wiki/Πάνω_σε_ψηλή_ραχούλα).
- The earlier chart extrapolated from a [publisher's public sample](https://www.nakas.gr/el/proionta/partitoures-online/gia-ola-ta-organa/dimotika-tragoudia/filippos-nakas-pano-se-psili-rachoula_570432/) and unrelated modal research. Its opening changes and D-major/C cadences were incorrect for the user's arrangement and have been removed. The current chart follows the user's correction, not those sources.

Song links use `?song=song-02` through the catalogue, with Rachoula keeping `?song=pano-se-psili-rachoula`; add `&key=E` for a chart with a known source key. Lyrics-only links omit the key. Encode a sharp as `%23` in URLs. Key changes are local to the browser, and do not change the audio recording or Google Sheet. The Google Sheet is a set list linking to the songbook; it is not a live source of chart data.

## Editing and saving

1. Choose a song from **Songbook · 52 songs**, then click **Edit**. Add or revise lyrics and put chords in brackets. Select the **Source key** when known; unknown keys do not enable transposition.
2. Click **Preview** to check the chart in the selected display key.
3. Click **Sign in with GitHub** once per session. Your draft and selected key survive the redirect.
4. Click **Save**. The service checks the latest file and commits your exact edited text to `master`. GitHub Pages publishes it shortly afterward. No second commit screen is needed.

Drafts stay in local browser storage, including drafts from the old `/dimotika/` page. Closing the editor does not publish a draft. A successful save clears it. **Load latest version** asks before discarding an edited draft. If a newer remote version conflicts, the service preserves the draft and refuses to overwrite it. If a save times out, it reads GitHub to check whether the commit succeeded before offering a retry.

The browser holds only an encrypted session credential in tab storage, for at most eight hours. GitHub tokens and the app secret are not exposed to browser JavaScript. **Sign out** revokes the GitHub token. The app uses no third-party scripts or analytics.

Preview: `python3 -m http.server 8000`, then `http://localhost:8000/chords/`.
Tests: `node --test chords/music.test.mjs chords/chart.test.mjs _chords-auth/worker.test.mjs`. The auth service also has a Cloudflare runtime test described in its README.
