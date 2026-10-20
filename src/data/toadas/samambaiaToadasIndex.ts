/**
 * samambaiaToadasIndex.ts
 * Index et rassemblement du catalogue officiel des 12 Toadas de Samambaia (< 60 lignes).
 */
import type { ToadaDocument } from '../../types/toadaDocument.types';
import { TOADA_DE_NORTE_A_SUL, TOADA_TEM_MACAIBA } from './samambaiaToadas1to2';
import { TOADA_ARUANDA_LE_LE, TOADA_OPANIJE } from './samambaiaToadas3to4';
import { TOADA_VOVO_FALOU, TOADA_VOU_PRA_BAHIA } from './samambaiaToadas5to6';
import { TOADA_MORO_OMIM_MA, TOADA_COSTA_VELHA } from './samambaiaToadas7to8';
import { TOADA_EU_SOU_RAIZES_DE_AFRICA, TOADA_A_LOA_PRA_BOULE } from './samambaiaToadas9to10';
import { TOADA_PRINCESA_IZABEL, TOADA_ARREDA_DO_CAMINHO } from './samambaiaToadas11to12';

export const SAMAMBAIA_12_TOADAS: ToadaDocument[] = [
  TOADA_DE_NORTE_A_SUL,
  TOADA_TEM_MACAIBA,
  TOADA_ARUANDA_LE_LE,
  TOADA_OPANIJE,
  TOADA_VOVO_FALOU,
  TOADA_VOU_PRA_BAHIA,
  TOADA_MORO_OMIM_MA,
  TOADA_COSTA_VELHA,
  TOADA_EU_SOU_RAIZES_DE_AFRICA,
  TOADA_A_LOA_PRA_BOULE,
  TOADA_PRINCESA_IZABEL,
  TOADA_ARREDA_DO_CAMINHO,
];

export function getSamambaiaToadaById(id: string): ToadaDocument | undefined {
  return SAMAMBAIA_12_TOADAS.find((t) => t.id === id || t.titre.toLowerCase() === id.toLowerCase());
}

export function isSamambaiaToada(id: string): boolean {
  return SAMAMBAIA_12_TOADAS.some((t) => t.id === id);
}
