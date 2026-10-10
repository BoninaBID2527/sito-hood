# Riprodurre la baseline task 01

Eseguire dalla root del repository sul branch della PR baseline, che include questi runner e il codice applicativo identico a `e3456eb50a010dc66b85b5af5710e8f1cd2f6138`, con le dipendenze del lockfile. Verificare quella corrispondenza prima di etichettare una nuova build come riproduzione della baseline; checkout del solo vecchio SHA non contiene i nuovi runner del dossier. Il runner `qa37` è riutilizzato; `census.mjs` adatta il census37 nel solo dossier QA; **questi risultati misurano la main V3.7 come baseline della V3.8**, non la V3.6.

```sh
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

Lasciare il server attivo. Leggere `.next/BUILD_ID` e registrare SHA, browser e limiti CPU/memoria. Una nuova build ha un ID diverso: non riutilizzare manifest di un'altra build. Usare una directory vuota per una riproduzione, conservando la baseline originale.

## Catture selettive

```sh
CHROME=/usr/bin/chromium PORT=3000 EXTRA='&scale=0.75' REQUIRE_FINITE_REFLECTIONS=1 \
  node scripts/qa37.mjs qa/v38/baseline-reproduction/images 960x540 high \
  1,2,4,6,8,10,23,27,35,37,41,43,46,48,54,55,56,57,59
```

19 frame nuovi, UI nascosta, post narrativo normale, DSF 1, nessuna emulazione touch. Il runner aspetta l'upgrade della muratura a 1280 px nei tier appropriati, registra camera/quaternion/FOV, tier/scale/texture e controlla la finitezza dei target riflessi. I controlli di camera e il percorso sono in `scripts/qa37-lib.mjs` e `scripts/qa36-lib.mjs`; alcune viste usano la camera di ispezione, non una nuova posa narrativa del prodotto.

Non aspettarsi immagini pixel-identiche: particelle, animazioni e istante di cattura cambiano. Non interpretare una differenza del rumore/post come modifica del codice. Nessun video viene riprodotto dalla selezione.

## Costo corrente

Eseguire dopo aver chiuso il browser delle catture. Nessun altro browser/suite o build deve contendere CPU durante il campionamento.

```sh
SOURCE_SHA=e3456eb50a010dc66b85b5af5710e8f1cd2f6138 WARM_FRAMES=40 SAMPLE_FRAMES=20 OBSERVE_DISTINCT_FRAMES=1 REQUIRE_FINITE_REFLECTIONS=1 \
  node qa/v38/baseline/census.mjs 3000 qa/v38/baseline-reproduction/performance.json balanced 640x360
```

9 viste: opening/deep street, plaza front/rear, tracks idle/moving, roof, ROOM, DUALISMO. Scala interna fissata a 0.6. Il canvas/drawing buffer è 640×360; non va confuso con la risoluzione interna del pass al render scale indicato. Il runner aspetta i frame con tempo runtime distinto e conserva tutti i 20 intervalli in ordine cronologico, con progresso e conteggi di ogni frame. Calcola la mediana su una copia dei valori. Il controllo dei riflessi avviene fuori dal campionamento. Per tracks-moving riscalda la vista iniziale ferma, poi aggiorna progressivamente il target da .41 a .595 durante i campioni; verifica movimento misurato >.01 e almeno metà degli intervalli con cambiamento di progresso. Non modifica renderer, timestep o controller adattivo. Il runner registra il build ID e la HEAD corrente (SOURCE_SHA può specificare la fonte della build quando la HEAD aggiunge sola documentazione); per confronti su candidate diverse aggiornare esplicitamente SHA/build e configurazione del dossier, senza ereditare riferimenti storici.

Sono intervalli wall-clock RAF di Chromium/SwiftShader, non GPU time né FPS su hardware. Le texture/geometrie sono allocazioni cumulative lungo questo itinerario; non sommarle fra righe né considerarle il costo isolato di un ambiente. Una sola distribuzione baseline non prova uno speedup, una regressione o significatività statistica. Le future task devono confrontare serialmente baseline/candidata con stesso metodo, camera, ordine, tier, scala, texture e hardware.

## Sito pubblico

```sh
node qa/v38/baseline/public-smoke.mjs
```

Usare il networking configurato dell'ambiente. Lo script apre il sito normale, entra, cattura il canvas e verifica richieste/console e disponibilità del MP4 tramite il browser. Non usa debug hook sul sito normale e non configura credenziali alternative. Lo smoke copre soltanto l'apertura e gli asset richiesti: non sostituisce il viaggio completo, la riproduzione nativa del video o il test di Safari/iOS.

## Cosa verificare prima di confrontare una candidata

- SHA/build ID dei due render e assenza di cambiamenti non documentati nel prodotto.
- Viewport, tier, scala, DSF, post/fog e texture upgrade equivalenti.
- Camera/quaternion/FOV e ordine del percorso equivalenti, con transizioni assestate.
- Errori/asset mancanti e riflessi non finiti assenti nei risultati della misura.
- Frame davvero aperti e giudicati; A/B/C assegnati alla candidata, non ereditati.

La regressione completa e lo sweep di 61 frame + no-post/no-fog appartengono alla task 10. Le 19 fasi V3.7 restano evidenza storica sul codice visivo invariato; non sono state rieseguite come gate V3.8 in questa task di baseline.

## Aprire il confronto interattivo

Il browser gestito blocca il protocollo file. Dalla root del repository:

```sh
python -m http.server 3003 --bind 127.0.0.1 --directory qa
```

Aprire `http://127.0.0.1:3003/v38/baseline/compare.html`. Il viewer usa le nuove immagini nel dossier e le 19 coppie storiche in `qa/v37/images/v37/`.
