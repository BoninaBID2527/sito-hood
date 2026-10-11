HOODDINO × ALTERCO — V3.8 / TASK 02
COSTO DEL RETRO PIAZZA E BUDGET

Leggi tutto il prompt prima di modificare codice.

CONTESTO E REGOLE COMUNI
Repository: BoninaBID2527/sito-hood.
Sito: https://boninabid2527.github.io/sito-hood/
V3.7 pubblicata tramite PR #7, merge e3456eb50a010dc66b85b5af5710e8f1cd2f6138.
La V3.7 ha 19 fasi di verifica passate, ma il risultato fotografico non è raggiunto: sui 61 frame normali A0/B3/C58. La piazza è costruita nelle rotazioni e pose verificate. ROOM e strada restano priorità HERO.

1. Leggi AGENTS.md e i documenti Next.js richiesti. Ispeziona git status, branch, main remoto e commit recenti. Parti dalla main più recente, che deve contenere il merge V3.7 e3456eb come antenato. Usa un branch nuovo con il nome indicato sotto. Non sovrascrivere modifiche dell'utente. Se lo stato Git non corrisponde, descrivi esattamente la discrepanza prima di implementare.
2. Leggi qa/v37/REPORT.md, FRAME-REVIEW.md, TESTS.md e i risultati pertinenti. Questi documentano la candidata verificata e la sua pubblicazione prima del successivo merge: lo stato corrente della PR va verificato su GitHub. Non trattare le loro vecchie diciture sulla bozza come un blocco attuale.
3. Conserva render scale interno, controller adattivo, cambi scala senza riallocazione, MSAA per densità, ottimizzazione depth resolve, rumore shader baked, sky overdraw, HUD e quality tier. File fondamentali: lib/runtime.ts, lib/quality.ts, lib/adaptive.ts, components/scene/PerfGovernor.tsx, components/ui/PerfHud.tsx, effects/SkyDome.tsx, effects/Atmosphere.tsx ed effects/PostFX.tsx. Non bypassarli per ottenere una misura migliore.
4. Preserva navigazione, sette brani, artwork ufficiali, biografia, foto autentiche, link reali, Easter egg e accessibilità. Non inventare foto, identità, testi, crediti, preview musicali o contatti. Modifica solo lo scope di questa task.
5. Giudica frame realmente catturati, a UI nascosta: A plausibilmente fotografico; B vicino ma CG riconoscibile; C chiaramente CG. Registra 1–3 cause per frame. Un test passato non è un voto A. Non aumentare post, foschia o oscurità per nascondere difetti.
6. Confronta prima/dopo con camera, viewport, tier, scala e texture equivalenti. La baseline operativa è la main all'inizio di questa task, non automaticamente la vecchia V3.6. Registra SHA, configurazione, hardware e metodo. Headless/SwiftShader è evidenza relativa; touch emulato non prova Safari/iPad/iPhone o GPU FPS.
7. Usa catture e test mirati durante il lavoro. Esegui la regressione completa nel gate finale o quando tocchi sistemi condivisi che la richiedono. Non indebolire asserzioni; conserva tentativi falliti e motivazione delle correzioni ai fixture. I checkpoint e gli script esistenti sono riutilizzabili, ma i nomi V36/V37 delle vecchie misure vanno aggiornati per descrivere la baseline reale.
8. Mantieni la gestione delle risorse: geometrie/materiali propri rilasciati, texture condivise non eliminate per errore, video lazy e rilasciato all'uscita. Esegui export /sito-hood/ in un checkout/worktree separato: in questa versione Next sostituisce anche i manifest della build normale. L'export usa .next-export, non presumere out/.
9. Implementa la task, verifica, documenta e crea una PR nuova contro main. Non fare merge o deploy automaticamente: il proprietario li richiederà dopo la revisione. Non terminare con sole raccomandazioni al posto del lavoro richiesto. Riporta onestamente ciò che resta irrisolto.

BRANCH
work/hooddino-v3-8-02-plaza-performance

OBIETTIVO
Ridurre il costo della nuova architettura posteriore senza perdere la continuità della piazza a 360° o peggiorare le superfici HERO.

DIPENDENZE
Dopo 01; consigliata prima di aggiungere altri dettagli.

IMPLEMENTAZIONE RICHIESTA
- Riproduci il costo della main corrente in plaza front/rear, tracks idle/moving e in una vista di controllo fuori piazza.
- Ispeziona components/scene/street/backgroundMaterial.ts, PlazaArch.tsx, plazaArch.ts, plazaLayout.ts, DistCull.tsx e l'uso di materiali/istanze/luci. Conferma quali pass e quali superfici causano il costo: non dedurlo dal solo numero di triangoli.
- Valuta batching/instancing, frustum/distance culling, LOD e lavoro shader per superfici lontane. Conserva il percorso PBR economico già introdotto, il contributo sun/sky e l'irradianza motivata dai lampioni installati.
- Riduci prima dettaglio invisibile, pass secondari e lavoro duplicato. La geometria necessaria a rear walls, passage e skyline deve restare presente in ogni tier.
- Conserva riflessi finiti, mip corretti, orizzonte e comportamento adattivo. Non sostituire architettura con fog, piani neri o fondali luminosi.
- Confronta baseline e candidata nello stesso ambiente, serialmente. Se i dati discordano o una vista peggiora, esegui solo il controllo mirato necessario a spiegare il risultato.

EVIDENZA VISIVA
Rotazioni inward/outward 0/45/90/135/180/225/270/315°, passaggio distante e sette pose dei brani. Evidenza prima/dopo e campioni di costo, non solo screenshot frontali.

VERIFICHE
Census mirato, reflection-health, interazioni tracks se toccate, build/typecheck ed export se cambiano i percorsi. Registra draw call, triangoli, texture/geometrie e costo relativo; i conteggi lungo il viaggio sono cumulativi.

CRITERIO DI COMPLETAMENTO
Il costo è ridotto con prove comparabili oppure il risultato residuo è spiegato con precisione. Nessuna vista/tier scopre un vuoto. Una soglia +10% rispetto alla baseline di task è motivo di indagine, non una prova statistica automatica né un permesso di abbassare la qualità HERO.

REPORT DI CONSEGNA
Source SHA e baseline; branch/final commit/PR URL; cosa hai implementato e perché; prima/dopo realmente ispezionato; costi e configurazioni; test eseguiti con risultati; limiti e requisiti non raggiunti. Conserva separati fatti verificati, ipotesi e prove hardware mancanti.
