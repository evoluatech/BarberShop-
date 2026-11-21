import {VIRTUAL_HAIRSTYLE_PRESETS} from '@/lib/data/seed';
import {
  FaceShape,
  HairLengthCategory,
  HairType,
  VirtualHairstyleId,
  VirtualTryOnAnalysis,
  VisagismVerdict,
} from '@/lib/types/domain';

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
    riskWarning = `Com o cabelo atualmente ${params.hairLength.toLowerCase()}, falta comprimento no topo para estruturar o ${preset.name}. Cortar agora pode deixá-lo curto demais; o ideal é aguardar de 3 a 5 semanas de crescimento.`;
  } else if (overallScore < 72) {
    verdictStatus = 'Risco estético — avalie alternativas';
    compatibilityLabel = 'Baixa compatibilidade';
    riskWarning = `Para rosto ${params.faceShape.toLowerCase()} com fios ${params.hairType.toLowerCase()}, este corte sem adaptação pode acentuar largura lateral ou perder definição no caimento.`;
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

  const faceInfo = FACE_SHAPE_GUIDANCE[params.faceShape];
  const hairInfo = HAIR_TYPE_NOTES[params.hairType];
  const involvesBeard =
    params.styleId === 'barba-desenhada' ||
    params.styleId === 'combo-corte-barba' ||
    params.styleId === 'corte-barba-sobrancelha';

  return {
    faceShape: params.faceShape,
    cranialGeometry: faceInfo.geometry,
    detectedHairType: params.hairType,
    detectedHairLength: params.hairLength,
    hairlineObservation: faceInfo.hairlineTip,
    apparentVolume: `${hairInfo.volume} Comprimento selecionado: ${params.hairLength.toLowerCase()}.`,
    estimatedLength: params.hairLength,
    visualTexture: `Fios do tipo ${params.hairType.toLowerCase()}.`,
    facialProportions: `Rosto ${params.faceShape.toLowerCase()} · ${faceInfo.sideStrategy}`,
    beardObservation: involvesBeard
      ? `Alinhamento da linha da bochecha e pescoço ajustado para valorizar o formato ${params.faceShape.toLowerCase()}.`
      : 'Serviço focado no corte; combine com barba desenhada se desejar definir mais o maxilar.',
    compatibilityLabel,
    compatibilitySummary: `Considerando rosto ${params.faceShape.toLowerCase()}, fio ${params.hairType.toLowerCase()} e comprimento ${params.hairLength.toLowerCase()}, o ${preset.name} alcança ${overallScore}% de compatibilidade.`,
    howItWillLookOnYou: `No seu perfil (rosto ${params.faceShape.toLowerCase()} e cabelo ${params.hairType.toLowerCase()} ${params.hairLength.toLowerCase()}), o ${preset.name} tende a ficar assim: ${preset.finishNote} ${faceInfo.sideStrategy}`,
    barberRecommendation: `Peça ao barbeiro para adaptar a altura das laterais ao seu rosto ${params.faceShape.toLowerCase()} e finalizar respeitando o fio ${params.hairType.toLowerCase()}.`,
    calculations: {
      overallScore,
      headShapeFitScore,
      hairTextureFitScore,
      lengthSufficiencyScore,
      verdictStatus,
      riskWarning,
      suggestedAdjustments: [
        faceInfo.sideStrategy,
        hairInfo.finishTip,
        faceInfo.hairlineTip,
      ],
      betterAlternativeStyleId:
        betterAlternativeStyleId && betterAlternativeStyleId !== params.styleId
          ? betterAlternativeStyleId
          : undefined,
    },
    source: 'manual_profile',
  };
}
