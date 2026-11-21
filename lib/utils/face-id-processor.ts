import {VIRTUAL_HAIRSTYLE_PRESETS} from '@/lib/data/seed';
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

export const VALID_CRANIAL_SHAPES: readonly CranialShapeCategory[] = [
  'Equilibrado',
  'Topo alongado',
  'Laterais largas',
  'Occipital proeminente',
];

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

const FACE_SHAPE_SCORES: Record<VirtualHairstyleId, Record<FaceShape, number>> = {
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

const HAIR_TEXTURE_SCORES: Record<VirtualHairstyleId, Record<HairType, number>> = {
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

const HAIR_LENGTH_SCORES: Record<
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

const CRANIAL_SHAPE_ADJUSTMENT: Record<
  CranialShapeCategory,
  {
    scoreDeltaByStyle: Partial<Record<VirtualHairstyleId, number>>;
    cranialNote: string;
    tip: string;
  }
> = {
  Equilibrado: {
    scoreDeltaByStyle: {},
    cranialNote: 'Estrutura craniana equilibrada entre parietal, topo e nuca.',
    tip: 'Seguir graduação natural acompanhando a curvatura parietal.',
  },
  'Topo alongado': {
    scoreDeltaByStyle: {
      'corte-degrade': -4,
      'corte-social': 2,
      'corte-tesoura': 3,
    },
    cranialNote: 'Coroa e topo com projeção vertical mais alta.',
    tip: 'Controlar altura do topo e preservar leve corpo nas laterais.',
  },
  'Laterais largas': {
    scoreDeltaByStyle: {
      'corte-degrade': 4,
      'combo-corte-barba': 2,
      'corte-tesoura': -8,
      'corte-social': -5,
    },
    cranialNote: 'Parietais mais largos exigindo controle de volume lateral.',
    tip: 'Subir levemente o degradê nas têmporas e afinar volume lateral.',
  },
  'Occipital proeminente': {
    scoreDeltaByStyle: {
      'corte-degrade': 2,
      'corte-tesoura': 2,
      'corte-social': -3,
    },
    cranialNote: 'Nuca/occipital proeminente requerendo transição bem graduada atrás.',
    tip: 'Suavizar a transição na região da nuca sem marcar degraus na linha occipital.',
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
 * aceita medidas faciais e/ou tipo de cabelo e retorna diagnóstico binário técnico.
 */
export function processFaceIdData(input: FaceIdDataInput): VirtualTryOnAnalysis {
  const preset =
    VIRTUAL_HAIRSTYLE_PRESETS.find((p) => p.id === input.styleId) ??
    VIRTUAL_HAIRSTYLE_PRESETS[0];

  const cleanMeasurements = sanitizeFacialMeasurements(input.facialMeasurements);
  const derivedFromMetrics = cleanMeasurements
    ? deriveFaceShapeFromMeasurements(cleanMeasurements)
    : null;

  const resolvedFaceShape: FaceShape =
    derivedFromMetrics?.faceShape ?? input.faceShape ?? 'Oval';
  const resolvedHairType: HairType = input.hairType ?? 'Ondulado';
  const resolvedHairLength: HairLengthCategory = input.hairLength ?? 'Médio';
  const cranialInfo = cleanMeasurements?.cranialShape
    ? CRANIAL_SHAPE_ADJUSTMENT[cleanMeasurements.cranialShape]
    : undefined;

  const baseHeadScore = FACE_SHAPE_SCORES[preset.id][resolvedFaceShape];
  const cranialDelta = cranialInfo?.scoreDeltaByStyle[preset.id] ?? 0;
  const headShapeFitScore = Math.max(
    0,
    Math.min(100, baseHeadScore + cranialDelta)
  );
  const hairTextureFitScore = HAIR_TEXTURE_SCORES[preset.id][resolvedHairType];
  const lengthSufficiencyScore = HAIR_LENGTH_SCORES[preset.id][resolvedHairLength];

  const overallScore = Math.round(
    headShapeFitScore * 0.38 +
      hairTextureFitScore * 0.34 +
      lengthSufficiencyScore * 0.28
  );

  let verdictStatus: VisagismVerdict = 'Altamente recomendado';
  let compatibilityLabel: VirtualTryOnAnalysis['compatibilityLabel'] =
    'Alta compatibilidade';
  let riskWarning: string | undefined;

  if (lengthSufficiencyScore < 55) {
    verdictStatus = 'Exige crescimento prévio';
    compatibilityLabel = 'Compatibilidade adaptável';
    riskWarning = `Com o cabelo atualmente ${resolvedHairLength.toLowerCase()}, falta comprimento no topo para estruturar o ${preset.name}. Cortar agora pode deixá-lo curto demais; o ideal é aguardar de 3 a 5 semanas de crescimento.`;
  } else if (overallScore < 75) {
    verdictStatus = 'Risco estético — avalie alternativas';
    compatibilityLabel = 'Baixa compatibilidade';
    riskWarning = `Para rosto ${resolvedFaceShape.toLowerCase()} com fios ${resolvedHairType.toLowerCase()}, este corte sem adaptação pode acentuar largura lateral ou perder definição no caimento.`;
  } else if (overallScore < 85) {
    verdictStatus = 'Recomendado com adaptações';
    compatibilityLabel = 'Boa compatibilidade';
  }

  const isSuccess =
    verdictStatus === 'Altamente recomendado' ||
    verdictStatus === 'Recomendado com adaptações';
  const diagnosticOutcome: 'sucesso' | 'falha' = isSuccess ? 'sucesso' : 'falha';
  const binaryDiagnosis: 'positivo' | 'negativo' = isSuccess ? 'positivo' : 'negativo';

  const betterAlternativeStyleId: VirtualHairstyleId | undefined =
    !isSuccess || overallScore < 78
      ? resolvedFaceShape === 'Redondo' || resolvedHairType === 'Crespo'
        ? 'corte-degrade'
        : 'corte-social'
      : undefined;

  const faceInfo = FACE_SHAPE_GUIDANCE[resolvedFaceShape];
  const hairInfo = HAIR_TYPE_NOTES[resolvedHairType];
  const involvesBeard =
    preset.id === 'barba-desenhada' ||
    preset.id === 'combo-corte-barba' ||
    preset.id === 'corte-barba-sobrancelha';

  const cranialGeometryText = cranialInfo
    ? `${cranialInfo.cranialNote} ${faceInfo.geometry}`
    : faceInfo.geometry;

  const suggestedAdjustments = [
    cranialInfo ? cranialInfo.tip : faceInfo.sideStrategy,
    hairInfo.finishTip,
    faceInfo.hairlineTip,
  ];

  return {
    faceShape: resolvedFaceShape,
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
    compatibilityLabel,
    compatibilitySummary: `Diagnóstico ${diagnosticOutcome.toUpperCase()} (${overallScore}%): considerando rosto ${resolvedFaceShape.toLowerCase()}, fio ${resolvedHairType.toLowerCase()} e comprimento ${resolvedHairLength.toLowerCase()}, o ${preset.name} ${isSuccess ? 'combina com o seu perfil' : 'apresenta restrições para este perfil'}.`,
    howItWillLookOnYou: `No seu perfil (rosto ${resolvedFaceShape.toLowerCase()} e cabelo ${resolvedHairType.toLowerCase()} ${resolvedHairLength.toLowerCase()}), o ${preset.name} apresenta este comportamento técnico: ${preset.finishNote} ${faceInfo.sideStrategy}`,
    barberRecommendation: `Peça ao barbeiro para adaptar a altura das laterais ao seu rosto ${resolvedFaceShape.toLowerCase()} e finalizar respeitando o fio ${resolvedHairType.toLowerCase()}.`,
    calculations: {
      diagnosticOutcome,
      binaryDiagnosis,
      overallScore,
      headShapeFitScore,
      hairTextureFitScore,
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
