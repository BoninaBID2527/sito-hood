# V3.8 · Task 02 · budget piazza

Baseline: main `b250daf48b2e4a22d9d29038c50e632b9e5db8c5`, dopo i merge delle task 01 e 11. Branch: `work/hooddino-v3-8-02-plaza-performance`. Build baseline `RoS3xkOOK-nRtwDPMdhdT`; build candidata `VCcZnZRV9Se1UpktIzG5y`. Gli SHA-256 dei due file di implementazione identificano esattamente il codice della build verificata in `source.json`; commit finale e URL PR sono registrati nella consegna GitHub.

## Problema e modifica

Gli infissi delle finestre erano una sola InstancedMesh con `frustumCulled=false`: tutte le **554 istanze / 26.592 triangoli** venivano inviate anche guardando nella direzione opposta. Ora sono sette batch legati a zone fisiche: due tratti della strada, quattro facciate della piazza e il passaggio. Ogni camera usa il proprio frustum, comprese le camere secondarie. Tutte le matrici e la geometria originale restano presenti. Non è introdotto un limite di distanza, una LOD o un taglio per tier.

I sette batch condividono la stessa geometria e lo stesso materiale; la memoria degli instanceMatrix resta 554 × 16 × 4 = 35.456 byte complessivi. Aumentano di sei gli oggetti mesh e le descrizioni dei buffer. Il diagnostico post-census pass-comparison.json conferma direttamente i pass: istanze nel main 554 → 231 sul fronte e 554 → 132 sul retro; nelle ombre 554 → 341 in entrambe le pose osservate; nei pass secondari 554 → 231/108. I totali sono per frame in cui il pass viene eseguito, non una modifica della sua frequenza di refresh. Le draw call possono aumentare quando più zone sono visibili: il compromesso è registrato nei dati sotto. Il cleanup esistente chiama dispose su ciascuna mesh e una volta su geometria/materiale condivisi.

Le bounding sphere includono il massimo spostamento locale degli shader (.07 + .35 m), moltiplicato per la scala massima di ogni batch, più .01 m. `batch-validation.json` confronta gli effettivi buffer catturati nei quattro tier: nessuna istanza persa, template e matrici invariati, un solo materiale/geometria per contesto, tutti i vertici alle estremità dello spostamento contenuti nelle sfere. Se cambiano in futuro quei coefficienti o il tipo di trasformazione, occorre aggiornare il margine e rieseguire il controllo.

## Diagnosi precedente all'intervento

Il materiale economico della nuova architettura era già PBR, con sun/sky e bounce dei lampioni installati. La diagnostica sul retro trova 15 mesh background con 15 materiali, tre con bump. Togliere il bump cambia la mediana da 535.8 a 535.1 ms (<0.2%): non dimostra un costo dominante del bump nell'intera vista. Il prototipo di filtro è stato scartato; `backgroundMaterial.ts` è identico alla baseline. `baseline-diagnostic/` conserva inventario, sorgenti shader compilate, disegni osservati e campioni grezzi. La categoria secondaria del diagnostico iniziale usa camera != camera principale, non identifica da sola il tipo del pass. Nella seconda coorte surround-passes.json usa anche onBeforeShadow per distinguere i disegni degli infissi nel pass ombre; questi hook sono attivati soltanto dopo tutti i campioni di costo, quindi non modificano le mediane.

Non cambiano l'architettura posteriore, il passaggio, lo skyline, i materiali, le luci, le texture o i contenuti artistici. Sono identici anche i 16 file elencati in `source.json`, compresa la fondazione di performance, i layout, DistCull e le correzioni della task 11. Non sono aggiunti fog, fondali o post effetti.

## Misure seriali

Chromium 151, ANGLE SwiftShader, Linux con quota CPU 2 core e limite memoria 8 GiB. Viewport 640×360, deviceScaleFactor 1, balanced, scala interna .6. Warmup 20 e campione 24 frame runtime distinti, con intervalli e valori rt.cpuMs grezzi (tempo lato JS del frame, incluso l’invio del rendering) conservati. Main e candidata vengono eseguite serialmente sullo stesso browser server. La strada è misurata prima e dopo il percorso della piazza; tracks-moving usa la reale molla e il rig della camera.

Solo il bootstrap delle texture usa temporaneamente 320×180 dopo l'ingresso normale; la viewport torna 640×360 prima di warmup e misure. Non è cambiato il renderer di produzione. Prima/dopo usano la stessa procedura. Le texture di muratura devono arrivare a 1024/1280/1536/2048 nei rispettivi tier. Ultra mantiene il DPR minimo nativo, quindi il suo drawing buffer non è uguale a quello balanced.

Prima coorte (ms per frame software; non FPS hardware):

| Vista | Baseline ms | Candidata ms | Delta | Draw call | Triangoli inviati |
| --- | ---: | ---: | ---: | --- | --- |
| opening-control | 1390.1 | 1366.7 | -1.68% | 195 → 201 | 127474 → 127474 |
| plaza-front | 672.6 | 636.5 | -5.37% | 159 → 168 | 122850 → 97122 |
| plaza-rear | 571.0 | 520.2 | -8.90% | 104 → 111 | 111886 → 81406 |
| tracks-idle | 689.6 | 662.4 | -3.94% | 159 → 168 | 122850 → 97122 |
| tracks-moving | 792.9 | 778.8 | -1.78% | 221 → 227 | 127748 → 127748 |
| opening-control-repeat | 1384.5 | 1548.5 | +11.85% | 195 → 201 | 127474 → 127474 |

Il ritorno alla strada peggiora del 11.85% nella prima coorte, superando la soglia di indagine della task. È stato conservato, non eliminato come outlier. La sua misura rt.cpuMs mediana resta circa 7.8 → 7.9 ms e i triangoli restano identici; i singoli intervalli mostrano forte variazione. Questi fatti non provano da soli che si tratti soltanto di rumore.

Dopo il riavvio della sessione, il 2026-10-11 è ripetuto lo stesso percorso completo con le due build salvate e un nuovo browser server. I limiti CPU/memoria e il software sono uguali; non si presume identico scheduling fra giornate. La seconda coorte confronta nuovamente baseline e candidata serialmente fra loro, evitando di confrontare una vista fresca con la scena già caricata:

| Vista | Baseline ms | Candidata ms | Delta | Draw call | Triangoli inviati |
| --- | ---: | ---: | ---: | --- | --- |
| opening-control | 1396.3 | 1327.1 | -4.96% | 195 → 201 | 127474 → 127474 |
| plaza-front | 678.4 | 794.8 | +17.16% | 159 → 168 | 122850 → 97122 |
| plaza-rear | 532.1 | 494.4 | -7.09% | 104 → 111 | 111886 → 81406 |
| tracks-idle | 674.7 | 674.5 | -0.03% | 159 → 168 | 122850 → 97122 |
| tracks-moving | 777.0 | 713.8 | -8.13% | 216 → 222 | 150856 → 117300 |
| opening-control-repeat | 1378.6 | 1411.2 | +2.36% | 195 → 201 | 127474 → 127474 |

Il retro migliora in entrambe le coorti (−8.90% e −7.09% di mediana software) con −27.24% di triangoli inviati; il fronte mantiene −20.94% di triangoli ma il costo dei campioni brevi è discordante. Il ritorno alla strada nella seconda coorte è +2.36%, quindi il precedente +11.85% non si ripete oltre la soglia. Non si identifica con certezza la causa dei picchi di scheduling; le draw call aggiuntive sono un compromesso reale. Sul movimento non è stabilito un guadagno causale: le traiettorie native non sono bloccate, e i conteggi/progressi dei singoli frame variano. I valori restano nel dossier senza attribuire ogni differenza al culling.

Il fronte nella seconda coorte peggiora del 17.16%, pur con meno triangoli inviati. Anche questa misura è conservata. È stata perciò aggiunta una coppia mirata con posizione/direzione frontali salvate dalla baseline, camera tenuta tramite il debug esistente, progress .42, warmup20 e 72 frame di campione. Luci, post e qualità restano nativi. Nel controllo lungo la mediana è 676.8 → 644.6 ms (-4.76%), con la stessa camera e rt.cpuMs 9.1 → 7.1 ms. Il +17.16% non si ripete in questa prova. Questo sostiene un miglioramento moderato sul fronte; non dimostra una garanzia per ogni fase temporale o dispositivo. Le differenze restano evidenza software relativa, non FPS hardware.

Texture e geometrie residenti coincidono in tutte le corrispondenti righe. Nella prima coorte crescono durante il viaggio da 74/152 a 85/199, come nella baseline: sono conteggi cumulativi, non conteggi della singola vista. La build contiene 21 file JavaScript come la baseline: 2.561.774 → 2.562.264 byte grezzi complessivi (+490 byte). build-resource-comparison.json registra i conteggi su disco; non sono dimensioni di trasferimento né una misura di startup. Non è misurato il costo di caricamento su rete mobile; non sono introdotti asset o texture nuove. Un hash di chunk cambiato può comunque richiedere il download di quel chunk intero.

## Evidenza visiva

`index.html` contiene 29 confronti prima/dopo navigabili con slider, più gli altri tier e il diagnostico. `pairs.json` registra posizione, orientamento e FOV delle camere: confronto geometrico entro .04 m e .1 grado, deriva del bordo dovuta al FOV < .1 pixel. La scena animata non ha la stessa fase temporale, quindi differenze di particelle e luci dinamiche non rappresentano da sole una regressione.

Prima/dopo balanced e candidata mobile: 8 rotazioni inward + 8 outward (0/45/90/135/180/225/270/315), fronte, passaggio distante, tutte le sette pose reali dei brani, controllo strada e dettaglio serranda. High/ultra: le stesse 16 rotazioni, fronte, passaggio distante, strada e serranda; le sette pose dei brani non sono ricatturate in quei due tier. Un dettaglio di cornice attorno a un vano scuro reale è aggiunto in balanced prima/dopo e un dettaglio high della serranda completa il confronto.

Sono stati realmente ispezionati 125 frame: A0/B0/C125. Le superfici conservano i limiti visivi della baseline: regolarità della muratura, illuminazione ampia/sintetica, particelle ed elementi grafici dell'installazione. La task riduce il lavoro invisibile; non rivendica il raggiungimento del fotorealismo. Nessun vuoto architettonico nuovo è osservato nelle direzioni catturate. Questo non sostituisce una prova hardware su ogni camera intermedia.

`FRAME-REVIEW.md` / `frame-review.json` elencano 1–3 cause per ogni frame. Le WebP sono derivate dai PNG reali (quality94); SHA originali e derivati sono registrati nelle righe. I PNG originali restano fuori Git nella workspace, senza generare immagini sostitutive.

## Test e limiti

Vedi `TESTS.md` per i risultati effettivi: build/typecheck, census seriale, reflection-health, buffer reali e deformazioni in tutti i tier, interazioni tracks e reduced motion, confronto camere, integrità artefatti e viewer. Non sono rieseguiti tutti i test ROOM/DUALISMO o il gate completo di task 10. Nessun percorso o asset cambia, quindi non è richiesto un nuovo export da questa task; l'export finale /sito-hood/ resta nel gate previsto dal backlog.

Nessuna misura Safari/iPad/iPhone o GPU reale. Touch nel test tracks è emulato. Una coorte e il suo controllo successivo non costituiscono una stima statistica di tutti i dispositivi. La task non modifica la main e non pubblica automaticamente una nuova versione del sito.

## Riproduzione e tentativi conservati

`probe.mjs` accetta porta, cartella risultati, builddir, tier e mode (cost/visual/diagnostic). `SOURCE_SHA` identifica la baseline; `BROWSER_WS_ENDPOINT` permette il browser server isolato in `browser-server.mjs`. `run.mjs`, `extra.mjs`, `recheck.mjs` e `resume.mjs` registrano i comandi e l'ordine effettivamente eseguiti in questa workspace; i percorsi vanno adattati per una nuova macchina. Occorrono due build fresche in checkout separati. Non eseguire contemporaneamente altri test GPU. `validate-batches.mjs`, `package.py` e `viewer.py` controllano e confezionano il dossier.

`attempts/` conserva tre tentativi di setup senza campioni validi, più una cattura mobile interrotta dal riavvio della sessione dopo due frame (conservata e rieseguita integralmente): accesso userData su array materiali, bootstrap lento, bottone di ingresso fuori viewport. Correzioni ai fixture: predicate optional corretto; ingresso alla dimensione normale seguito dal solo bootstrap ridotto. Il checkpoint 91 era erroneamente chiamato rear-masonry-close ma inquadra una serranda: rinominato senza cambiare la camera, con originalFixtureName nei risultati baseline. Il checkpoint 92 usa una finestra reale [-8.2,6.2,-118] per controllare l'elemento modificato. Non sono indebolite asserzioni del prodotto né scartati dati di costo validi.

La verifica di integrità ha richiesto una correzione al fixture: il link al manifest era controllato prima di creare il manifest stesso. La sequenza è stata corretta; ogni link resta obbligato a esistere. Il tentativo è conservato in attempts/integrity-self-link.json.
