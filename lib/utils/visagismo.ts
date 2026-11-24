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
  formatoCabeca?: CranialShapeCategory;
  comprimentoCabelo?: HairLengthCategory;
  medidasBasicas?: MedidasBasicasVisagismo;
}

export interface DiagnosticoVisagismoBinario {
  resultado: ResultadoBinarioVisagismo;
  cor: CorDiagnosticoVisagismo;
}

export interface AvaliacaoDetalhadaVisagismo {
  diagnostico: DiagnosticoVisagismoBinario;
  formatoRostoResolvido: FaceShape;
  formatoCabecaResolvido: CranialShapeCategory;
  comprimentoResolvido: HairLengthCategory;
  indiceGeral: number;
  motivo: string;
}

export const FORMATOS_CRANIO_VALIDOS: readonly CranialShapeCategory[] = [
  'Equilibrado',
  'Topo alongado',
  'Laterais largas',
  'Occipital proeminente',
];

const CRANIO_VALIDO_SET = new Set<CranialShapeCategory>(FORMATOS_CRANIO_VALIDOS);

/**
 * Pontuação base por formato de rosto com base em regras reais de visagismo masculino:
 * - Rosto Redondo precisa de laterais baixas + altura no topo (Degradê / Barba angular) e falha em cortes que mantêm volume lateral (Social tradicional / Tesoura inteira).
 * - Rosto Alongado precisa de volume horizontal nas laterais (Social / Tesoura) e falha com degradês altos ou barbas que alongam o terço inferior.
 * - Rosto Triangular (mandíbula larga + testa estreita) pede volume nas têmporas/topo (Tesoura / Social) e exige cuidado com degradê muito raspado ou barba que alargue o maxilar.
 */
const COMPATIBILIDADE_ROSTO: Record<VirtualHairstyleId, Record<FaceShape, number>> = {
  'corte-degrade': {
    Oval: 94,
    Redondo: 92,
    Quadrado: 87,
    Diamante: 76,
    Triangular: 72,
    Alongado: 58,
  },
  'corte-social': {
    Oval: 94,
    Quadrado: 90,
    Alongado: 90,
    Diamante: 86,
    Triangular: 83,
    Redondo: 54,
  },
  'corte-tesoura': {
    Diamante: 94,
    Triangular: 92,
    Alongado: 91,
    Oval: 90,
    Quadrado: 82,
    Redondo: 52,
  },
  'barba-desenhada': {
    Redondo: 94,
    Oval: 92,
    Diamante: 88,
    Quadrado: 78,
    Alongado: 60,
    Triangular: 54,
  },
  'combo-corte-barba': {
    Oval: 94,
    Redondo: 89,
    Quadrado: 88,
    Diamante: 84,
    Triangular: 68,
    Alongado: 64,
  },
  'corte-barba-sobrancelha': {
    Oval: 95,
    Redondo: 90,
    Quadrado: 89,
    Diamante: 85,
    Triangular: 70,
    Alongado: 65,
  },
};

/**
 * Compatibilidade por curvatura/textura do fio (Liso, Ondulado, Cacheado, Crespo):
 * - Cabelo Liso: excelente caimento linear para Social e Tesoura; em Degradê curto ou Barba desenhada exige cuidado com marcações e menor densidade lateral.
 * - Cabelo Ondulado: versátil em quase todas as técnicas.
 * - Cabelo Cacheado: responde muito bem ao Degradê e à Tesoura (em comprimento médio/longo), mas sofre efeito "capacete" em Social curto uniforme.
 * - Cabelo Crespo: alto fator encolhimento e volume estruturado; brilha no Degradê/Contorno, mas não encaixa em Social tradicional ou Tesoura clássica sem taper/degradê.
 */
const COMPATIBILIDADE_CABELO: Record<VirtualHairstyleId, Record<HairType, number>> = {
  'corte-degrade': {
    Liso: 78,
    Ondulado: 92,
    Cacheado: 94,
    Crespo: 96,
  },
  'corte-social': {
    Liso: 95,
    Ondulado: 90,
    Cacheado: 68,
    Crespo: 46,
  },
  'corte-tesoura': {
    Liso: 89,
    Ondulado: 95,
    Cacheado: 86,
    Crespo: 50,
  },
  'barba-desenhada': {
    Liso: 66,
    Ondulado: 88,
    Cacheado: 92,
    Crespo: 93,
  },
  'combo-corte-barba': {
    Liso: 78,
    Ondulado: 92,
    Cacheado: 91,
    Crespo: 88,
  },
  'corte-barba-sobrancelha': {
    Liso: 80,
    Ondulado: 93,
    Cacheado: 91,
    Crespo: 89,
  },
};

/**
 * Suficiência real de comprimento:
 * - Raspado / Muito curto inviabiliza cortes com degradê estruturado, social ou tesoura.
 * - Corte na Tesoura exige comprimento Médio ou Longo (Curto não permite construir camadas/movimento).
 */
const COMPATIBILIDADE_COMPRIMENTO: Record<
  VirtualHairstyleId,
  Record<HairLengthCategory, number>
> = {
  'corte-degrade': {
    'Raspado / Muito curto': 35,
    Curto: 86,
    Médio: 95,
    Longo: 90,
  },
  'corte-social': {
    'Raspado / Muito curto': 28,
    Curto: 78,
    Médio: 95,
    Longo: 90,
  },
  'corte-tesoura': {
    'Raspado / Muito curto': 18,
    Curto: 44,
    Médio: 94,
    Longo: 96,
  },
  'barba-desenhada': {
    'Raspado / Muito curto': 70,
    Curto: 86,
    Médio: 92,
    Longo: 90,
  },
  'combo-corte-barba': {
    'Raspado / Muito curto': 38,
    Curto: 82,
    Médio: 94,
    Longo: 91,
  },
  'corte-barba-sobrancelha': {
    'Raspado / Muito curto': 40,
    Curto: 83,
    Médio: 95,
    Longo: 92,
  },
};

/**
 * Impacto anatômico real do formato do crânio (cabeça) sobre o resultado final:
 * - Topo alongado: degradês fechados/altos evidenciam silhueta alongada; Social e Tesoura equilibram melhor.
 * - Laterais largas: Degradê afina os parietais largos; Social e Tesoura sem taper aumentam o efeito "cabeça larga".
 * - Occipital proeminente: máquina baixa/curta na nuca evidencia o osso occipital; Tesoura média/longa suaviza a curvatura.
 */
const AJUSTE_CRANIANO: Record<
  CranialShapeCategory,
  Partial<Record<VirtualHairstyleId, number>>
> = {
  Equilibrado: {
    'corte-degrade': 4,
    'corte-social': 4,
    'corte-tesoura': 4,
    'barba-desenhada': 3,
    'combo-corte-barba': 4,
    'corte-barba-sobrancelha': 4,
  },
  'Topo alongado': {
    'corte-degrade': -18,
    'corte-social': 4,
    'corte-tesoura': 5,
    'barba-desenhada': -10,
    'combo-corte-barba': -12,
    'corte-barba-sobrancelha': -10,
  },
  'Laterais largas': {
    'corte-degrade': 8,
    'combo-corte-barba': -4,
    'corte-barba-sobrancelha': -4,
    'corte-tesoura': -24,
    'corte-social': -26,
    'barba-desenhada': -8,
  },
  'Occipital proeminente': {
    'corte-degrade': -10,
    'corte-tesoura': 4,
    'corte-social': -14,
    'barba-desenhada': -2,
    'combo-corte-barba': -10,
    'corte-barba-sobrancelha': -10,
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

function avaliarContraindicacaoReal(params: {
  styleId: VirtualHairstyleId;
  formatoRosto: FaceShape;
  formatoCabeca: CranialShapeCategory;
  tipoCabelo: HairType;
  comprimentoCabelo: HairLengthCategory;
}): string | null {
  const {styleId, formatoRosto, formatoCabeca, tipoCabelo, comprimentoCabelo} = params;

  // 1. Insuficiência de comprimento para técnicas de corte estruturado
  if (
    comprimentoCabelo === 'Raspado / Muito curto' &&
    styleId !== 'barba-desenhada'
  ) {
    return 'Comprimento insuficiente: com o cabelo raspado ou muito curto não há massa capilar para estruturar este corte; aguarde crescer antes de cortar.';
  }

  if (styleId === 'corte-tesoura' && comprimentoCabelo === 'Curto') {
    return 'Comprimento insuficiente para Corte na Tesoura: este corte exige fios médios ou longos para construir camadas, textura e caimento natural.';
  }

  // 2. Contraindicações por estilo x formato de cabeça x tipo de fio x rosto
  if (styleId === 'corte-degrade') {
    if (formatoRosto === 'Alongado' && formatoCabeca === 'Topo alongado') {
      return 'Rosto alongado com crânio de topo alongado: o degradê reduz o apoio lateral e puxa ainda mais a altura vertical, deixando a silhueta esticada.';
    }
    if (
      formatoCabeca === 'Occipital proeminente' &&
      comprimentoCabelo === 'Curto' &&
      (tipoCabelo === 'Liso' || tipoCabelo === 'Ondulado')
    ) {
      return 'Occipital proeminente com fio curto: raspar ou baixar demais a nuca evidencia a saliência óssea atrás; prefira comprimento médio na tesoura para sombrear a nuca.';
    }
    if (formatoCabeca === 'Topo alongado' && comprimentoCabelo === 'Curto') {
      return 'Crânio com topo alongado e fios curtos: o degradê nas laterais afina demais as têmporas e destaca a projeção alta do topo.';
    }
    if (
      (formatoRosto === 'Triangular' || formatoRosto === 'Diamante') &&
      tipoCabelo === 'Liso' &&
      comprimentoCabelo === 'Curto'
    ) {
      return `Rosto ${formatoRosto.toLowerCase()} com cabelo liso curto: limpar muito as laterais estreita a região da testa frente às maçãs/mandíbula.`;
    }
    if (formatoRosto === 'Alongado' && tipoCabelo === 'Liso') {
      return 'Rosto alongado com fio liso: o degradê tira volume horizontal das laterais, acentuando o comprimento vertical do rosto; o Corte Social ou na Tesoura equilibra melhor.';
    }
  }

  if (styleId === 'corte-social') {
    if (tipoCabelo === 'Crespo') {
      return 'Cabelo crespo no Corte Social tradicional: a lateral uniforme sem degradê/taper expande com o fator encolhimento e perde o alinhamento social.';
    }
    if (formatoRosto === 'Redondo') {
      return 'Rosto redondo no Corte Social clássico: manter volume uniforme nas laterais alarga as bochechas e arredonda ainda mais o rosto.';
    }
    if (formatoCabeca === 'Laterais largas') {
      return 'Crânio com laterais largas: o Corte Social mantém volume lateral uniforme sobre ossos parietais amplos, ampliando a largura da cabeça.';
    }
    if (
      formatoCabeca === 'Occipital proeminente' &&
      comprimentoCabelo === 'Curto'
    ) {
      return 'Occipital proeminente com comprimento curto: a nuca social uniforme acompanha e evidencia o relevo da nuca; pede fios médios graduados na tesoura.';
    }
    if (tipoCabelo === 'Cacheado' && comprimentoCabelo === 'Curto') {
      return 'Cabelo cacheado curto no Corte Social: sem comprimento médio para acomodar os cachos ou degradê lateral, os fios armam nas têmporas.';
    }
  }

  if (styleId === 'corte-tesoura') {
    if (tipoCabelo === 'Crespo') {
      return 'Cabelo crespo exclusivamente na tesoura sem taper/degradê: o volume lateral tende a expandir de forma irregular ao secar.';
    }
    if (formatoCabeca === 'Laterais largas') {
      return 'Crânio com laterais largas: preservar comprimento na tesoura ao redor das têmporas aumenta o volume horizontal da cabeça.';
    }
    if (formatoRosto === 'Redondo') {
      return 'Rosto redondo com Corte na Tesoura: o volume lateral preservado reforça a largura facial; um degradê com altura no topo alonga melhor o rosto.';
    }
  }

  if (styleId === 'barba-desenhada') {
    if (
      formatoRosto === 'Triangular' &&
      (formatoCabeca === 'Laterais largas' ||
        formatoCabeca === 'Topo alongado' ||
        tipoCabelo === 'Liso')
    ) {
      return 'Rosto triangular já possui mandíbula ampla: uma barba desenhada marcada pesa ainda mais no terço inferior e reduz a harmonia com a testa.';
    }
    if (
      formatoRosto === 'Alongado' &&
      (formatoCabeca === 'Topo alongado' ||
        comprimentoCabelo === 'Raspado / Muito curto')
    ) {
      return 'Rosto alongado: linhas verticais de barba desenhada acentuam o alongamento do queixo e esticam ainda mais o perfil.';
    }
    if (
      tipoCabelo === 'Liso' &&
      (comprimentoCabelo === 'Raspado / Muito curto' ||
        (formatoRosto === 'Quadrado' && formatoCabeca === 'Laterais largas'))
    ) {
      return 'Fios lisos neste perfil dificultam a sustentação de contornos geométricos marcados sem criar contraste rígido ou aparência rala.';
    }
  }

  if (
    styleId === 'combo-corte-barba' ||
    styleId === 'corte-barba-sobrancelha'
  ) {
    if (formatoRosto === 'Alongado' && formatoCabeca === 'Topo alongado') {
      return 'Rosto alongado com topo do crânio alongado: o pacote completo com degradê e barba desenhada estica verticalmente a proporção facial.';
    }
    if (
      formatoRosto === 'Triangular' &&
      (formatoCabeca === 'Laterais largas' ||
        (tipoCabelo === 'Liso' && comprimentoCabelo === 'Curto'))
    ) {
      return 'Rosto triangular com esta estrutura de cabeça/fio: combinar barba marcada no maxilar largo com pouca cobertura nas têmporas acentua a desproporção inferior.';
    }
    if (
      formatoCabeca === 'Occipital proeminente' &&
      comprimentoCabelo === 'Curto' &&
      (tipoCabelo === 'Liso' || tipoCabelo === 'Ondulado')
    ) {
      return 'Occipital proeminente com fios curtos: a transição curta do combo expõe a nuca saliente; aguarde comprimento médio para acabamento na tesoura.';
    }
    if (
      formatoCabeca === 'Laterais largas' &&
      formatoRosto === 'Redondo' &&
      tipoCabelo === 'Liso' &&
      comprimentoCabelo === 'Curto'
    ) {
      return 'Rosto redondo com laterais largas e fio liso curto: falta volume vertical no topo para alongar e equilibrar a largura das bochechas e parietais.';
    }
  }

  return null;
}

export function avaliarVisagismoCompleto(
  entrada: EntradaVisagismoDados
): AvaliacaoDetalhadaVisagismo {
  const styleId: VirtualHairstyleId = entrada.styleId ?? 'corte-degrade';
  const formatoDerivado = classificarFormatoRostoPorMedidas(entrada.medidasBasicas);
  const formatoRostoResolvido: FaceShape =
    formatoDerivado ?? entrada.formatoRosto ?? 'Oval';
  const tipoCabelo: HairType = entrada.tipoCabelo;
  const comprimentoResolvido: HairLengthCategory =
    entrada.comprimentoCabelo ?? 'Médio';

  const cabecaInformada =
    entrada.formatoCabeca ?? entrada.medidasBasicas?.formatoCabeca;
  const formatoCabecaResolvido: CranialShapeCategory =
    cabecaInformada && CRANIO_VALIDO_SET.has(cabecaInformada)
      ? cabecaInformada
      : 'Equilibrado';

  const notaBaseRosto = COMPATIBILIDADE_ROSTO[styleId][formatoRostoResolvido];
  const deltaCranio = AJUSTE_CRANIANO[formatoCabecaResolvido][styleId] ?? 0;
  const notaRosto = Math.max(0, Math.min(100, notaBaseRosto + deltaCranio));
  const notaCabelo = COMPATIBILIDADE_CABELO[styleId][tipoCabelo];
  const notaComprimento = COMPATIBILIDADE_COMPRIMENTO[styleId][comprimentoResolvido];

  const indiceGeral = Math.round(
    notaRosto * 0.4 + notaCabelo * 0.34 + notaComprimento * 0.26
  );

  const contraindicacao = avaliarContraindicacaoReal({
    styleId,
    formatoRosto: formatoRostoResolvido,
    formatoCabeca: formatoCabecaResolvido,
    tipoCabelo,
    comprimentoCabelo: comprimentoResolvido,
  });

  const positivo = !contraindicacao && notaComprimento >= 55 && indiceGeral >= 76;
  const indiceFinal = positivo ? indiceGeral : Math.min(68, indiceGeral);

  const diagnostico: DiagnosticoVisagismoBinario = positivo
    ? {resultado: 'positivo', cor: 'verde'}
    : {resultado: 'negativo', cor: 'vermelho'};

  let motivo: string;
  if (contraindicacao) {
    motivo = contraindicacao;
  } else if (!positivo) {
    motivo = `Combinação desfavorável para rosto ${formatoRostoResolvido.toLowerCase()}, crânio ${formatoCabecaResolvido.toLowerCase()} e fio ${tipoCabelo.toLowerCase()} ${comprimentoResolvido.toLowerCase()}: há perda de proporção ou encaixe técnico neste estilo.`;
  } else {
    motivo = `Boa harmonia técnica: a estrutura do rosto ${formatoRostoResolvido.toLowerCase()} e o crânio ${formatoCabecaResolvido.toLowerCase()} equilibram bem com o comportamento do cabelo ${tipoCabelo.toLowerCase()} (${comprimentoResolvido.toLowerCase()}).`;
  }

  return {
    diagnostico,
    formatoRostoResolvido,
    formatoCabecaResolvido,
    comprimentoResolvido,
    indiceGeral: indiceFinal,
    motivo,
  };
}

/**
 * Diagnóstico binário estritamente por entrada de dados (sem captura ou processamento de imagens).
 * Retorna apenas resultado positivo (verde) ou negativo (vermelho).
 */
export function diagnosticarVisagismoBinario(
  entrada: EntradaVisagismoDados
): DiagnosticoVisagismoBinario {
  return avaliarVisagismoCompleto(entrada).diagnostico;
}
