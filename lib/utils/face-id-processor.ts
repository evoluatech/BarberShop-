import {VIRTUAL_HAIRSTYLE_PRESETS} from '@/lib/data/seed';
import {STYLE_VISAGISM_REFERENCES} from '@/lib/data/visagism-references';
import {
  CranialShapeCategory,
  FaceShape,
  FacialMeasurements,
  HairLengthCategory,
  HairType,
  VirtualHairstyleId,
  VirtualTryOnAnalysis,
  VisagismVerdict,
} from '@/lib/types/domain';
import {
  avaliarVisagismoCompleto,
  FORMATOS_CRANIO_VALIDOS,
} from '@/lib/utils/visagismo';

export const VALID_CRANIAL_SHAPES: readonly CranialShapeCategory[] =
  FORMATOS_CRANIO_VALIDOS;

const CRANIAL_SHAPE_SET = new Set<CranialShapeCategory>(VALID_CRANIAL_SHAPES);

export interface FaceIdDataInput {
  styleId: VirtualHairstyleId;
  faceShape?: FaceShape;
  facialMeasurements?: FacialMeasurements;
  hairType?: HairType;
  hairLength?: HairLengthCategory;
}

const FACE_SHAPE_GUIDANCE: Record<
  FaceShape,
  {geometry: string; hairlineTip: string; sideStrategy: string}
> = {
  Oval: {
    geometry: 'Proporção naturalmente equilibrada entre testa, maçãs do rosto e mandíbula.',
    hairlineTip: 'Permite acabamento frontal limpo ou levemente desfiado com liberdade de altura.',
    sideStrategy: 'Mantém transição suave nas têmporas sem alongar demais o topo.',
  },
  Quadrado: {
    geometry: 'Maxilar e testa marcados com ângulos laterais definidos.',
    hairlineTip: 'Linha frontal reta reforça presença; topo levemente desconectado suaviza quinas.',
    sideStrategy: 'Laterais bem alinhadas valorizam o desenho natural da mandíbula.',
  },
  Redondo: {
    geometry: 'Largura das bochechas próxima à altura facial, com contornos suaves.',
    hairlineTip: 'Evite franja pesada reta; volume vertical controlado no topo alonga o rosto.',
    sideStrategy: 'Laterais mais baixas e limpas afinam a silhueta lateral.',
  },
  Diamante: {
    geometry: 'Maçãs do rosto destacadas com testa e queixo ligeiramente mais estreitos.',
    hairlineTip: 'Textura frontal com movimento ajuda a ampliar visualmente a região da testa.',
    sideStrategy: 'Preservar leve preenchimento nas têmporas equilibra o contorno.',
  },
  Triangular: {
    geometry: 'Mandíbula mais larga em relação à testa e têmporas.',
    hairlineTip: 'Volume moderado no topo e nas têmporas traz proporção ao terço superior.',
    sideStrategy: 'Evitar raspar alto demais nas têmporas para não estreitar a testa.',
  },
  Alongado: {
    geometry: 'Comprimento vertical predominante em relação à largura das maçãs.',
    hairlineTip: 'Franja leve ou topo com altura moderada evita alongar ainda mais o rosto.',
    sideStrategy: 'Deixar um pouco mais de corpo nas laterais cria equilíbrio horizontal.',
  },
};

const HAIR_TYPE_NOTES: Record<HairType, {volume: string; finishTip: string}> = {
  Liso: {
    volume: 'Caimento linear e menor volume lateral natural; pede texturização para não pesar.',
    finishTip: 'Usar tesoura dentada ou pontilhada no topo para dar movimento e encaixe.',
  },
  Ondulado: {
    volume: 'Movimento em "S" versátil com bom volume natural no topo e encaixe fácil.',
    finishTip: 'Respeitar as ondas naturais nas conexões para evitar pontas arrepiadas.',
  },
  Cacheado: {
    volume: 'Volume concentrado e definição em espiral que destaca o contraste com laterais limpas.',
    finishTip: 'Ajustar o comprimento considerando o fator encolhimento após secar.',
  },
  Crespo: {
    volume: 'Estrutura firme e ótimo poder de contorno geométrico e degradês de alto contraste.',
    finishTip: 'Trabalhar o contorno na máquina/tesoura a seco para precisão milimétrica.',
  },
};

const CRANIAL_NOTES: Record<CranialShapeCategory, {cranialNote: string; tip: string}> = {
  Equilibrado: {
    cranialNote: 'Estrutura craniana equilibrada entre parietal, topo e nuca.',
    tip: 'Seguir graduação natural acompanhando a curvatura parietal.',
  },
  'Topo alongado': {
    cranialNote: 'Coroa e topo com projeção vertical mais alta.',
    tip: 'Controlar altura do topo e preservar leve corpo nas laterais.',
  },
  'Laterais largas': {
    cranialNote: 'Parietais mais largos exigindo controle de volume lateral.',
    tip: 'Reduzir o peso nas têmporas com degradê limpo e evitar excesso lateral.',
  },
  'Occipital proeminente': {
    cranialNote: 'Nuca/occipital proeminente requerendo transição bem graduada atrás.',
    tip: 'Suavizar a transição na região da nuca na tesoura sem marcar degraus no osso occipital.',
  },
};

function sanitizeCmValue(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value < 6 || value > 35) return undefined;
  return Math.round(value * 10) / 10;
}

/**
 * Valida e normaliza entradas numéricas de medidas faciais (cm) e formato craniano.
 */
export function sanitizeFacialMeasurements(
  raw: unknown
): FacialMeasurements | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  const obj = raw as Record<string, unknown>;
  const faceLengthCm = sanitizeCmValue(obj.faceLengthCm);
  const cheekboneWidthCm = sanitizeCmValue(obj.cheekboneWidthCm);
  const jawWidthCm = sanitizeCmValue(obj.jawWidthCm);
  const foreheadWidthCm = sanitizeCmValue(obj.foreheadWidthCm);
  const cranialShape =
    typeof obj.cranialShape === 'string' &&
    CRANIAL_SHAPE_SET.has(obj.cranialShape as CranialShapeCategory)
      ? (obj.cranialShape as CranialShapeCategory)
      : undefined;

  if (
    faceLengthCm === undefined &&
    cheekboneWidthCm === undefined &&
    jawWidthCm === undefined &&
    foreheadWidthCm === undefined &&
    cranialShape === undefined
  ) {
    return undefined;
  }

  return {
    faceLengthCm,
    cheekboneWidthCm,
    jawWidthCm,
    foreheadWidthCm,
    cranialShape,
  };
}

/**
 * Calcula proporções faciais reais em cm para classificar o formato do rosto sem imagens.
 */
export function deriveFaceShapeFromMeasurements(
  measurements: FacialMeasurements
): {
  faceShape: FaceShape;
  measurementSummary: string;
} | null {
  const {faceLengthCm, cheekboneWidthCm, jawWidthCm, foreheadWidthCm} = measurements;
  const referenceWidth = cheekboneWidthCm ?? foreheadWidthCm ?? jawWidthCm;
  if (!faceLengthCm || !referenceWidth) {
    return null;
  }

  const lengthToWidthRatio = Number((faceLengthCm / referenceWidth).toFixed(2));
  const jaw = jawWidthCm ?? referenceWidth * 0.85;
  const forehead = foreheadWidthCm ?? referenceWidth * 0.9;
  const jawToWidthRatio = Number((jaw / referenceWidth).toFixed(2));
  const foreheadToJawRatio = Number((forehead / jaw).toFixed(2));

  let faceShape: FaceShape = 'Oval';
  if (lengthToWidthRatio >= 1.52) {
    faceShape = 'Alongado';
  } else if (
    jawToWidthRatio >= 0.9 &&
    foreheadToJawRatio >= 0.88 &&
    foreheadToJawRatio <= 1.12 &&
    lengthToWidthRatio <= 1.38
  ) {
    faceShape = 'Quadrado';
  } else if (lengthToWidthRatio <= 1.24 && jawToWidthRatio < 0.88) {
    faceShape = 'Redondo';
  } else if (jaw > forehead * 1.12) {
    faceShape = 'Triangular';
  } else if (
    cheekboneWidthCm &&
    cheekboneWidthCm > forehead * 1.09 &&
    cheekboneWidthCm > jaw * 1.11
  ) {
    faceShape = 'Diamante';
  }

  const measurementSummary = `Medidas informadas: altura ${faceLengthCm} cm · largura ${referenceWidth} cm (proporção ${lengthToWidthRatio}x${jawWidthCm ? ` · mandíbula ${jawWidthCm} cm` : ''}) -> perfil ${faceShape}.`;

  return {
    faceShape,
    measurementSummary,
  };
}

/**
 * Utilitário puro de processamento de dados para Face ID sem uso de imagens:
 * usa o motor técnico unificado de visagismo para retornar diagnóstico e recomendações.
 */
export function processFaceIdData(input: FaceIdDataInput): VirtualTryOnAnalysis {
  const preset =
    VIRTUAL_HAIRSTYLE_PRESETS.find((p) => p.id === input.styleId) ??
    VIRTUAL_HAIRSTYLE_PRESETS[0];

  const cleanMeasurements = sanitizeFacialMeasurements(input.facialMeasurements);
  const derivedFromMetrics = cleanMeasurements
    ? deriveFaceShapeFromMeasurements(cleanMeasurements)
    : null;

  const resolvedHairType: HairType = input.hairType ?? 'Ondulado';
  const resolvedHairLength: HairLengthCategory = input.hairLength ?? 'Médio';

  const avaliacao = avaliarVisagismoCompleto({
    styleId: preset.id,
    tipoCabelo: resolvedHairType,
    formatoRosto: derivedFromMetrics?.faceShape ?? input.faceShape ?? 'Oval',
    formatoCabeca: cleanMeasurements?.cranialShape,
    comprimentoCabelo: resolvedHairLength,
    medidasBasicas: cleanMeasurements
      ? {
          alturaRostoCm: cleanMeasurements.faceLengthCm,
          larguraMacasCm: cleanMeasurements.cheekboneWidthCm,
          larguraMandibulaCm: cleanMeasurements.jawWidthCm,
          larguraTestaCm: cleanMeasurements.foreheadWidthCm,
          formatoCabeca: cleanMeasurements.cranialShape,
        }
      : undefined,
  });

  const resolvedFaceShape = avaliacao.formatoRostoResolvido;
  const resolvedCranialShape = avaliacao.formatoCabecaResolvido;
  const isSuccess = avaliacao.diagnostico.resultado === 'positivo';
  const overallScore = isSuccess
    ? Math.max(76, avaliacao.indiceGeral)
    : Math.min(68, avaliacao.indiceGeral);

  let verdictStatus: VisagismVerdict = 'Altamente recomendado';
  let compatibilityLabel: VirtualTryOnAnalysis['compatibilityLabel'] =
    'Alta compatibilidade';
  let riskWarning: string | undefined;

  if (!isSuccess && resolvedHairLength === 'Raspado / Muito curto') {
    verdictStatus = 'Exige crescimento prévio';
    compatibilityLabel = 'Compatibilidade adaptável';
    riskWarning = avaliacao.motivo;
  } else if (!isSuccess) {
    verdictStatus = 'Risco estético — avalie alternativas';
    compatibilityLabel = 'Baixa compatibilidade';
    riskWarning = avaliacao.motivo;
  } else if (overallScore < 85) {
    verdictStatus = 'Recomendado com adaptações';
    compatibilityLabel = 'Boa compatibilidade';
  }

  const diagnosticOutcome: 'sucesso' | 'falha' = isSuccess ? 'sucesso' : 'falha';
  const binaryDiagnosis: 'positivo' | 'negativo' = isSuccess ? 'positivo' : 'negativo';

  const betterAlternativeStyleId: VirtualHairstyleId | undefined = !isSuccess
    ? resolvedHairType === 'Crespo' ||
      resolvedFaceShape === 'Redondo' ||
      resolvedCranialShape === 'Laterais largas'
      ? 'corte-degrade'
      : resolvedHairLength === 'Médio' || resolvedHairLength === 'Longo'
        ? 'corte-tesoura'
        : 'corte-social'
    : undefined;

  const faceInfo = FACE_SHAPE_GUIDANCE[resolvedFaceShape];
  const hairInfo = HAIR_TYPE_NOTES[resolvedHairType];
  const cranialInfo = CRANIAL_NOTES[resolvedCranialShape];
  const involvesBeard =
    preset.id === 'barba-desenhada' ||
    preset.id === 'combo-corte-barba' ||
    preset.id === 'corte-barba-sobrancelha';

  const cranialGeometryText = `${cranialInfo.cranialNote} ${faceInfo.geometry}`;
  const suggestedAdjustments = [
    cranialInfo.tip,
    hairInfo.finishTip,
    faceInfo.hairlineTip,
  ];

  const lengthSufficiencyScore =
    resolvedHairLength === 'Raspado / Muito curto'
      ? 35
      : resolvedHairLength === 'Curto' && preset.id === 'corte-tesoura'
        ? 44
        : 90;

  const styleRef = STYLE_VISAGISM_REFERENCES[preset.id];

  return {
    faceShape: resolvedFaceShape,
    detectedCranialShape: resolvedCranialShape,
    cranialGeometry: cranialGeometryText,
    detectedHairType: resolvedHairType,
    detectedHairLength: resolvedHairLength,
    hairlineObservation: faceInfo.hairlineTip,
    apparentVolume: `${hairInfo.volume} Comprimento informado: ${resolvedHairLength.toLowerCase()}.`,
    estimatedLength: resolvedHairLength,
    visualTexture: `Fios do tipo ${resolvedHairType.toLowerCase()}.`,
    facialProportions: derivedFromMetrics
      ? derivedFromMetrics.measurementSummary
      : `Rosto ${resolvedFaceShape.toLowerCase()} · ${faceInfo.sideStrategy}`,
    beardObservation: involvesBeard
      ? `Alinhamento da linha da bochecha e pescoço ajustado para valorizar o formato ${resolvedFaceShape.toLowerCase()}.`
      : 'Serviço focado no corte; combine com barba desenhada se desejar definir mais o maxilar.',
    referenceComparison: avaliacao.motivo,
    matchedReferenceRules: isSuccess
      ? styleRef.greenCriteria.slice(0, 2)
      : [avaliacao.motivo, ...styleRef.redContraindications.slice(0, 1)],
    compatibilityLabel,
    compatibilitySummary: `Diagnóstico ${diagnosticOutcome.toUpperCase()} (${overallScore}%): ${avaliacao.motivo}`,
    howItWillLookOnYou: `No seu perfil (rosto ${resolvedFaceShape.toLowerCase()}, crânio ${resolvedCranialShape.toLowerCase()} e cabelo ${resolvedHairType.toLowerCase()} ${resolvedHairLength.toLowerCase()}), o ${preset.name} apresenta este comportamento técnico: ${preset.finishNote} ${avaliacao.motivo}`,
    barberRecommendation: `Peça ao barbeiro para adaptar a altura das laterais ao seu rosto ${resolvedFaceShape.toLowerCase()} e crânio ${resolvedCranialShape.toLowerCase()}, respeitando o fio ${resolvedHairType.toLowerCase()}.`,
    calculations: {
      diagnosticOutcome,
      binaryDiagnosis,
      overallScore,
      headShapeFitScore: overallScore,
      hairTextureFitScore: overallScore,
      lengthSufficiencyScore,
      measurementSummary: derivedFromMetrics?.measurementSummary,
      verdictStatus,
      riskWarning,
      suggestedAdjustments,
      betterAlternativeStyleId:
        betterAlternativeStyleId && betterAlternativeStyleId !== preset.id
          ? betterAlternativeStyleId
          : undefined,
    },
    source: 'manual_profile',
  };
}
