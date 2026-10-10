# HOODDINO × ALTERCO — V3.8 / task 11

Graffiti e indicazioni ricollocati su superfici libere, staffe ALTERCO fuori dalla faccia stampata, scritta leggibile anche sul retro e tazza completamente rimossa dalla pianola. La workstation, i contenuti autentici e l’architettura restano conservati. Questo è un intervento di collocazione: non completa il target fotografico della V3.8.

## Git e configurazione

- Baseline: main `e3456eb50a010dc66b85b5af5710e8f1cd2f6138`, merge della V3.7 PR #7; remoto ricontrollato prima della pubblicazione.
- Branch: `work/hooddino-v3-8-11-graffiti-signage-studio-cleanup`, creato dalla main remota, senza modificarla.
- [PR della task 11](https://github.com/BoninaBID2527/sito-hood/pulls?q=is%3Apr+head%3Awork%2Fhooddino-v3-8-11-graffiti-signage-studio-cleanup): SHA finale nell’head della PR; il file di pubblicazione consegnato separatamente registra commit e URL esatti.
- [Baseline 01, PR #8](https://github.com/BoninaBID2527/sito-hood/pull/8) è un dossier separato; i suoi file non vengono duplicati in questa task.
- Build baseline `yNPi2rx1AkSckb7VkOFgI`; build finale in [results.json](results.json). I digest dei cinque componenti e due fixture e del fixture geometrico sono in [source.json](source.json) e [geometry-fixture.json](geometry-fixture.json).
- Chromium 151, Linux, SwiftShader; quota 2 CPU / 8 GiB. Nessun dispositivo reale testato, nessun FPS hardware dichiarato.

## Implementazione

**Strada e piazza.** Conservati tutti i 73 placement attivi e i loro contenuti; 62 cambiano coordinate/scala. Le impronte ruotate escludono aperture, bordi tra segmenti, piers e service hardware. Carta e overpaint si muovono insieme. Il fixture esegue layout/math/plazaLayout reali, registra la ferramenta stradale e 246 ingombri reali della piazza (base course, griglie, cabinet, riser e tubi) e ricostruisce i bounds della facciata; usa un envelope conservativo per i gas-run. Un audit è una prova geometrica sui bounds indicati, non un voto fotografico.

Spray a 3 mm dal supporto, poster a 7–19 mm in base allo strato, overpaint a 20 mm. Non vengono cambiati depthTest/renderOrder per mostrare pittura attraverso strutture. Nessuna struttura è resa trasparente o cancellata per nascondere il problema.

**Insegne.** ALTERCO conserva plane, texture e materiale: due staffe corte si collegano al retro/bordo. Il retro inverte soltanto il campionamento UV di colore ed emissione per evitare testo specchiato; nessun nuovo quad, materiale o texture. È una variante shader dedicata, non un aumento dei passaggi di rendering. TRACKS e ROOF occupano le baie libere z −69.4/y 1.5 e z −67.3/y 1.4. OneWay viene spostata da z −10.5/y 2.5, sopra una griglia, a z −9.8/y 2.0, sul supporto libero accanto, con contatto a 6 mm. Tutte e tre le indicazioni a parete hanno un audit di supporto separato.

**Indizi.** Lettere 2/3/5 su muratura libera; stesso gruppo per pittura e hit area. Tutte e sette conservano identità e meccanica. Il test eggs segue il nuovo punto della lettera 2; nessuna asserzione viene rimossa. Picking e touch usano input reali, non chiamate a foundLetter.

**Tetto.** Stencil HOODDINO all’interno del bulkhead; antenna ricollocata per liberare l’artwork ufficiale. Beacon e mast condividono le coordinate, mantenendo i sette warning lights e il comportamento Easter egg.

**ROOM.** Titolo della bio sotto il tubo rosso e fuori dal ritratto, con lo stesso contenuto/aspect. Sei mark/poster secondari fuori da assorbitori e conduit. Eliminati corpo lathe e manico tube della tazza dal batch alla costruzione: non viene spostata/nascosta. Non esiste un occluder AO dedicato da rimuovere (`ao:0`). La funzione keyboard è identica alla baseline (digest in [preservation.json](preservation.json)); monitor, lampada, fogli, cuffie e cablaggi restano presenti.

Elenco ID, coordinate, classificazioni e vincoli per le task successive: [CASE-AUDIT.md](CASE-AUDIT.md), [placement-changes.json](placement-changes.json), [letter-changes.json](letter-changes.json).

## Evidenza visiva

Aprire [index.html](index.html) per il confronto navigabile (direttamente dalla copia scaricata o tramite un server statico locale). Viewer verificato su localhost, con richieste esterne bloccate: selettore, avanti/indietro, slider e tutte le 29 immagini della gallery passati. Il browser gestito impedisce file://; non sono state modificate le sue policy. [viewer-validation.json](viewer-validation.json).

- 72 coppie normali: 54 viste principali + 9 close-up di supporto + 2 close-up ONE WAY + 7 controlli ROOM, includendo i checkpoint 1–8 e 41–49.
- 5 coppie supplementari high; totale 77 confronti freschi della main sorgente e della candidata.
- 24 viste finali della piazza: inward/outward 0/45/90/135/180/225/270/315°, fondo lontano e tutte le sette pose track. Sono evidenza **DOPO**, non coppie con una baseline fresca della rotazione.
- 5 controlli DOPO senza bloom/grain/vignette: insegna, pianola, headline, bulkhead e lettera spostata. Fog invariata, come nella baseline; non si dichiara un render senza fog.

Normal: UI nascosta, 800×450, DSF 1, balanced, scala interna 0.6, masonry 1280. High supplementare: 960×540, high, scala 0.75, masonry 1536. Stesse impostazioni nella coppia. Le camere di ispezione hanno coordinate esatte; le pose narrative mantengono il respiro della camera. Gli scarti effettivi sono registrati in [pairs.json](pairs.json), non nascosti sotto la dicitura “pixel-identici”. Le animazioni, i riflessi e le particelle non sono sincronizzati temporalmente.

Il checkpoint video 45 viene ripetuto su entrambe le build con la stessa camera di ispezione fissa. Il runner ereditato chiudeva il focus dopo lo screenshot: il metadata letto successivamente descriveva già l'uscita dal video (76 mm di scarto sull'asse x e tempo video azzerato). Il fixture ora registra lo stato mentre il frame ripreso è ancora in riproduzione, prima di closeFocus. Gli originali restano sotto attempts/; [video-camera-recapture.json](video-camera-recapture.json) e [video-camera-recapture.log](video-camera-recapture.log) registrano la correzione, senza modificare codice prodotto o asserzioni dei test funzionali. Il viewer indica la distanza spaziale tra le camere; il JSON registra anche il massimo scarto per asse, per componente del quaternion e del FOV. Nei checkpoint narrativi 41/50 i residui del FOV sono 0.00452°/0.00929°: errore di scala al bordo inferiore a 0.1 pixel. Il validator misura questo errore ottico anziché richiedere uguaglianza float; le camere di ispezione mantengono invece lo stesso FOV richiesto e lo stesso limite ottico sul residuo effettivo. Director conserva una deadband di 0.01° negli aggiornamenti della proiezione, anche con camOverride: questo spiega il piccolo residuo del FOV catturato. Il validator verifica identità del FOV richiesto e deriva il limite dall’effettiva scala del frustum, senza alterare i dati catturati o il codice di performance. I limiti di posizione/quaternion restano invariati; nessuna asserzione funzionale viene rimossa.

Le immagini WebP qualità 94 riducono soltanto il payload QA. I digest dei PNG originali, copiati fuori dal checkout, e dei WebP sono registrati nei manifest. Nessun asset artista/prodotto è trasformato. La sequenza DOPO controlla per prime le pareti della piazza e i close-up critici; non usa lo stesso itinerario di allocazioni della sessione principale PRIMA. I tentativi interrotti sono conservati sotto attempts/ e nei log; non vengono contati come verifica finale.

Tutti i 183 frame sono stati ispezionati e giudicati con 1–3 cause CG in [FRAME-REVIEW.md](FRAME-REVIEW.md): **A 0 / B 0 / C 183**, con giudizio conservativo. Un placement corretto non rende fotografici materiali e illuminazione. Occlusioni naturali restano presenti. Il paint-over scuro nel tag rosso della ROOM appartiene all’asset originale, non a un oggetto che attraversa il testo.

## Costi e preservazione

La tazza contribuiva 292 triangoli (192 corpo + 100 manico); vengono rimossi senza nuove allocazioni. Nelle prime viste abbinate della workstation si misurano 48,098 → 47,806 triangoli, 16 → 16 draw call. I controlli ROOM freschi seguono lo stesso itinerario prima/dopo e documentano anche texture/geometrie.

Nei sette controlli ROOM 43–49, i draw call sono identici e ogni frame perde esattamente 292 triangoli. Nei sei controlli ordinari i contatori **globali** aumentano di una texture e due geometrie: 112/225 → 113/227 prima del video, 113/225 → 114/227 dopo. La coppia video ricatturata ha invece memoria identica: 114 texture / 227 geometrie in entrambe le build, 15 draw call e 48,096 → 47,804 triangoli; posizione e quaternion coincidono, errore ottico al bordo 0.061 pixel. L’incremento dei sei controlli ordinari è un costo registrato, non viene omesso dal report né descritto come memoria identica. Il codice non introduce texture o geometrie nuove e conserva gli stessi batch/materiali; le ricollocazioni cambiano la visibilità delle risorse esistenti lungo l'approccio. Non è una misura isolata della memoria della sola ROOM.

I conteggi per coppia sono in [cost-comparison.json](cost-comparison.json). Sono campioni del frame: la cadenza di refresh delle riflessioni può raddoppiare il lavoro registrato. Il lungo sweep DOPO della piazza carica oggetti che l’itinerario principale PRIMA non aveva caricato: le differenze di memoria di quelle due sessioni non costituiscono una misura comparabile di allocazioni nuove. Si usano i controlli ROOM e high con itinerario equivalente per la comparazione diretta. Nessuna stima di FPS o frame cost GPU è ricavata da questi numeri.

Tutti gli otto file della foundation di performance sono identici alla main sorgente; anche public/ e data/ restano invariati. Shared texture e materiali conservano il lifecycle originale; nessun nuovo render target/video allocation. [preservation.json](preservation.json).

## Verifiche e limiti

Risultati finali e comandi in [results.json](results.json); dettagli e assertion count in [TESTS.md](TESTS.md). Build/typecheck e support audit passati; 12 fasi finali passate e 139 assertion funzionali riuscite, 0 fallite: street journey, ROOM desktop con uscita/rientro e lifecycle video, Easter egg/secrets, track e click/tap degli indizi. Nessun errore o warning applicativo nelle catture; nessun riflesso con radiance non finita.

Il video del test è un WebM ricodificato dal medesimo MP4 esistente, servito solo al browser di QA: non sostituisce l’asset produttivo. Il filmato impacchettato mostra la performance all’aperto, non la registrazione studio/arrangiamento richiesta: discrepanza già nota, da risolvere con il file autentico nella task 09. Nessun filmato viene inventato.

Asset e percorsi non cambiano, quindi questa task non ripete il gate export /sito-hood/. Regressione completa, export e dispositivi reali restano parte del gate 10 sulla versione integrata. Touch qui significa Chromium emulato, non Safari/iPad/iPhone. La foundation non viene bypassata per rendere i test più veloci; i parametri scale= sono il debug esistente.

Strada filmata: **NO**. ROOM come fotografia di uno studio reale: **NO**. Restano ripetizione delle superfici, risposta dei materiali e luce indiretta semplificata, oltre allo stile narrativo della piazza. Nelle viste di rotazione controllate la piazza continua fisicamente; non viene aggiunto fog o buio per coprire vuoti. Questa PR non pretende di completare il target fotografico: il passo successivo è la task 02 dell’ordine concordato.

Non è stato eseguito merge o deploy; il sito pubblico cambia solo dopo la revisione e una richiesta esplicita del proprietario.
