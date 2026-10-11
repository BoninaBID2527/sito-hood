# Verifiche eseguite · V3.8 task 02

Codice prodotto invariato fra la build verificata e questi risultati: i due SHA-256 di source.json coincidono con i file presenti. Le utility QA hanno ricevuto le correzioni ai fixture documentate; non è stata indebolita un’asserzione di prodotto.

| Verifica | Risultato | Evidenza |
| --- | --- | --- |
| Build produzione della baseline | PASS | [build-baseline.log](build-baseline.log) |
| Build produzione candidata | PASS | [build-final.log](build-final.log) |
| TypeScript | PASS | [typecheck.log](typecheck.log) |
| Pipeline principale · 11 stage | PASS | [stages.json](stages.json) |
| Dettaglio reale di infisso prima/dopo · 2 stage | PASS | [extra-stages.json](extra-stages.json) |
| Ripetizione seriale intero percorso · 2 stage | PASS, con dati discordanti conservati | [recheck-stages.json](recheck-stages.json) |
| Fronte con camera fissa · 2 stage / 72 frame ciascuno | PASS | [front-stages.json](front-stages.json), [front-comparison.json](front-comparison.json) |
| 554 matrici e template originali nei quattro tier | PASS | [batch-validation.json](batch-validation.json) |
| Vertici alle estremità delle deformazioni shader entro le sfere | PASS · margine minimo osservato 0.19355 m | [batch-validation.log](batch-validation.log) |
| Callback render/ombre · fronte e retro | PASS · catturati dopo i campioni temporizzati | [pass-comparison.json](pass-comparison.json) |
| Reflection-health | PASS · 125 readback senza valori non finiti | results.json delle 15 cartelle di misura/cattura |
| Background shader compilati | PASS · guardie finite, prototipo scartato assente | shader-audit.json delle cartelle di cattura |
| Interazioni brani · 8 asserzioni | PASS · 0 errori console | [tracks.log](tracks.log) |
| Camere dei 29 confronti | PASS · posizione < .04 m, orientamento < .1°, deriva FOV < .1 px | [pairs.json](pairs.json) |
| Foto QA · 125 frame realmente ispezionati | A0/B0/C125 | [FRAME-REVIEW.md](FRAME-REVIEW.md) |
| Viewer locale, rete esterna bloccata | PASS · 29 coppie, 67 immagini aggiuntive, slider e navigazione | [viewer-validation.json](viewer-validation.json) |

Sono conservati 768 intervalli runtime grezzi: 576 nei quattro percorsi completi, 144 nel controllo lungo del fronte e 48 nella diagnostica bump. Warmup20/sample24 sono parametri delle misure di costo; le catture visuali usano invece il settle e l’attesa dei checkpoint esistenti. I dati temporali non sono FPS hardware né stime statistiche di ogni scenario.

I test tracks verificano limite di velocità, arrivo al brano 07, attraversamento delle stazioni intermedie, snap, swipe verticale/orizzontale, movimento della camera aprendo il brano e viaggio con reduced motion (0.73 s simulati). Usano lo script esistente, con scala .6 e viewport 640×360. I suoi settle usano una scadenza wall-clock con catch: il movimento camera di 16.58 m misurato dal test può includere assestamento dell’orbita, e non va presentato come misura isolata del solo focus. Touch è emulato, non un test Safari/iPad.

Nessun percorso/asset di produzione è cambiato: il nuovo export /sito-hood/ non è richiesto dal prompt 02. Non sono rieseguiti in questa task l’E2E completo, ROOM, video, Easter egg, rooftop o DUALISMO; restano nel gate finale del backlog. La verifica delle bounding sphere comprende l’ampiezza massima delle deformazioni narrative, non un nuovo giro visivo completo di tutti quegli ambienti.

Un riavvio della sessione ha interrotto la prima cattura mobile dopo due frame; il tentativo è conservato e il tier è stato rieseguito integralmente. Gli altri tentativi di setup sono descritti in README.md e attempts/. Nessun campione temporale valido è stato scartato.

Integrità finale: [integrity.json](integrity.json). Git diff --check eseguito prima del commit; nessuna modifica a public/, data/, lib/ o effects/. Commit e stato della PR sono verificati nella consegna GitHub, senza merge o deploy automatici.
