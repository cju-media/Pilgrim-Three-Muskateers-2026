# The Three Musketeers – DCA cue runner (Behringer WING)

Start it:

    node server.js

then open http://localhost:3000. No `npm install` needed (Node 18+).

Enter the WING's IP address in the top bar and press Save. With the IP blank the app
runs dry: every message is shown in the "Sent to console" log but nothing is sent.

## What a cue does

* **END cue** – every cast mic is muted and taken off its DCA, and the mic DCAs (1 to `dcaCount`
  in `config.json`, currently 14) are muted. DCAs above that are never touched.
* **Blackout cue (x.y.0)** – the scene's DCAs are muted (no other DCA is touched), then every character in the scene gets a DCA, the DCA is
  renamed to the character, each channel (channel number = mic number) is named and tagged
  onto its DCA, and every channel that is not in the scene is muted.
* **Scene cues (x.y.1, x.y.2 …)** – only DCA mutes change, as characters enter and exit.

The Dante module inputs are named too: module input N gets the same name as channel N
(`"nameSources": "MOD"` in `config.json`; set it to `""` to turn this off).
`"sourceMap"` shifts a mic to a different source number: mics 20 and 21 arrive on
Dante inputs 19 and 20, so input 21 is left blank. Console channels are not shifted.
An entry like `"18": "LCL/5"` names a source in another group instead: mic 18 comes in on
Local In 5, so that source gets the name and Dante input 18 is left blank.

Automix: at each scene change the scene's channels are put in automix group X (their post-insert
slot is set to `AUTO_X`) and all other mics are taken out. `"automix": ""` in `config.json` turns
this off, `"Y"` uses the other group. A channel with an effect in its post insert is left alone.

DCA levels are remembered per character: every time a cue fires, the fader of each character's DCA is
read and saved (`data/levels.json`); the next time that character is given a DCA, its fader is set
to that level. `/api/levels` shows them, `/api/levels/save` reads the faders now, `/api/levels/clear`
forgets them. `"rememberLevels": false` in `config.json` turns this off.

Tags other than `#D1`–`#D16` that are already on a channel (mute groups, custom tags) are kept.

## HTTP control

GET or POST, from QLab, Companion, a Stream Deck, curl …

| URL | Action |
| --- | --- |
| `/api/next` (also `/go`, `/next`) | fire the next cue |
| `/api/prev` (also `/back`) | step back one cue |
| `/api/next-scene` | jump to the next scene's `.0` blackout cue |
| `/api/prev-scene` | jump to the previous scene's `.0` blackout cue |
| `/api/goto/1.5.2` | jump to a cue |
| `/api/first` | jump to 1.1.0 |
| `/api/resync` | re-send the full scene setup for the current cue |
| `/api/state` | current / next cue as JSON |

Keyboard in the page: Space or → = GO, ← = back.

Controls only: http://localhost:3000/control is the same page without the script.

Script only: http://localhost:3000/script.html shows the whole script as one scrolling page
and follows the current cue (open it on a tablet with the computer's address instead of localhost).

## Changing the cues

The cue list lives at the top of `tools/build.py` (mic list, scenes, cue points).
After editing, run `python3 tools/build.py` – it rewrites `data/show.json` and the
marked script `1978_001_MIC_CUES.pdf` – then restart the server.
