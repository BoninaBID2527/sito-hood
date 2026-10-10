# Verifiche — V3.8 task 11

Baseline e3456eb (main V3.7); candidata sul branch work/hooddino-v3-8-11-graffiti-signage-studio-cleanup. Nessuna foundation bypassata. Chromium 151 / Linux / SwiftShader, 2 CPU / 8 GiB: verifica logica e visiva, non misura FPS GPU o dispositivi Apple.

## Build e supporto

- `npm run build`: PASS, [build-final.log](build-final.log), build `7af_y4Q7_TII4cHtQPTwH`.
- `npm run typecheck` (`tsc --noEmit`): PASS, [typecheck-final.log](typecheck-final.log).
- `python qa/v38/cleanup11/placement-audit.py`: PASS, 73 placement attivi, 0 conflitti; 3 insegne a parete, 0 conflitti. Fixture reali di aperture e hardware, inclusi 246 ingombri della piazza. [placement-audit.json](placement-audit.json), [sign-support-audit.json](sign-support-audit.json).
- Keyboard, otto file della foundation, public/ e data/ confrontati con e3456eb: conservati. [preservation.json](preservation.json).

## Pipeline finale

La pipeline finale ha **12 fasi passate**. Comandi, configurazioni e orari sono registrati in [results.json](results.json). I tentativi interrotti restano in attempts/ e non contano come risultato finale.

| Fase | Risultato | Evidenza |
| --- | --- | --- |
| after | PASS — catture completate, console pulita, riflessi finiti | [after.log](after.log) |
| before-oneway | PASS — catture completate, console pulita, riflessi finiti | [before-oneway.log](before-oneway.log) |
| before-room | PASS — catture completate, console pulita, riflessi finiti | [before-room.log](before-room.log) |
| after-room | PASS — catture completate, console pulita, riflessi finiti | [after-room.log](after-room.log) |
| no-post | PASS — catture completate, console pulita, riflessi finiti | [no-post.log](no-post.log) |
| after-high | PASS — catture completate, console pulita, riflessi finiti | [after-high.log](after-high.log) |
| picking | PASS — 14 assertion, 0 fallite | [picking.log](picking.log) |
| e2e | PASS — 22 assertion, 0 fallite | [e2e.log](e2e.log) |
| ROOM-desktop | PASS — 56 assertion, 0 fallite | [ROOM-desktop.log](ROOM-desktop.log) |
| eggs | PASS — 21 assertion, 0 fallite | [eggs.log](eggs.log) |
| secrets | PASS — 18 assertion, 0 fallite | [secrets.log](secrets.log) |
| tracks | PASS — 8 assertion, 0 fallite | [tracks.log](tracks.log) |

**139 assertion funzionali passate, 0 fallite.** Il numero non include gli audit geometrici, build/typecheck o i voti delle immagini.

Tracks usa balanced / 800×450 / scala 0.4, con lo stesso aspect ratio e le stesse frazioni di viewport dei gesti originali. Il viewport è configurabile (1280×720 resta disponibile); le attese di 9/7/5/4 secondi **simulati** e tutte le asserzioni originali sono conservate. `node --check scripts/tracks-check.mjs`: PASS. La configurazione riduce il costo della QA SwiftShader tramite il normale rendering della foundation.

Il picking usa le coordinate reali delle mesh visibili, false prima dell'input e true dopo click/tap nativi; non chiama foundLetter. Eggs verifica inoltre la lettera spostata lungo il percorso narrativo.

## Correzione del confronto video

Due ricatture del checkpoint 45 completate con exit 0, console pulita e radiance finita. [video-camera-recapture.json](video-camera-recapture.json), [log](video-camera-recapture.log). Entrambi i video in riproduzione, metadata registrato prima di closeFocus. Posizione/quaternion identici; FOV richiesto identico e residuo effettivo pari a 0.061 pixel al bordo. Gli originali sono conservati negli attempts. Nessun codice prodotto o asserzione funzionale modificati per questa correzione.

## Dossier

Viewer PASS: 77 opzioni prima/dopo, pulsanti avanti/indietro, slider, 29 immagini della gallery tutte caricate, nessun errore. [viewer-validation.json](viewer-validation.json), [script](viewer-check.mjs). Servito da localhost con richieste esterne bloccate; il browser gestito impedisce file://. Artefatto portatile senza asset esterni.

## Limiti

Il WebM dei test video è una ricodifica del medesimo MP4 produttivo, instradata solo al browser di QA. Asset produttivo invariato; la discrepanza rispetto al filmato studio autentico richiesto resta la dipendenza della task 09.

I test touch degli indizi sono emulati in Chromium. Questa task non ripete ROOM touch/reduced motion e la regressione/export completa: nessun asset o percorso cambiato; gate 10 sulla versione integrata. Nessuna verifica Safari/iPad/iPhone. I voti fotografici sono separati dall'esito funzionale.
