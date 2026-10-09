# HOODDINO × ALTERCO — V3.8 / task 01 baseline

Baseline completata senza modificare il prodotto. **Il risultato fotografico resta aperto.** Le nuove immagini e misure partono dalla main pubblicata, non dalla V3.6.

## Fonte e pubblicazione verificate

- Main iniziale: `e3456eb50a010dc66b85b5af5710e8f1cd2f6138`; branch `work/hooddino-v3-8-01-baseline`.
- Codice visivo storico: `4a455df52441e2d0b53a748b41f25637586b1062`. Nessun cambiamento successivo in app/components/effects/lib/public, dipendenze o configurazione Next. Cinque runner QA sono stati aggiornati nei commit successivi: elenco in [source.json](provenance/source.json).
- Nuova build di produzione: `yNPi2rx1AkSckb7VkOFgI`; build storica `V_ujN1cRSCwGyuAwb9K6v`. [Build riuscita](logs/build.log).
- [PR #7](https://github.com/BoninaBID2527/sito-hood/pull/7) merged; [GitHub Pages run 37786558091](https://github.com/BoninaBID2527/sito-hood/actions/runs/37786558091) success sullo stesso SHA. Risposte archiviate in [provenance](provenance/).
- [Sito pubblico](https://boninabid2527.github.io/sito-hood/): smoke nuovo PASS, HTTP200, canvas aperto, nessun errore/warning applicativo o richiesta fallita nel controllo completato. 14 risposte image/font/media osservate. [Risultato](public-smoke.json), [screenshot](public-smoke.png).

Le frasi pre-merge nei documenti V3.7 sono storiche. Nessun merge o deploy viene eseguito dalla task 01.

## Nuova baseline visiva

19 frame HERO catturati e realmente ispezionati, UI nascosta, 960×540, high, scala interna 0.75, DSF1, post/fog normali. Nuovi gradi: **A0 / B0 / C19**. La selezione è parziale: non costituisce un nuovo sweep di 61 frame o una nuova certificazione 360°. Il runner registra camere, tier, scale, texture e target riflessi: nessuna radiance non finita nelle catture completate.

[Confronto interattivo storico/nuova baseline](compare.html). Entrambi mostrano lo stesso codice visivo: le differenze temporali di particelle e animazioni non sono modifiche del prodotto. [Manifest con hash e timestamp](manifest.json), [camere e stato runtime](images/manifest.json), [giudizi strutturati](visual-review.json).

| Frame | Grade nuovo | Principali indizi CG osservati |
| --- | :---: | --- |
| [01 — street-opening](images/01-street-opening.png) | C | tiling: Corsi e weathering della muratura restano regolari sulle pareti lunghe; silhouette: Scooter e piccoli fittings hanno sagome semplici, simili a props modellati; post-processing: Particelle e grana restano evidenti nel frame fermo |
| [02 — street-hero-facade](images/02-street-hero-facade.png) | C | tiling: Le chiazze di plaster scrostato ripetono sagome riconoscibili; reflection: Le finestre luminose mostrano pannelli piatti senza profondità interna convincente; construction: Cornici e fittings sono molto regolari; tubi coprono parte del lettering sulla parete |
| [04 — street-window](images/04-street-window.png) | C | reflection: Il vetro appare come un pannello caldo uniforme, con poco ambiente riflesso; tiling: Le isole rosse del plaster esposto ripetono motivi larghi e netti; construction: Davanzale, luce e piccoli elementi mantengono bordi semplici e uniformi |
| [06 — street-wet-asphalt](images/06-street-wet-asphalt.png) | C | wetness: Il pool dorato è molto ampio e liscio rispetto al fondo; nessuna stripe bianca clipped osservata; construction: Cassonetto, scatole e stampe nel frame completo restano geometrie semplici e poco fotografiche; post-processing: Particelle e haze sono riconoscibili come effetti del render |
| [08 — street-deep-alley](images/08-street-deep-alley.png) | C | tiling: Mattoni, finestre e weathering delle pareti lunghe restano ripetitivi; construction: Scatole, bin e fittings sono molto semplici; l’installazione distante mantiene forme grafiche; atmosphere: Haze viola e particelle colorate rendono il frame palesemente stilizzato |
| [10 — plaza-front](images/10-plaza-front.png) | C | construction: Card, lettering staccato e supporti restano una composizione digitale con bordi molto regolari; direct light: Pool magenta/dorati e grandi riflessi leggono come illuminazione teatrale; roughness: La card e il fondo hanno risposta uniforme e grana evidente |
| [23 — plaza-out-180](images/23-plaza-out-180.png) | C | direct light: La fascia luminosa del bridge e gli aloni dei lampioni sono ampi e grafici; indirect light: Pareti basse e soglie del passaggio perdono quasi tutta l’informazione in ombra; silhouette: Il terminale e le sue finestre conservano forme rettangolari molto semplici |
| [27 — plaza-far-ahead](images/27-plaza-far-ahead.png) | C | direct light: Bridge e practical vicini dominano con grandi rettangoli luminosi e aloni uniformi; indirect light: La continuazione costruita è presente, ma i suoi livelli inferiori sono troppo bui e poco differenziati; silhouette: Finestre, parapetti e edificio terminale mantengono sagome regolari e semplificate |
| [35 — roof-wide](images/35-roof-wide.png) | C | construction: Sagome e griglie dei palazzi sono molto regolari; un’antenna passa davanti al billboard nella vista wide, caso da verificare nella task 11; wetness: Il tetto e i suoi pool luminosi hanno gloss esteso e uniforme; direct light: Fixture blu/viola e particelle dominano come effetti teatrali |
| [37 — skyline](images/37-skyline.png) | C | silhouette: Torri vicine e lontane mostrano griglie e spigoli ugualmente netti e ripetuti; atmosphere: La profondità urbana non differenzia abbastanza i piani vicini e lontani; direct light: Lettering parapetto e highlight blu restano molto grafici |
| [41 — room-04-workstation-wide](images/41-room-04-workstation-wide.png) | C | construction: Coni speaker, controlli e appoggi della workstation hanno forme semplici; la tazza è visibile sul controller e va rimossa nella task 11; roughness: Desk e apparecchi hanno highlight larghi e uniformi, con poca separazione dei materiali; indirect light: Il fill è ampio e l’interno sotto il desk perde informazioni |
| [43 — room-06-workstation-close](images/43-room-06-workstation-close.png) | C | reflection: Il monitor portrait manca di riflessi ambientali sottili e profondità del vetro; construction: Piede, cornice e bordo del desk sono molto netti e semplificati; tiling: Legno e variazione della parete ripetono bande/grana regolari |
| [46 — room-09-speaker](images/46-room-09-speaker.png) | C | construction: Cono speaker, cabinet e controlli dell’interfaccia restano forme elementari; roughness: Plastica/metallo e legno hanno risposta uniforme e poco differenziata; tiling: Trattamento acustico e venature dei mobili ripetono pattern regolari |
| [48 — room-11-desk-floor](images/48-room-11-desk-floor.png) | C | indirect light: Sotto il desk i cablaggi e i supporti restano poco separati dallo sfondo scuro; tiling: Tavole del pavimento ripetono venature ampie e molto regolari; construction: Maniglie e supporti hanno bordi uniformi e forme semplici |
| [54 — room-17-ceiling](images/54-room-17-ceiling.png) | C | indirect light: L’underside dell’assorbitore mantiene poca informazione di luce e materiale; tiling: La grana del fabric è uniforme, con variazione molto larga; construction: Pannello, fixture e piccoli supporti sono geometricamente semplici |
| [55 — room-18-floor](images/55-room-18-floor.png) | C | tiling: Il pavimento domina con bande di venatura e tonalità ripetute; construction: Nel frame completo tavolo, sofa, case e workstation mantengono forme semplici da render; roughness: Floor e mobili hanno risposta uniforme con poca variazione locale di usura/contatto |
| [56 — room-19-dark-corner](images/56-room-19-dark-corner.png) | C | construction: Il tubo rosso copre parte di WHO IS: caso concreto per la task 11; titolo, cornice e porta restano molto grafici; indirect light: Passaggio e parete opposta usano un fill ampio con poca variazione locale; tiling: Masonry opposta e tavole del pavimento mostrano pattern regolari |
| [57 — room-20-exit-view](images/57-room-20-exit-view.png) | C | tiling: Muratura opposta e crack della parete mantengono variazione regolare e molto larga; roughness: Il rivestimento imbottito della porta ha highlight rossi molto uniformi, poco simili al tessuto reale; indirect light: Il passaggio e l’esterno mostrano un’illuminazione molto ampia e semplificata |
| [59 — dualism-wide](images/59-dualism-wide.png) | C | reflection: Specchio e framing mantengono riflessi molto puliti e uniformi, con poco comportamento materiale locale; construction: Cornice, lettering e pilastri della composizione impossibile restano palesemente renderizzati; atmosphere: Particelle e fasci viola/blu sono evidenti nel frame fermo anche con artwork ufficiale invariato |

I nuovi frame 06 e 55 sono classificati C, mentre il dossier storico li classificava B. Il giudizio nuovo considera anche props, illuminazione ed effetti visibili nell’intera immagine, oltre alla superficie HERO. È una valutazione più severa, non un cambio del codice o una misura di regressione.

I 176 motivi CG dei 61 frame finali V3.7 sono indicizzati separatamente in [historical-causes.json](historical-causes.json). I 61 finali storici erano A0/B3/C58; i 135 complessivi comprendono baseline V3.6, finali e controlli senza post/fog. Quelle immagini e le 19 fasi funzionali passate restano evidenza storica. Nessun voto storico è presentato come una nuova ispezione della task 01.

## Misure correnti

Nuovo census sulla build indicata, seriale dopo le catture: balanced, 640×360, scala interna 0.6, 40 frame distinti di warmup e 20 campioni per vista. [Campioni e risorse](performance.json), [log](logs/performance.log). Non sono GPU time o FPS hardware. Texture/geometrie sono cumulative lungo il percorso. Intervalli, progresso e conteggi per frame sono conservati in ordine cronologico. Il probe tracks-moving riscalda la vista iniziale ferma, poi guida progressivamente il target durante i campioni e verifica il movimento misurato, senza cambiare il renderer.

| Vista | Mediana wall-clock RAF (ms) | Intervallo min–max (ms) | Draw mediana | Triangoli mediana | Texture | Geometrie |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| opening-street | 1447.2 | 1334.3–1878.8 | 194 | 127472 | 74 | 152 |
| deep-street | 1025.8 | 467.1–1728.3 | 142 | 107836 | 80 | 168 |
| plaza-front | 700.8 | 630.5–969.8 | 159 | 122850 | 83 | 191 |
| plaza-rear | 608.1 | 153.9–1168.4 | 104 | 111886 | 84 | 195 |
| tracks-idle | 693.9 | 632.7–864.8 | 159 | 122850 | 84 | 195 |
| rooftop | 472.1 | 39.1–1235.2 | 69 | 8004 | 88 | 232 |
| ROOM | 613.0 | 13.6–1815.3 | 16 | 48098 | 118 | 272 |
| DUALISMO | 264.8 | 20.3–487.1 | 41 | 22362 | 123 | 295 |
| tracks-moving | 819.7 | 615.3–1480.7 | 164 | 122850 | 123 | 295 |

Il confronto storico V3.6→V3.7 registrava plaza front +6.8% e rear +31.3%: motivo concreto per la task 02, senza confonderlo con una nuova regressione. ROOM iniziale +6.9%. Rooftop discordante (+51.1% breve, −30.4% lungo): nessun verdetto stabile. Le future task confronteranno la propria main iniziale con la candidata usando lo stesso protocollo, senza calcolare percentuali da campioni/configurazioni incompatibili.

## Backlog ordinato

P1 = prossimo lavoro ad alto impatto; P2 = successivo. Il costo probabile è una valutazione qualitativa, non una promessa di tempo o di GPU budget. [Backlog completo JSON](backlog.json) include cause, file, immagini nuove/storiche, criteri e limiti.

### B01 — ROOM / tazza / prompt 11 / P1

**Stato:** Da implementare.

Tazza separata presente nel gruppo deskObjects e sovrapposta all’ingombro del controller: coordinate x=-0.3, z=-7.98; controller x=0, z=-7.92, corpo 1.0×0.3 m. La tazza parte dal piano del desk, non dal corpo del controller. Segnalazione del proprietario, corroborata dall’ingombro nel codice; catturare anche un close mirato prima della correzione. Nuovo frame 41: tazza visibile sopra la zona del controller. La base parte da y=0.77, dentro il corpo del controller che arriva a y=0.81; l’ingombro x/z ricade nel corpo. Il close 43 riguarda il monitor e non sostituisce il close dedicato alla tazza richiesto alla task 11.

**Chiusura:** Corpo e manico rimossi alla costruzione del batch; nessuna ombra residua; pianola e tutti i tasti intatti in close/front/side e dopo uscita/rientro.

**Costo probabile:** Basso: rimozione di geometria; draw e risorse non devono aumentare.

**Evidenza:** [41-room-04-workstation-wide](images/41-room-04-workstation-wide.png), [43-room-06-workstation-close](images/43-room-06-workstation-close.png), [46-room-09-speaker](images/46-room-09-speaker.png)

### B02 — Graffiti e insegne / percorso completo / prompt 11 / P1

**Stato:** Candidati osservati; audit geometrico mirato nella task11.

Il proprietario segnala graffiti sotto strutture e insegne attraversate da oggetti. LAYOUT e Signs usano placement separati dall’architettura. La causa e i singoli ID richiedono un audit mirato: i frame HERO non bastano a certificare tutti i casi. Nelle nuove catture 01/02 il lettering è parzialmente coperto da tubi e nel frame 35 un’antenna si proietta davanti al billboard: candidati da controllare anche lateralmente per distinguere occlusione da compenetrazione. Il nuovo frame 56 mostra il tubo rosso davanti a parte del titolo WHO IS nello studio: correggere la leggibilità rispettando il contenuto autentico e il montaggio fisico.

**Chiusura:** Inventario ID/coordinate con prima/dopo; graffiti su supporti continui, insegne con staffe e distanze corrette; nessuna compenetrazione impropria nelle viste front/side/radenti. Contenuto, picking ed Easter egg conservati.

**Costo probabile:** Basso se riposizionamento; medio se serve clipping condiviso. Nessuna cancellazione indiscriminata o depthTest disattivato.

**Evidenza:** [01-street-opening](images/01-street-opening.png), [02-street-hero-facade](images/02-street-hero-facade.png), [04-street-window](images/04-street-window.png), [08-street-deep-alley](images/08-street-deep-alley.png), [10-plaza-front](images/10-plaza-front.png), [23-plaza-out-180](images/23-plaza-out-180.png), [27-plaza-far-ahead](images/27-plaza-far-ahead.png), [35-roof-wide](images/35-roof-wide.png), [37-skyline](images/37-skyline.png), [56-room-19-dark-corner](images/56-room-19-dark-corner.png)

### B03 — PLAZA / costo retro / prompt 02 / P1

**Stato:** Da implementare.

Il confronto storico controllato V3.6→V3.7 misura +31.3% sul retro e +6.8% sul fronte. Sono dati storici: la baseline operativa è la nuova misura e3456eb, senza presumere una regressione ulteriore.

**Chiusura:** Confronto seriale sulla main iniziale, con stessi tier/scale/texture/camera e campioni grezzi. Riduzione del costo spiegata per pass/superfici; nessun vuoto nelle 16 direzioni e sette pose, nessuna perdita HERO.

**Costo probabile:** Medio: richiede profiling, batching/LOD/culling o riduzione del lavoro shader lontano.

**Evidenza:** [10-plaza-front](images/10-plaza-front.png), [23-plaza-out-180](images/23-plaza-out-180.png), [27-plaza-far-ahead](images/27-plaza-far-ahead.png)

### B04 — ROOM / workstation / prompt 03 / P1

**Stato:** Da implementare.

Speaker, controlli, supporti e bordi restano semplici nei close-up; i materiali degli apparecchi reagiscono troppo uniformemente.

**Chiusura:** Supporti e contatti leggibili, coni/griglie e controlli plausibili nei close; separazione di legno, plastica, metallo, gomma e tessuto. Rimozione tazza preservata. Gradi assegnati dopo nuova ispezione; B è progresso, A resta il target HERO.

**Costo probabile:** Medio: geometria mirata e mappe condivise; misurare ROOM, senza moltiplicare dettagli nascosti.

**Evidenza:** [41-room-04-workstation-wide](images/41-room-04-workstation-wide.png), [43-room-06-workstation-close](images/43-room-06-workstation-close.png), [46-room-09-speaker](images/46-room-09-speaker.png), [48-room-11-desk-floor](images/48-room-11-desk-floor.png)

### B05 — ROOM / schermo e materiali vicini / prompt 03 / P1

**Stato:** Da implementare.

Vetro del monitor, cornice e legno/fabric vicini hanno riflessi deboli o uniformi; grana e usura restano regolari.

**Chiusura:** Vetro con riflesso sobrio e black level; materiali distinguibili anche senza post; nessuna perdita delle immagini autentiche o double gamma.

**Costo probabile:** Medio: risposta materiale e filtering; nessun nuovo reflection target obbligatorio.

**Evidenza:** [43-room-06-workstation-close](images/43-room-06-workstation-close.png), [46-room-09-speaker](images/46-room-09-speaker.png)

### B06 — ROOM / luce sotto desk e assorbitori / prompt 04 / P1

**Stato:** Da implementare.

Sotto il desk e gli assorbitori si perde informazione; il fill per vertice resta spazialmente ampio e non restituisce un bounce convincente.

**Chiusura:** Cablaggi, supporti e fabric underside leggibili senza ambient uniforme; fonti motivate da fixture/monitor/porta, contact preservato; sweep completo della stanza.

**Costo probabile:** Medio: concentrare campionamento nei punti visibili; evitare GI brute-force e campi al fragment su tutta la stanza.

**Evidenza:** [41-room-04-workstation-wide](images/41-room-04-workstation-wide.png), [48-room-11-desk-floor](images/48-room-11-desk-floor.png), [54-room-17-ceiling](images/54-room-17-ceiling.png), [56-room-19-dark-corner](images/56-room-19-dark-corner.png), [57-room-20-exit-view](images/57-room-20-exit-view.png)

### B07 — ROOM / foto e bio integrate / prompt 04 / P2

**Stato:** Aperto, evidenza storica V3.7.

Il dossier storico mostra stampe/bio ancora grafiche e materiali di parete/fabric uniformi. Questi frame non sono ricatturati nella selezione HERO di task 01.

**Chiusura:** Carta/frame/vetro/montaggio e luce credibili; biografia, foto autentiche e link invariati; readability conservata nei tier bassi.

**Costo probabile:** Basso–medio: presentazione fisica e light/material pass, senza nuovi contenuti artista.

**Evidenza:** Nessuna nuova cattura dedicata; vedere evidenza storica/input richiesto.

### B08 — STREET / muratura e plaster / prompt 05 / P1

**Stato:** Da implementare.

Peeling, corsi dei mattoni e weathering ripetono motivi regolari nelle viste vicine e lungo il vicolo.

**Chiusura:** Scala fisica V3.7 mantenuta; macro/meso/micro distinti e usura legata a costruzione/drenaggio; motivi ripetuti meno rilevabili con e senza post. Registrare fonte/licenza di eventuali mappe PBR.

**Costo probabile:** Medio: variazione economica o mappe con mip/compressione; misurare texture payload e costo opening/deep street.

**Evidenza:** [01-street-opening](images/01-street-opening.png), [02-street-hero-facade](images/02-street-hero-facade.png), [04-street-window](images/04-street-window.png), [08-street-deep-alley](images/08-street-deep-alley.png)

### B09 — STREET / vetro e props HERO / prompt 05 / P1

**Stato:** Da implementare.

Finestre/interiori appaiono piatti; scooter e piccoli fittings hanno silhouette semplici.

**Chiusura:** Fresnel, riflesso e profondità interna economica credibili; props visibili sostenuti e proporzionati; non ripetere la stessa finestra né aggiungere clutter casuale.

**Costo probabile:** Medio: geometry/silhouette limitata ai HERO e interior approximation; mantenere fondazione performance.

**Evidenza:** [01-street-opening](images/01-street-opening.png), [02-street-hero-facade](images/02-street-hero-facade.png), [04-street-window](images/04-street-window.png)

### B10 — ASPHALT / variazione e wetness / prompt 05 / P1

**Stato:** Da implementare.

Pool luminosi molto ampi e variazione di aggregate/repairs ancora uniforme, pur con riflessi corretti.

**Chiusura:** Dry/damp/wet/water distinguibili, drenaggio e patches plausibili; niente asfalto a specchio, stripe bianche o non-finite radiance; F0 acqua, mip e horizon fix preservati.

**Costo probabile:** Medio: materiali e maschere; riusare targets/cadenza, non aumentare indiscriminatamente refresh.

**Evidenza:** [06-street-wet-asphalt](images/06-street-wet-asphalt.png), [08-street-deep-alley](images/08-street-deep-alley.png)

### B11 — PLAZA / track integration / prompt 06 / P1

**Stato:** Da implementare.

Card, lettering e supporti hanno costruzione semplice e roughness uniforme; beam e pool luminosi hanno forme teatrali.

**Chiusura:** Sette brani e artwork invariati; supporti/fissaggi/cavi credibili e materiali distinti; luce motivata e contatto anche sul retro. Nessuna perdita della logica camera/interazione.

**Costo probabile:** Medio: pochi HERO dettagli, shared materials; verificare front/rear e sette pose prima di chiudere.

**Evidenza:** [10-plaza-front](images/10-plaza-front.png)

### B12 — PLAZA / rear e distant passage / prompt 06 / P1

**Stato:** Da implementare.

Passaggio e città esistono, ma edificio terminale, bays e roofline sono regolari; lower walls ricevono fill ampio e pratiche producono grandi highlight.

**Chiusura:** Migliore profondità e distinzione materiale/luce senza cancellare gli strati costruiti; rotazione inward/outward completa e niente fondali vuoti. Ottimizzazioni task 02 mantenute.

**Costo probabile:** Medio: MIDGROUND/BACKGROUND hierarchy; evitare dettaglio massimo in lontananza.

**Evidenza:** [23-plaza-out-180](images/23-plaza-out-180.png), [27-plaza-far-ahead](images/27-plaza-far-ahead.png)

### B13 — ROOF / SKYLINE / prompt 07 / P2

**Stato:** Da implementare.

Tetto e città mostrano gloss uniforme, griglie ripetute e sagome ugualmente nette. Le misure storiche rooftop sono discordanti: nessun verdetto stabile di costo.

**Chiusura:** Coating/seams/wetness plausibili e skyline near/mid/far con profondità coerente; confronti di costo spiegati, senza reclamare un miglioramento da un solo campione.

**Costo probabile:** Medio: variazione condivisa e atmospheric integration; real geometry solo sui rooftop HERO.

**Evidenza:** [35-roof-wide](images/35-roof-wide.png), [37-skyline](images/37-skyline.png)

### B14 — DUALISMO / prompt 08 / P2

**Stato:** Da implementare.

Specchio/ossidiana troppo puliti e regolari, installazione luminosa e particles ancora palesemente sintetici.

**Chiusura:** Roughness/Fresnel/iridescenza dipendenti da angolo e luce; reflection/contact più sofisticati mantenendo identità, artwork e leggibilità. Nessuna crescita gratuita della geometria.

**Costo probabile:** Medio: shader/material pass mirato; preservare efficienza V3.6/V3.7.

**Evidenza:** [59-dualism-wide](images/59-dualism-wide.png)

### B15 — ROOM / video autentico / prompt 09 / P1 / input esterno

**Stato:** BLOCCATO: manca fonte autentica prevista.

L’asset MP4 invariato è ripresa all’aperto chitarra/rap, non la registrazione studio/arrangiamento desiderata; hash documentato. Non è un bug del player.

**Chiusura:** Ricevere fonte autentica corretta; nessuna sostituzione inventata; explicit PLAY, lazy loading, proporzioni, decode una sola volta e release conservati. Test decode su Safari solo se davvero eseguito.

**Costo probabile:** Dipende dal payload autentico; transcode/distribuzione pianificati dopo ricezione.

**Evidenza:** Nessuna nuova cattura dedicata; vedere evidenza storica/input richiesto.

### B16 — Tutti / device e regressione / prompt 10 / Gate finale

**Stato:** Aperto; device reali non disponibili nella baseline.

19 fasi V3.7 passate sono prove storiche, non un gate V3.8. SwiftShader e touch emulato non verificano Safari/iPad/iPhone o FPS hardware.

**Chiusura:** Regressione completa sulla main integrata; 61 frame più no-post/no-fog, gradi sinceri, 360° e ROOM sweep; matrice real device con NON VERIFICATO dove mancano dispositivi.

**Costo probabile:** Alto costo di verifica; eseguire il gate completo una volta integrati i lavori, ripetendolo solo per cambiamenti/errori pertinenti.

**Evidenza:** [Selezione HERO nuova](visual-review.json); gate completo ancora da eseguire sulla versione integrata.

## Ordine operativo

**01 → 11 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 10**. Inserire 09 appena disponibile la fonte autentica. Ogni task implementativa parte dalla main aggiornata dopo revisione/integrazione della precedente. Evitare modifiche simultanee agli stessi shader/materiali. Il prompt 11 mantiene il numero aggiunto e precede i lavori su studio/facciate, per non reintrodurre tazza o placement errati.

## Video, completezza e hardware

- Il MP4 packaged, 4.860.666 byte, SHA256 `02def5f45a5b97d770fd995f47193e4ec21865b941366719bebf6d43208d7949`, è invariato e corrisponde al file pubblico verificato per hash. Mostra ripresa all'aperto secondo l'ispezione storica della fonte; manca lo studio/arrangiamento autentico desiderato. **Task 09 bloccata sull'input**, non sul player. Nessuna sostituzione eseguita o inventata.
- Strada filmata: **NO** nei nuovi HERO; ROOM studio fotografato: **NO** nei nuovi HERO. Cause nelle righe dei frame.
- Piazzale completo: **SÌ nelle 16 direzioni e sette pose storicamente verificate** sullo stesso codice; le tre viste ricatturate qui non mostrano fondali vuoti. Non si attribuisce a questa selezione una nuova copertura completa a 360°.
- Nessun nuovo asset artista, testo o contatto. Fondazione V3.5, geometria V3.6/V3.7, navigazione, artwork e player invariati.
- Hardware realmente usato: Linux, Node24.19.0, Chromium151.0.7922.173, SwiftShader, quota2CPU e 8GiB. Nessun Safari/iPad/iPhone, H.264 nativo, sharpness su tablet o GPU FPS verificato. L'ambiente live può avere qualità adattiva diversa dalle catture locali pinning high.

## Verifiche e limiti

Build di produzione, 19 catture con controllo finitezza, census nove viste e smoke pubblico passati. Verifica di integrità degli artefatti: conteggi, SHA/build, hash immagini, gradi, risorse, link locali e scope della diff. Nessuna modifica applicativa: non aggiunti test che rispecchiano l'implementazione e non rieseguita la regressione completa storica. Il gate task 10 dovrà essere eseguito sul codice integrato finale.

I primi smoke sono stati interrotti per controlli QA errati (proprietà runtime inesistente, poi debug hook assente nell'URL pubblico normale). Un tentativo successivo ha fallito sul download MP4 tramite APIRequestContext che non ereditava il percorso proxy. Il runner è stato corretto per usare stato DOM visibile e fetch nel browser, preservando il networking configurato. La nuova prova completata è passata; i precedenti log/limiti sono registrati nel manifest. Il riavvio ambiente147→148 ha poi interrotto il census: la riga parziale opening con stall15.4s/7.8s è conservata come scartata, non mescolata nella baseline accettata ([eventi](infrastructure-events.json)). La stessa build/browser/quota sono stati verificati prima del riavvio seriale. Il census originario era stato interrotto per rafforzare la verifica del movimento: il nuovo runner QA conserva costo e progresso di ogni frame, e il benchmark completato usa quel protocollo. Nessun problema del prodotto è stato nascosto o corretto in questa task.

Il viewer interattivo è stato verificato via HTTP locale: tutte le 19 coppie nuove/storiche caricate, selettore e slider funzionanti, nessun errore di pagina ([log](logs/viewer-validation.log)). Il protocollo file è bloccato dal browser gestito; usare un server HTTP locale per aprire il confronto.

[Protocollo riproducibile](REPRODUCE.md). Questa PR consegna la baseline e il backlog; non dichiara completati i miglioramenti V3.8 e non cambia il sito pubblicato.
