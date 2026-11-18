import {VIRTUAL_HAIRSTYLE_PRESETS} from '@/lib/data/seed';
import {
  FaceShape,
  HairLengthCategory,
  HairType,
  VirtualHairstyleId,
  VirtualTryOnAnalysis,
  VisagismVerdict,
} from '@/lib/types/domain';

export function computeManualVisagism(params: {
  styleId: VirtualHairstyleId;
  faceShape: FaceShape;
  hairType: HairType;
  hairLength: HairLengthCategory;
}): VirtualTryOnAnalysis {
  const preset =
    VIRTUAL_HAIRSTYLE_PRESETS.find((p) => p.id === params.styleId) ??
    VIRTUAL_HAIRSTYLE_PRESETS[0];

  const faceShapeScoreMap: Record<VirtualHairstyleId, Record<FaceShape, number>> = {
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

  const textureScoreMap: Record<VirtualHairstyleId, Record<HairType, number>> = {
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

  const lengthScoreMap: Record<
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

  const headShapeFitScore = faceShapeScoreMap[params.styleId][params.faceShape];
  const hairTextureFitScore = textureScoreMap[params.styleId][params.hairType];
  const lengthSufficiencyScore = lengthScoreMap[params.styleId][params.hairLength];

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
    riskWarning = `Com cabelo atualmente ${params.hairLength.toLowerCase()}, falta comprimento para estruturar ${preset.name}. Cortar agora pode deixar o topo ralo demais; aguarde 3 a 5 semanas de crescimento.`;
  } else if (overallScore < 72) {
    verdictStatus = 'Risco estético — avalie alternativas';
    compatibilityLabel = 'Baixa compatibilidade';
    riskWarning = `Para rosto ${params.faceShape.toLowerCase()} e fios ${params.hairType.toLowerCase()}, este corte sem adaptação pode acentuar largura ou perder definição no caimento.`;
  } else if (overallScore < 85) {
    verdictStatus = 'Recomendado com adaptações';
    compatibilityLabel = 'Boa compatibilidade';
  }

  const betterAlternativeStyleId: VirtualHairstyleId | undefined =
    overallScore < 78
      ? params.faceShape === 'Redondo' || params.hairType === 'Crespo'
        ? 'corte-degrade'
        : 'corte-social'
      : undefined;

  return {
    imageQualityOk: true,
    faceShape: params.faceShape,
    cranialGeometry: `Estimativa manual para rosto ${params.faceShape.toLowerCase()} (sem leitura por câmera).`,
    detectedHairType: params.hairType,
    detectedHairLength: params.hairLength,
    hairlineObservation:
      'Modo manual sem câmera — ative o Face ID ao vivo para leitura real da linha frontal.',
    apparentVolume: `Volume estimado para cabelo ${params.hairType.toLowerCase()} (${params.hairLength.toLowerCase()}).`,
    estimatedLength: params.hairLength,
    visualTexture: `Fios do tipo ${params.hairType.toLowerCase()}.`,
    facialProportions: `Simulação técnica para formato ${params.faceShape.toLowerCase()}.`,
    beardObservation: 'Não avaliada sem leitura pela câmera.',
    compatibilityLabel,
    compatibilitySummary: `No cálculo técnico para rosto ${params.faceShape.toLowerCase()} e cabelo ${params.hairType.toLowerCase()}, o estilo ${preset.name} atingiu ${overallScore}% de compatibilidade.`,
    howItWillLookOnYou: `Sem leitura pela câmera, esta é uma estimativa técnica: ${preset.finishNote} Ative o Face ID ao vivo para a IA medir o formato real da sua cabeça e seus fios.`,
    barberRecommendation: `Confirme com o barbeiro a altura ideal das laterais respeitando a textura ${params.hairType.toLowerCase()}.`,
    calculations: {
      overallScore,
      headShapeFitScore,
      hairTextureFitScore,
      lengthSufficiencyScore,
      verdictStatus,
      riskWarning,
      suggestedAdjustments: [
        `Respeitar a curvatura natural do fio ${params.hairType.toLowerCase()}.`,
        `Equilibrar laterais de acordo com o rosto ${params.faceShape.toLowerCase()}.`,
      ],
      betterAlternativeStyleId,
    },
    faceAlignment: {
      centerX: 0.5,
      topY: 0.14,
      hairlineY: 0.25,
      templeLeftX: 0.31,
      templeRightX: 0.69,
      earY: 0.48,
      jawLeftX: 0.34,
      jawRightX: 0.66,
      chinY: 0.72,
      widthRatio: 0.44,
      hairColorHex: '#1F1A17',
    },
    fallbackNote:
      'Cálculo feito no modo manual sem câmera. Para uma análise 100% real em tempo real, use o Face ID ao vivo.',
    source: 'manual_profile',
  };
}
