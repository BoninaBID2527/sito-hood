# Initial audit: retained V3.6 versus inherited V3.7

The two production builds were captured at matching 640×360 balanced poses,
internal scale 0.6. This initial set is 15 representative frames per build;
the full comparable checkpoint sweep is recorded separately. The V3.6 run did
not finish its asynchronous concrete-texture upgrade within the initial wait,
so texture-resolution differences in this first set are not a fair comparison.

| Checkpoint | Main remaining CG giveaways | Classification |
| --- | --- | --- |
| 01 opening street | road/reflection uniformity, facade repetition, large visible particle sprites | roughness, tiling, atmosphere |
| 10 plaza front | wet floor's sharp reflection, generic rear metalwork, empty continuation in V3.6 | reflection, roughness, empty background |
| 15 plaza inward 180° | framed-paper rear integration, background construction absent in V3.6 | construction, contact, empty background |
| 19 plaza outward 0° | connecting facades backface-cull when seen from the plaza, exposing sky wedges | missing geometry, empty background |
| 23 plaza outward 180° | V3.6 world terminates; inherited V3.7 adds a service passage but remains regular | empty background, construction, tiling |
| 27 distant plaza | V3.6 depth missing; inherited service blocks and bridge improve depth | empty background, atmosphere, camera/composition |
| 28 track 01 | backing/support finish, glossy installation/floor response | construction, roughness, reflection |
| 40 ROOM entry | saturated blue ceiling wash, dark uniform side surfaces, point-source light distribution | direct light, indirect light, roughness |
| 41 ROOM workstation wide | equipment/cables, generic sheen, dark floor contact | construction, roughness, contact |
| 43 ROOM close | screen response, wood grain/roughness, wall relief | albedo, roughness, normal response |
| 52 ROOM side wall | repeated painted surface, flat material differentiation, corner fill | tiling, roughness, indirect light |
| 54 ROOM ceiling | treatment missing at listening position, source brightness concentrated, uniform fixtures | construction, direct light, roughness |
| 55 ROOM floor | repeated wood tile, flat roughness, baked coloured light in albedo | tiling, roughness, albedo |
| 56 ROOM dark corner | dark information loss, uniform response | exposure, indirect light |
| 58 DUALISMO entry | stylised emission/glass/reflections reveal a rendered environment | direct light, reflection, roughness |

V3.6 and inherited V3.7 ROOM views are essentially unchanged. This verifies the
missing studio work rather than treating Claude's incomplete status as evidence
that the room was rebuilt. No image in this initial audit earns grade A.
