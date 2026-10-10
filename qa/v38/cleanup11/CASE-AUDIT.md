# Audit dei casi — task 11

La main sorgente è e3456eb. Le coppie nel viewer mostrano i casi reali e la copertura delle regioni; il footprint audit controlla separatamente l’intero rettangolo ruotato di ogni placement. Non presume una parete continua dal solo punto centrale.

## Classificazione e correzioni

- **Supporto sbagliato:** quad sopra aperture, giunti di segmento o oltre un bordo. Spostati interamente su muratura continua; nessun testo ritagliato.
- **Occlusione strutturale impropria:** murali principali attraverso pilastri, scala, tubazioni o ferramenta. Ricollocati/ridimensionati, conservando architettura e contenuto.
- **Decal flottante:** offset spray stradale 70 → 3 mm; lettere 90–96 → 4–4.6 mm; indicazioni 80/90 → 6 mm. Poster e overpaint conservano stratificazione deliberata (7–19 e 20 mm).
- **Insegna ALTERCO:** la staffa centrale attraversava la faccia; ora due staffe corte collegano il retro/bordo al muro. Il campionamento UV sul retro viene invertito per leggere ALTERCO da entrambi gli approcci, riusando la stessa texture e lo stesso quad (nessuna nuova allocazione/draw call). Viste 140/141.
- **TRACKS/ROOF:** indicazioni ricollocate sulle baie libere: sinistra z −69.4/y 1.5 e destra z −67.3/y 1.4. Viste 120–123 e 142.
- **Tetto:** stencil HOODDINO oltre il bordo del bulkhead ricollocato x −7/z 4.003; antenna davanti all’artwork ricollocata con il suo beacon. Quest’ultimo era un caso di occlusione naturale, corretto per la leggibilità HERO, non un’intersezione con il quadro. Viste 35–37, 147–149.
- **ROOM:** titolo bio sotto il tubo rosso e fuori dagli ingombri del ritratto; sei mark/poster secondari spostati fuori da assorbitori e conduit. Viste 50/56 e 145/146/150–152.
- **Pianola:** rimosso l’intero gruppo mug (corpo lathe + manico tube), non nascosto; nessun occluder AO proprio (ao:0). La funzione keyboard è identica alla sorgente. Viste 41–49, 143/144.

## Placement stradali modificati

Le immagini della regione sono viste frontali e radenti; alcuni dettagli piccoli si verificano con il footprint e con viste adiacenti, non con la sola miniatura. Le voci TRACKS/ROOF sign nella lista delle collisioni sono riserve della nuova collocazione delle indicazioni: descrivono una ricollocazione coordinata, non strutture preesistenti. I membri di un cluster possono muoversi insieme anche quando non avevano collisioni proprie.

| ID / lato | Prima z/y/w (m) | Dopo z/y/w (m) | Ostacoli/ragione | Copertura regione |
| --- | --- | --- | --- | --- |
| blk_hood2 / R | -87/3.1/8.6 | -86.8/2.2/5.16 | first course, pier, plaza hardware, window/reveal | 126/127 |
| blk_alterco2 / L | -103/3/8.2 | -92.8/2.2/4.92 | doors, first course, pier, plaza hardware, window/reveal | 124/125, 128/129 |
| blk_hood / L | 9.5/2.55/6.6 | 7.7/2.3/1.98 | conduit, drainpipe, gas-run, hardware, pier, segment step | 104/105 |
| blk_alterco / R | -17/2.05/6 | -17/0.9/4.2 | gas-run, ladder | 110/111 |
| wild_vert / R | -108/3.1/5.2 | -106.4/2.4/3.705 | first course, pier, plaza hardware, window/reveal | 130/131 |
| blk_dino / L | -90/2.8/5 | -83.6/2.2/3.5 | first course, pier, plaza hardware, window/reveal | 124/125 |
| wild_kold / L | -29/2.55/3.5 | -29.2/1.4/3.5 | conduit, gas-run, pier | 112/113 |
| wild_skrt / R | -63/2.5/3.4 | -64.6/1.1/2.55 | conduit, gas-run, hardware, pier | 122/123 |
| thr_raw / L | -37/1.5/2.5 | -32.4/1.3/2.5 | shutters | 112/113 |
| thr_moss / L | -17/1.5/2.4 | -11.8/1.4/2.4 | ladder, shutters | 108/109 |
| st_hood_row / L | -6/0.58/2.4 | -4.6/0.6/2.28 | drainpipe, segment step | 104/105 |
| thr_nyx / R | -4.5/1.55/2.2 | -3.3/1.5/2.2 | pier | 106/107 |
| hand_echo / L | -23.5/1.35/1.5 | -23.1/1.4/1.5 | segment step | 108/109 |
| hand_oka / L | -56/1.95/1.5 | -55.6/1.6/1.5 | hardware, pier | 116/117 |
| note_roof / R | -62/1.85/1.5 | -61.8/1.9/1.425 | pier | 122/123 |
| note_water / R | -40.6/0.55/1.45 | -43/0.6/1.45 | doors | 114/115, 118/119 |
| hand_skrt / R | 13/1.25/1.4 | 13.6/1.2/1.4 | hardware | 102/103 |
| note_far / L | -12.6/1.25/1.4 | -15.4/1.2/1.4 | doors | 108/109 |
| hand_nyx / L | 2.8/2.5/1.3 | 4.2/2.2/1.3 | gas-run, pier | 104/105 |
| hand_alt / L | -40/2.2/1.3 | -41.2/0.9/1.3 | gas-run, hardware, shutters | 112/113 |
| note_back / R | -5.6/0.75/1.3 | -6/1.2/1.3 | pier | 106/107 |
| hand_raw / R | -10/1.6/1.25 | -9.2/1.6/1.25 | drainpipe, segment step | 110/111 |
| hand_jade / R | -24/2.65/1.2 | -26/1.8/1.2 | gas-run, hardware, pier | 110/111, 114/115 |
| hand_zed / R | -50/2.9/1.2 | -49.8/2.2/1.2 | gas-run, ladder | 118/119 |
| hand_kold / L | 14/1.55/1.1 | 12.8/0.9/1.1 | hardware | 100/101 |
| tp_4 / L | -71/1.9/1 | -71.8/1.8/1 | TRACKS sign, gas-run, hardware | 120/121 |
| tp_7 / R | -71/2/1 | -70/1.8/1 | gas-run, hardware | 122/123 |
| tp_2 / L | -8.6/2/0.98 | -4.4/1.8/0.98 | doors, gas-run | 104/105, 108/109 |
| fl_1 / L | -9.7/1.6/0.62 | -5.5/1.4/0.62 | cluster con carta/overpaint | 104/105, 108/109 |
| hand_hd / L | -9.1/2.2/0.8 | -4.9/2/0.8 | doors | 104/105, 108/109 |
| tp_7 / L | -19.2/2.1/0.96 | -25.4/1.9/0.864 | gas-run, shutters | 108/109, 112/113 |
| tp_3 / L | -19.9/1.7/0.9 | -26.03/1.54/0.81 | shutters | 108/109, 112/113 |
| hand_kold / L | -19.6/1.9/0.95 | -25.76/1.72/0.855 | shutters | 108/109, 112/113 |
| tp_1 / R | 4.4/1.95/0.95 | 11.6/1.8/0.95 | gas-run, shutters | 102/103, 106/107 |
| tp_4 / R | 3.7/1.7/0.9 | 10.9/1.55/0.9 | shutters | 102/103, 106/107 |
| stk_hd / R | 2.4/1.15/0.2 | 9.6/1/0.2 | shutters | 106/107 |
| hand_echo / R | 4/1.5/0.9 | 11.2/1.35/0.9 | shutters | 102/103, 106/107 |
| tp_5 / R | -21.6/2/0.95 | -19/2/0.712 | gas-run, shutters | 110/111 |
| fr_mono / R | -22.4/1.5/0.8 | -19.6/1.625/0.6 | shutters | 110/111 |
| stk_alt / R | -22.9/0.95/0.22 | -19.975/1.212/0.165 | shutters | 110/111 |
| tp_hood / L | -44.2/2.2/0.95 | -48.8/1.8/0.95 | gas-run, shutters | 116/117 |
| fr_anton / L | -44.9/1.45/0.7 | -49.5/1.05/0.7 | shutters | 116/117 |
| note_ear / L | -44.5/1.2/0.7 | -49.1/0.8/0.7 | shutters | 116/117 |
| hand_ink / L | -1.6/0.9/0.95 | -1.2/0.9/0.95 | doors | 104/105 |
| hand_hd / R | -1.2/2.1/0.95 | -0.4/2.1/0.95 | hardware | 106/107 |
| tp_3 / L | -57.4/2.1/0.94 | -60.6/1.8/0.94 | pier, segment step | 116/117, 120/121 |
| fr_xerox / L | -58/1.5/0.7 | -61.2/1.2/0.7 | segment step | 116/117, 120/121 |
| tp_6 / L | 15.6/1.9/0.92 | 16.4/1.8/0.92 | gas-run, pier | 100/101 |
| fr_serif / L | 15.1/1.35/0.7 | 15.9/1.25/0.7 | hardware, pier | 100/101 |
| fl_3 / R | -39.2/1.75/0.62 | -37.6/1.7/0.62 | doors, hardware | 114/115 |
| tp_2 / R | -39.9/1.95/0.9 | -38.3/1.9/0.9 | doors, gas-run, hardware | 114/115 |
| hand_nyx / R | -40/2.1/0.9 | -38.4/2.05/0.9 | doors, hardware | 114/115 |
| fl_2 / R | -52.4/1.8/0.6 | -47.8/1.6/0.6 | doors | 118/119 |
| tp_5 / R | -53.2/2/0.9 | -48.6/1.8/0.9 | doors, gas-run | 118/119 |
| stk_eye / R | -53.8/1/0.2 | -49.2/0.8/0.2 | cluster con carta/overpaint | 118/119 |
| note_ear / L | -38.3/0.55/0.9 | -35.7/0.5/0.9 | shutters | 112/113 |
| st_cross / R | -30/1/0.85 | -30.6/1/0.85 | doors, hardware | 114/115 |
| st_hd / R | -47/1.3/0.8 | -46/1.3/0.8 | pier | 118/119 |
| st_eye / L | -59/1.15/0.75 | -62/1.1/0.75 | drainpipe, hardware | 120/121 |
| st_barcode / R | 3.4/0.95/0.7 | 5/0.9/0.7 | shutters | 106/107 |
| fr_04 / L | -24.6/1.6/0.5 | -23.6/2.2/0.5 | drainpipe | 108/109, 112/113 |
| stk_seven / L | -2.2/1.8/0.2 | -1.6/1.8/0.2 | doors | 104/105 |

## Indizi interattivi

Lettere 2/3/5 spostate z −20.5→−22.1, −33.5→−32.8, −57.5→−56.2. Viste di supporto 153–155; tutte e sette conservano ID, immagine e zona di hit nello stesso gruppo. Le altre quattro mantengono la collocazione; il loro offset viene ridotto. Il test picking usa click e tap reali sul centro proiettato della mesh visibile, senza chiamare foundLetter. Il fixture del test eggs sulla lettera 2 segue il nuovo punto.

## Occlusioni conservate

Lampioni, cavi, cartelli e attrezzatura possono coprire naturalmente oggetti più lontani. Il rettangolo scuro dentro il tag rosso della ROOM è paintOver dell’asset procedurale esistente (lib/roomTextures.ts, blk_hd), non una nuova struttura sopra il testo. Nessuna correzione elimina queste caratteristiche o forza visibilità attraverso geometria.

## Vincoli per le task successive

Conservare le baie libere e i nuovi placement, mantenere lettere/hit nello stesso transform e aggiornare i fixture se spostati. Non reintrodurre la tazza nel batch; conservare la pianola. Non far tornare gli offset a distanze che fanno galleggiare pittura e indizi. Rigenerare il fixture geometrico quando cambia la struttura: i digest in geometry-fixture.json impediscono di riusare bounds obsoleti.

Il primo fixture ometteva l’installazione laterale della piazza in plazaArch.ts. Le viste 24/26 hanno rivelato le griglie/tubazioni ancora sovrapposte a quattro murali: il controllo è stato esteso agli ingombri reali del blocco sorgente, tutti e quattro ricollocati e il totale di 73 footprint riesaminato. La relativa candidata incompleta resta sotto attempts/, esclusa dal risultato finale.

**ONE WAY:** montata sulla stessa griglia L z −10.77/y 2.45. Ricollocata sul supporto libero L z −9.8/y 2.0, senza coprire i graffiti. Viste frontale/radente 156/157; riserva della baia e audit dei tre sign aggiunti a placement-audit.py. Le staffe ALTERCO si attaccano a z −31.06/y 4.7 e 5.3, fuori dalle aperture del layout.
