/**
 * samambaiaToadas3to4.ts
 * Fiches 3 et 4 des Toadas de Samambaia (< 100 lignes).
 * 1 Paragraphe = 1 Mesure (*gras* = Puxador, normal = Coro, [Section], [Accord]).
 */
import type { ToadaDocument } from '../../types/toadaDocument.types';

export const TOADA_ARUANDA_LE_LE: ToadaDocument = {
  id: 'L761c26R74KYvLKqG3TL',
  titre: 'Aruanda lê lê',
  type: 'song',
  categoryId: 'Toadas',
  categorie: 'Toadas',
  groupId: 'samambaia',
  nacao: 'Estrela Brilhante de Igarassu',
  rythme: 'Baque de Igarassu',
  annee: 2024,
  signature: '4/4',
  bpmDefaut: 55,
  tonaliteDefaut: 'C',
  parolesOriginales: `Signature: 4/4
Tempo: 55
Tonalite: C
[Section Refrain]
[C] *Aruanda* lê lê,
[G7] *Aruanda* lá lá,
[C] *Aruanda* lê lê,
[G7] *Aruanda* lá lá,
[Section Tenda]
[F] *Aruanda é que vem da tenda,*
[C] *É que vem da tenda,* é dita tarará
[F] *Aruanda é que vem da tenda,*
[C] *É que vem da tenda,* é dita tarará`,
  parolesPhonetiques: `Aluanda lé lé
Aluanda la la
Aluanda lé lé
Aluanda la la
Aluanda é qui vein da ténda
é qui vein da ténda é dita tarara
Aluanda é qui vein da ténda
é qui vein da ténda é dita tarara`,
};

export const TOADA_OPANIJE: ToadaDocument = {
  id: 'EOM4hm5tPddRr7KRz2mv',
  titre: 'Opanijé',
  type: 'song',
  categoryId: 'Toadas',
  categorie: 'Toadas',
  groupId: 'samambaia',
  nacao: 'Estrela Brilhante de Igarassu',
  rythme: 'Opanijé',
  annee: 2024,
  signature: '4/4',
  bpmDefaut: 45,
  tonaliteDefaut: 'Em',
  parolesOriginales: `Signature: 4/4
Tempo: 45
Tonalite: Em
[Section Invocação - Lento @ 45 BPM]
[Em] *Opanijé,* atotô
[B7] *Opanijé,* atotô
[Em] *Atotô,* Azauani
[B7] *Ajunssun,* Azauani
[Section Baque Virado @ 62 BPM]
[Em] *Opanijé, opanijé, opanijé*
[Em] Opanijé, opanijé, opanijé
[Em] *Opanijé,* atotô
[B7] *Opanijé,* atotô
[Em] *Atotô,* Azauani
[B7] *Ajunssun,* Azauani
[Am] Que congo que zomborufá
[Em] Que ganga, quilemgue babaninla`,
  parolesPhonetiques: `Opanijé atotô
Opanijé atotô
Atotô azawani
Ajoussun azawani
Opanijé opanijé opanijé
Opanijé opanijé opanijé
Opanijé atotô
Opanijé atotô
Atotô azawani
Ajoussun azawani
Ké congo ké zomboroufa
Ké ganga kilengué babaninla`,
};
