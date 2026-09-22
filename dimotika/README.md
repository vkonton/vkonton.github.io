# Dimotika songbook

Public URL: https://vkonton.github.io/dimotika/

This self-contained folder is served by the existing GitHub Pages/Jekyll setup. Reading, transposing and playing recordings require no account. Permanent edits use GitHub's own authenticated file editor and commit screen. There is no authentication backend, token stored in the site, new OAuth app or build dependency. The homepage and Jekyll configuration are unchanged.

- `index.html`: minimal song page and controls.
- `songbook.css`: responsive black-and-white layout.
- `songs.mjs`: song metadata and the chart file path.
- `charts/pano-se-psili-rachoula.txt`: the lyrics and user-corrected chords in inline ChordPro notation, e.g. `[Dm]πάνω σε ψη[E]λή ρα[Dm]χούλα`. Blank lines separate verses. This is the file to edit on GitHub.
- `chart.mjs`: chart validation, read-only GitHub file loading and conflict checks.
- `editor.mjs`: draft recovery, preview and the GitHub save handoff.
- `music.mjs`: parsing and transposition.
- `songbook.mjs`: page rendering, controls, local preferences and share links.
- `audio/pano-se-psili-rachoula.m4a`: the user's 48-second recording, copied from `Studio Mix.m4a` in its original AAC format (about 949 KB). The native browser player loads metadata initially and plays on request; transposing the chart leaves the recording in its original key.

The chord progression was corrected by the user: hold Dm through the first two lines, then Dm–E–Dm on each of the next two lines. The same pattern is applied to the following verses. Chord-to-syllable placement is an editorial alignment, not a timed transcription. These provenance notes are kept here rather than on the performance page:

- Traditional [lyrics](https://el.wikisource.org/wiki/Πάνω_σε_ψηλή_ραχούλα).
- The earlier chart extrapolated from a [publisher's public sample](https://www.nakas.gr/el/proionta/partitoures-online/gia-ola-ta-organa/dimotika-tragoudia/filippos-nakas-pano-se-psili-rachoula_570432/) and unrelated modal research. Its opening changes and D-major/C cadences were incorrect for the user's arrangement and have been removed. The current chart follows the user's correction, not those sources.

Song links use `?song=pano-se-psili-rachoula`; add `&key=E` for a particular key. Encode a sharp as `%23` in URLs. Key changes are local to the browser, and do not change the audio recording or Google Sheet. The Google Sheet is a set list linking to the songbook; it is not a live source of chart data.

## Editing and saving

1. Click **Επεξεργασία** on the song page. Edit the chords in brackets in the original key, D. The preview follows the key selected on the page.
2. Click **Προεπισκόπηση** to check the result. Drafts are saved only in this browser when local storage is available.
3. Click **Αποθήκευση στο GitHub**. The page checks the current repository file, copies the edited chart and opens GitHub in another tab. If copying or the popup is blocked, it shows a manual copy/open fallback.
4. Sign in to GitHub if necessary. Select all text in the file editor, paste the chart and click **Commit changes**. To publish directly, commit to `master`. GitHub Pages then rebuilds the site. Users without repository write access can propose changes for review instead.
5. Return to the songbook or click **Έλεγχος αποθήκευσης**. The page confirms a save only when the repository file actually matches the draft. Until then, the draft stays local.

The public GitHub Contents API is used only to read this chart. If it is unavailable or detects a newer version, saving is stopped and the draft is retained. The handoff check does not replace reviewing GitHub's final diff, especially when several people edit concurrently. **Φόρτωση τελευταίας έκδοσης** reloads the repository copy; replacing an edited draft asks for confirmation.

To preview locally from the repository root, run `python3 -m http.server 8000` and open `http://localhost:8000/dimotika/`. Run checks with `node --test dimotika/music.test.mjs dimotika/chart.test.mjs`. No install step is needed.
