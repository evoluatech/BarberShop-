import {
  CranialShapeCategory,
  FaceShape,
  HairLengthCategory,
  HairType,
  VirtualHairstyleId,
} from '@/lib/types/domain';

export type ResultadoBinarioVisagismo = 'positivo' | 'negativo';
export type CorDiagnosticoVisagismo = 'verde' | 'vermelho';

export interface MedidasBasicasVisagismo {
  alturaRostoCm?: number;
  larguraMacasCm?: number;
  larguraMandibulaCm?: number;
  larguraTestaCm?: number;
  formatoCabeca?: CranialShapeCategory;
}

export interface EntradaVisagismoDados {
  styleId?: VirtualHairstyleId;
  tipoCabelo: HairType;
  formatoRosto?: FaceShape;
  comprimentoCabelo?: HairLengthCategory;
  medidasBasicas?: MedidasBasicasVisagismo;
}

export interface DiagnosticoVisagismoBinario {
  resultado: ResultadoBinarioVisagismo;
  cor: CorDiagnosticoVisagismo;
}

export const FORMATOS_CRANIO_VALIDOS: readonly CranialShapeCategory[] = [
  'Equilibrado',
  'Topo alongado',
  'Laterais largas',
  'Occipital proeminente',
];

const CRANIO_VALIDO_SET = new Set<CranialShapeCategory>(FORMATOS_CRANIO_VALIDOS);

const COMPATIBILIDADE_ROSTO: Record<VirtualHairstyleId, Record<FaceShape, number>> = {
  'corte-degrade': {
    Oval: 94,
    Redondo: 91,
    Quadrado: 89,
    Diamante: 84,
    Triangular: 82,
    Alongado: 74,
  },
  'corte-social': {
    Oval: 93,
    Quadrado: 90,
    Diamante: 88,
    Alongado: 86,
    Triangular: 84,
    Redondo: 76,
  },
  'corte-tesoura': {
    Diamante: 93,
    Triangular: 91,
    Oval: 92,
    Alongado: 88,
    Quadrado: 84,
    Redondo: 72,
  },
  'barba-desenhada': {
    Redondo: 93,
    Oval: 92,
    Triangular: 88,
    Alongado: 84,
    Quadrado: 85,
    Diamante: 86,
  },
  'combo-corte-barba': {
    Oval: 95,
    Redondo: 92,
    Quadrado: 91,
    Diamante: 89,
    Triangular: 87,
    Alongado: 83,
  },
  'corte-barba-sobrancelha': {
    Oval: 96,
    Redondo: 93,
    Quadrado: 92,
    Diamante: 90,
    Triangular: 88,
    Alongado: 85,
  },
};

const COMPATIBILIDADE_CABELO: Record<VirtualHairstyleId, Record<HairType, number>> = {
  'corte-degrade': {
    Liso: 88,
    Ondulado: 93,
    Cacheado: 95,
    Crespo: 96,
  },
  'corte-social': {
    Liso: 94,
    Ondulado: 90,
    Cacheado: 80,
    Crespo: 74,
  },
  'corte-tesoura': {
    Liso: 90,
    Ondulado: 94,
    Cacheado: 88,
    Crespo: 78,
  },
  'barba-desenhada': {
    Liso: 86,
    Ondulado: 89,
    Cacheado: 90,
    Crespo: 91,
  },
  'combo-corte-barba': {
    Liso: 90,
    Ondulado: 93,
    Cacheado: 94,
    Crespo: 95,
  },
  'corte-barba-sobrancelha': {
    Liso: 91,
    Ondulado: 94,
    Cacheado: 95,
    Crespo: 95,
  },
};

const COMPATIBILIDADE_COMPRIMENTO: Record<
  VirtualHairstyleId,
  Record<HairLengthCategory, number>
> = {
  'corte-degrade': {
    'Raspado / Muito curto': 58,
    Curto: 90,
    Médio: 96,
    Longo: 92,
  },
  'corte-social': {
    'Raspado / Muito curto': 40,
    Curto: 84,
    Médio: 95,
    Longo: 92,
  },
  'corte-tesoura': {
    'Raspado / Muito curto': 25,
    Curto: 62,
    Médio: 94,
    Longo: 96,
  },
  'barba-desenhada': {
    'Raspado / Muito curto': 78,
    Curto: 88,
    Médio: 92,
    Longo: 90,
  },
  'combo-corte-barba': {
    'Raspado / Muito curto': 55,
    Curto: 88,
    Médio: 95,
    Longo: 93,
  },
  'corte-barba-sobrancelha': {
    'Raspado / Muito curto': 58,
    Curto: 90,
    Médio: 96,
    Longo: 94,
  },
};

const AJUSTE_CRANIANO: Record<
  CranialShapeCategory,
  Partial<Record<VirtualHairstyleId, number>>
> = {
  Equilibrado: {},
  'Topo alongado': {
    'corte-degrade': -4,
    'corte-social': 2,
    'corte-tesoura': 3,
  },
  'Laterais largas': {
    'corte-degrade': 4,
    'combo-corte-barba': 2,
    'corte-tesoura': -8,
    'corte-social': -5,
  },
  'Occipital proeminente': {
    'corte-degrade': 2,
    'corte-tesoura': 2,
    'corte-social': -3,
  },
};

function normalizarMedidaCm(valor: unknown): number | undefined {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return undefined;
  if (valor < 6 || valor > 35) return undefined;
  return Math.round(valor * 10) / 10;
}

/**
 * Classifica o formato do rosto estritamente a partir de medidas básicas em centímetros (sem imagens).
 */
export function classificarFormatoRostoPorMedidas(
  medidas?: MedidasBasicasVisagismo
): FaceShape | null {
  if (!medidas) return null;

  const altura = normalizarMedidaCm(medidas.alturaRostoCm);
  const macas = normalizarMedidaCm(medidas.larguraMacasCm);
  const mandibula = normalizarMedidaCm(medidas.larguraMandibulaCm);
  const testa = normalizarMedidaCm(medidas.larguraTestaCm);

  const larguraReferencia = macas ?? testa ?? mandibula;
  if (!altura || !larguraReferencia) return null;

  const razaoAlturaLargura = Number((altura / larguraReferencia).toFixed(2));
  const mandibulaEfetiva = mandibula ?? larguraReferencia * 0.85;
  const testaEfetiva = testa ?? larguraReferencia * 0.9;
  const razaoMandibulaLargura = Number(
    (mandibulaEfetiva / larguraReferencia).toFixed(2)
  );
  const razaoTestaMandibula = Number(
    (testaEfetiva / mandibulaEfetiva).toFixed(2)
  );

  if (razaoAlturaLargura >= 1.52) {
    return 'Alongado';
  }
  if (
    razaoMandibulaLargura >= 0.9 &&
    razaoTestaMandibula >= 0.88 &&
    razaoTestaMandibula <= 1.12 &&
    razaoAlturaLargura <= 1.38
  ) {
    return 'Quadrado';
  }
  if (razaoAlturaLargura <= 1.24 && razaoMandibulaLargura < 0.88) {
    return 'Redondo';
  }
  if (mandibulaEfetiva > testaEfetiva * 1.12) {
    return 'Triangular';
  }
  if (macas && macas > testaEfetiva * 1.09 && macas > mandibulaEfetiva * 1.11) {
    return 'Diamante';
  }

  return 'Oval';
}

/**
 * Diagnóstico binário estritamente por entrada de dados (sem captura ou processamento de imagens).
 * Retorna apenas resultado positivo (verde) ou negativo (vermelho).
 */
export function diagnosticarVisagismoBinario(
  entrada: EntradaVisagismoDados
): DiagnosticoVisagismoBinario {
  const styleId: VirtualHairstyleId = entrada.styleId ?? 'corte-degrade';
  const formatoDerivado = classificarFormatoRostoPorMedidas(entrada.medidasBasicas);
  const formatoRosto: FaceShape = formatoDerivado ?? entrada.formatoRosto ?? 'Oval';
  const tipoCabelo: HairType = entrada.tipoCabelo;
  const comprimentoCabelo: HairLengthCategory = entrada.comprimentoCabelo ?? 'Médio';

  const formatoCabeca =
    entrada.medidasBasicas?.formatoCabeca &&
    CRANIO_VALIDO_SET.has(entrada.medidasBasicas.formatoCabeca)
      ? entrada.medidasBasicas.formatoCabeca
      : undefined;

  const notaBaseRosto = COMPATIBILIDADE_ROSTO[styleId][formatoRosto];
  const deltaCranio = formatoCabeca
    ? (AJUSTE_CRANIANO[formatoCabeca][styleId] ?? 0)
    : 0;
  const notaRosto = Math.max(0, Math.min(100, notaBaseRosto + deltaCranio));
  const notaCabelo = COMPATIBILIDADE_CABELO[styleId][tipoCabelo];
  const notaComprimento = COMPATIBILIDADE_COMPRIMENTO[styleId][comprimentoCabelo];

  const indiceGeral = Math.round(
    notaRosto * 0.38 + notaCabelo * 0.34 + notaComprimento * 0.28
  );

  const positivo = notaComprimento >= 55 && indiceGeral >= 75;

  return positivo
    ? {resultado: 'positivo', cor: 'verde'}
    : {resultado: 'negativo', cor: 'vermelho'};
}
