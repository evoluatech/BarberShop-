import {GoogleGenAI, ThinkingLevel, Type} from '@google/genai';
import {NextRequest, NextResponse} from 'next/server';
import {VIRTUAL_HAIRSTYLE_PRESETS} from '@/lib/data/seed';
import {
  FaceAlignmentMetrics,
  FaceShape,
  HairLengthCategory,
  HairType,
  VirtualHairstyleId,
  VirtualTryOnAnalysis,
  VisagismVerdict,
} from '@/lib/types/domain';
import {computeManualVisagism} from '@/lib/utils/visagism';

function clamp(num: unknown, min: number, max: number, fallback: number): number {
  if (typeof num !== 'number' || Number.isNaN(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function clampInt(num: unknown, min: number, max: number, fallback: number): number {
  return Math.round(clamp(num, min, max, fallback));
}

function sanitizeHexColor(hex: unknown): string {
  if (typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex.trim())) {
    return hex.trim();
  }
  return '#1F1A17';
}

const VALID_FACE_SHAPES = new Set<FaceShape>([
  'Oval',
  'Quadrado',
  'Redondo',
  'Diamante',
  'Triangular',
  'Alongado',
]);
const VALID_HAIR_TYPES = new Set<HairType>(['Liso', 'Ondulado', 'Cacheado', 'Crespo']);
const VALID_HAIR_LENGTHS = new Set<HairLengthCategory>([
  'Raspado / Muito curto',
  'Curto',
  'Médio',
  'Longo',
]);

export async function POST(req: NextRequest) {
  let body: {
    imageBase64?: string;
    mimeType?: string;
    styleId?: VirtualHairstyleId;
    mode?: 'vision' | 'manual';
    manualFaceShape?: FaceShape;
    manualHairType?: HairType;
    manualHairLength?: HairLengthCategory;
  };
  try {
    body = (await req.json()) ?? {};
  } catch {
    return NextResponse.json(
      {error: 'Requisição JSON inválida para análise.'},
      {status: 400, headers: {'Cache-Control': 'no-store'}}
    );
  }

  try {
    const {
      imageBase64,
      mimeType,
      styleId,
      mode,
      manualFaceShape,
      manualHairType,
      manualHairLength,
    } = body;

    const chosenStyleId: VirtualHairstyleId =
      styleId && VIRTUAL_HAIRSTYLE_PRESETS.some((p) => p.id === styleId)
        ? styleId
        : 'corte-degrade';

    if (mode === 'manual' && !imageBase64) {
      const safeFaceShape: FaceShape =
        manualFaceShape && VALID_FACE_SHAPES.has(manualFaceShape)
          ? manualFaceShape
          : 'Oval';
      const safeHairType: HairType =
        manualHairType && VALID_HAIR_TYPES.has(manualHairType)
          ? manualHairType
          : 'Ondulado';
      const safeHairLength: HairLengthCategory =
        manualHairLength && VALID_HAIR_LENGTHS.has(manualHairLength)
          ? manualHairLength
          : 'Médio';

      return NextResponse.json(
        {
          analysis: computeManualVisagism({
            styleId: chosenStyleId,
            faceShape: safeFaceShape,
            hairType: safeHairType,
            hairLength: safeHairLength,
          }),
        },
        {headers: {'Cache-Control': 'no-store'}}
      );
    }

    if (!imageBase64) {
      return NextResponse.json(
        {
          error:
            'Nenhum quadro ao vivo da câmera foi recebido. Centralize o rosto no scanner Face ID e tente novamente.',
        },
        {status: 400, headers: {'Cache-Control': 'no-store'}}
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'O serviço de análise por inteligência artificial não está configurado neste ambiente (chave de API ausente).',
        },
        {status: 503, headers: {'Cache-Control': 'no-store'}}
      );
    }

    const preset =
      VIRTUAL_HAIRSTYLE_PRESETS.find((p) => p.id === chosenStyleId) ??
      VIRTUAL_HAIRSTYLE_PRESETS[0];

    const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const detectedMimeMatch =
      typeof imageBase64 === 'string'
        ? imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/)
        : null;
    const resolvedMimeType = detectedMimeMatch?.[1] || mimeType || 'image/jpeg';

    if (!allowedMimeTypes.has(resolvedMimeType)) {
      return NextResponse.json(
        {error: 'Formato de quadro de vídeo não suportado para análise.'},
        {status: 400, headers: {'Cache-Control': 'no-store'}}
      );
    }

    if (typeof imageBase64 !== 'string' || imageBase64.length > 2_800_000) {
      return NextResponse.json(
        {error: 'Quadro de vídeo excede o tamanho máximo permitido para leitura.'},
        {status: 413, headers: {'Cache-Control': 'no-store'}}
      );
    }

    const cleanBase64 = imageBase64
      .replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '')
      .trim();
    if (!cleanBase64 || cleanBase64.length < 32) {
      return NextResponse.json(
        {error: 'Quadro de vídeo inválido ou vazio para leitura Face ID.'},
        {status: 400, headers: {'Cache-Control': 'no-store'}}
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const promptText = `Você é um especialista sênior em visagismo masculino, tricologia visual e barbearia técnica.
Analise RIGOROSAMENTE a leitura ao vivo da câmera (Face ID) do cliente para avaliar o corte "${preset.name}" (${preset.subtitle}).

INSTRUÇÕES CRÍTICAS DE HONESTIDADE E PRECISÃO (NUNCA INVENTE OU ADIVINHE DADOS FALSOS):
1. Verifique primeiro se há uma pessoa com cabeça e cabelo suficientemente visíveis (sem boné/touca cobrindo tudo, sem escuridão extrema). Se não estiver claro, marque imageQualityOk=false e explique exatamente o que ajustar em imageQualityMessage.
2. Analise visualmente no frame ao vivo:
   - Formato real da cabeça e do rosto (Oval, Quadrado, Redondo, Diamante, Triangular ou Alongado) e geometria craniana (cranialGeometry: largura das têmporas, topo/coroa, projeção da testa e mandíbula).
   - Tipo real de cabelo visível (detectedHairType: Liso, Ondulado, Cacheado ou Crespo).
   - Comprimento real atual visível (detectedHairLength: "Raspado / Muito curto", "Curto", "Médio" ou "Longo"), observando topo, laterais e entradas/linha frontal.
   - Barba atual (beardObservation) — especialmente importante se o estilo envolve barba.
3. Faça um CÁLCULO REAL DE COMPATIBILIDADE (0 a 100) considerando o estilo "${preset.name}":
   - headShapeFitScore: quanto esse corte equilibra as proporções reais do crânio e rosto da pessoa.
   - hairTextureFitScore: quanto o tipo de fio real da pessoa (liso/ondulado/cacheado/crespo) sustenta o caimento natural desse corte.
   - lengthSufficiencyScore: quanto o comprimento ATUAL do cabelo permite fazer esse corte hoje (ex.: se o cabelo está raspado e o cliente escolheu Corte na Tesoura, lengthSufficiencyScore deve ser BAIXO, ex: 20-40, e verdictStatus = "Exige crescimento prévio"!).
   - overallScore: média ponderada coerente desses três fatores.
   - riskWarning: seja 100% sincero sobre riscos reais ("para não dar ruim") — se o cabelo está curto demais, se há entradas, se o volume lateral pode alargar um rosto redondo, ou se o fio crespo/liso exige técnica específica. Se não houver risco relevante, deixe string vazia "".
   - howItWillLookOnYou: descreva em detalhes reais como esse corte especificamente vai assentar na cabeça, contorno e fio dessa pessoa.
   - suggestedAdjustments: lista de 2 a 3 ajustes técnicos concretos para o barbeiro adaptar o corte sem erro.
   - betterAlternativeStyleId: se overallScore < 75, indique o ID alternativo mais adequado entre ('corte-degrade', 'corte-social', 'corte-tesoura', 'barba-desenhada', 'combo-corte-barba', 'corte-barba-sobrancelha'); caso contrário retorne "".
4. Estime com precisão as coordenadas normalizadas (0.0 a 1.0) da cabeça para referência anatômica:
   - centerX, topY (topo do crânio/cabelo), hairlineY (início da testa/raiz frontal), templeLeftX, templeRightX, earY (altura das orelhas), jawLeftX, jawRightX, chinY (base do queixo), widthRatio, e hairColorHex (cor hexadecimal real dos fios, ex: "#231B18").

Responda exclusivamente em português do Brasil claro, técnico e honesto.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: resolvedMimeType,
              data: cleanBase64,
            },
          },
          {text: promptText},
        ],
      },
      config: {
        thinkingConfig: {thinkingLevel: ThinkingLevel.MEDIUM},
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            imageQualityOk: {type: Type.BOOLEAN},
            imageQualityMessage: {type: Type.STRING},
            faceShape: {
              type: Type.STRING,
              enum: [
                'Oval',
                'Quadrado',
                'Redondo',
                'Diamante',
                'Triangular',
                'Alongado',
              ],
            },
            cranialGeometry: {type: Type.STRING},
            detectedHairType: {
              type: Type.STRING,
              enum: ['Liso', 'Ondulado', 'Cacheado', 'Crespo'],
            },
            detectedHairLength: {
              type: Type.STRING,
              enum: ['Raspado / Muito curto', 'Curto', 'Médio', 'Longo'],
            },
            hairlineObservation: {type: Type.STRING},
            apparentVolume: {type: Type.STRING},
            estimatedLength: {type: Type.STRING},
            visualTexture: {type: Type.STRING},
            facialProportions: {type: Type.STRING},
            beardObservation: {type: Type.STRING},
            compatibilityLabel: {
              type: Type.STRING,
              enum: [
                'Alta compatibilidade',
                'Boa compatibilidade',
                'Compatibilidade adaptável',
                'Baixa compatibilidade',
              ],
            },
            compatibilitySummary: {type: Type.STRING},
            howItWillLookOnYou: {type: Type.STRING},
            barberRecommendation: {type: Type.STRING},
            overallScore: {type: Type.NUMBER},
            headShapeFitScore: {type: Type.NUMBER},
            hairTextureFitScore: {type: Type.NUMBER},
            lengthSufficiencyScore: {type: Type.NUMBER},
            verdictStatus: {
              type: Type.STRING,
              enum: [
                'Altamente recomendado',
                'Recomendado com adaptações',
                'Exige crescimento prévio',
                'Risco estético — avalie alternativas',
              ],
            },
            riskWarning: {type: Type.STRING},
            suggestedAdjustments: {
              type: Type.ARRAY,
              items: {type: Type.STRING},
            },
            betterAlternativeStyleId: {type: Type.STRING},
            centerX: {type: Type.NUMBER},
            topY: {type: Type.NUMBER},
            hairlineY: {type: Type.NUMBER},
            templeLeftX: {type: Type.NUMBER},
            templeRightX: {type: Type.NUMBER},
            earY: {type: Type.NUMBER},
            jawLeftX: {type: Type.NUMBER},
            jawRightX: {type: Type.NUMBER},
            chinY: {type: Type.NUMBER},
            widthRatio: {type: Type.NUMBER},
            hairColorHex: {type: Type.STRING},
          },
          required: [
            'imageQualityOk',
            'faceShape',
            'cranialGeometry',
            'detectedHairType',
            'detectedHairLength',
            'hairlineObservation',
            'apparentVolume',
            'estimatedLength',
            'visualTexture',
            'facialProportions',
            'beardObservation',
            'compatibilityLabel',
            'compatibilitySummary',
            'howItWillLookOnYou',
            'barberRecommendation',
            'overallScore',
            'headShapeFitScore',
            'hairTextureFitScore',
            'lengthSufficiencyScore',
            'verdictStatus',
            'suggestedAdjustments',
            'centerX',
            'topY',
            'hairlineY',
            'templeLeftX',
            'templeRightX',
            'earY',
            'jawLeftX',
            'jawRightX',
            'chinY',
            'widthRatio',
            'hairColorHex',
          ],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}') as {
      imageQualityOk?: boolean;
      imageQualityMessage?: string;
      faceShape?: FaceShape;
      cranialGeometry?: string;
      detectedHairType?: HairType;
      detectedHairLength?: HairLengthCategory;
      hairlineObservation?: string;
      apparentVolume?: string;
      estimatedLength?: string;
      visualTexture?: string;
      facialProportions?: string;
      beardObservation?: string;
      compatibilityLabel?: VirtualTryOnAnalysis['compatibilityLabel'];
      compatibilitySummary?: string;
      howItWillLookOnYou?: string;
      barberRecommendation?: string;
      overallScore?: number;
      headShapeFitScore?: number;
      hairTextureFitScore?: number;
      lengthSufficiencyScore?: number;
      verdictStatus?: VisagismVerdict;
      riskWarning?: string;
      suggestedAdjustments?: string[];
      betterAlternativeStyleId?: string;
      centerX?: number;
      topY?: number;
      hairlineY?: number;
      templeLeftX?: number;
      templeRightX?: number;
      earY?: number;
      jawLeftX?: number;
      jawRightX?: number;
      chinY?: number;
      widthRatio?: number;
      hairColorHex?: string;
    };

    const VALID_COMPATIBILITY_LABELS = new Set<
      VirtualTryOnAnalysis['compatibilityLabel']
    >([
      'Alta compatibilidade',
      'Boa compatibilidade',
      'Compatibilidade adaptável',
      'Baixa compatibilidade',
    ]);
    const VALID_VERDICTS = new Set<VisagismVerdict>([
      'Altamente recomendado',
      'Recomendado com adaptações',
      'Exige crescimento prévio',
      'Risco estético — avalie alternativas',
    ]);

    const centerX = clamp(parsed.centerX, 0.25, 0.75, 0.5);
    const widthRatio = clamp(parsed.widthRatio, 0.24, 0.74, 0.44);
    const halfW = widthRatio / 2;
    const topY = clamp(parsed.topY, 0.03, 0.38, 0.14);
    const hairlineY = clamp(parsed.hairlineY, topY + 0.04, 0.5, Math.max(0.24, topY + 0.08));
    const chinY = clamp(parsed.chinY, Math.max(0.48, hairlineY + 0.24), 0.94, 0.72);
    const earY = clamp(parsed.earY, hairlineY + 0.04, chinY - 0.08, 0.47);

    const faceAlignment: FaceAlignmentMetrics = {
      centerX,
      topY,
      hairlineY,
      templeLeftX: clamp(parsed.templeLeftX, 0.1, centerX - 0.05, centerX - halfW),
      templeRightX: clamp(parsed.templeRightX, centerX + 0.05, 0.9, centerX + halfW),
      earY,
      jawLeftX: clamp(parsed.jawLeftX, 0.14, centerX - 0.04, centerX - halfW * 0.88),
      jawRightX: clamp(parsed.jawRightX, centerX + 0.04, 0.86, centerX + halfW * 0.88),
      chinY,
      widthRatio,
      hairColorHex: sanitizeHexColor(parsed.hairColorHex),
    };

    const validAlternative = VIRTUAL_HAIRSTYLE_PRESETS.some(
      (p) => p.id === parsed.betterAlternativeStyleId
    )
      ? (parsed.betterAlternativeStyleId as VirtualHairstyleId)
      : undefined;

    const safeFaceShape =
      parsed.faceShape && VALID_FACE_SHAPES.has(parsed.faceShape)
        ? parsed.faceShape
        : 'Oval';
    const safeHairType =
      parsed.detectedHairType && VALID_HAIR_TYPES.has(parsed.detectedHairType)
        ? parsed.detectedHairType
        : 'Ondulado';
    const safeHairLength =
      parsed.detectedHairLength && VALID_HAIR_LENGTHS.has(parsed.detectedHairLength)
        ? parsed.detectedHairLength
        : 'Médio';
    const safeCompatibilityLabel =
      parsed.compatibilityLabel &&
      VALID_COMPATIBILITY_LABELS.has(parsed.compatibilityLabel)
        ? parsed.compatibilityLabel
        : 'Boa compatibilidade';
    const safeVerdict =
      parsed.verdictStatus && VALID_VERDICTS.has(parsed.verdictStatus)
        ? parsed.verdictStatus
        : 'Recomendado com adaptações';

    const analysis: VirtualTryOnAnalysis = {
      imageQualityOk: parsed.imageQualityOk !== false,
      imageQualityMessage: parsed.imageQualityMessage || undefined,
      faceShape: safeFaceShape,
      cranialGeometry:
        parsed.cranialGeometry ||
        'Geometria craniana avaliada pela visão computacional.',
      detectedHairType: safeHairType,
      detectedHairLength: safeHairLength,
      hairlineObservation:
        parsed.hairlineObservation || 'Linha frontal analisada na foto.',
      apparentVolume: parsed.apparentVolume || 'Volume avaliado pela textura visível.',
      estimatedLength: parsed.estimatedLength || 'Comprimento estimado pela foto.',
      visualTexture: parsed.visualTexture || 'Textura identificada na captura.',
      facialProportions: parsed.facialProportions || 'Proporções faciais medidas.',
      beardObservation: parsed.beardObservation || 'Contorno facial verificado.',
      compatibilityLabel: safeCompatibilityLabel,
      compatibilitySummary:
        parsed.compatibilitySummary || 'Análise visual concluída com sucesso.',
      howItWillLookOnYou:
        parsed.howItWillLookOnYou ||
        parsed.compatibilitySummary ||
        'Encaixe avaliado considerando o formato da sua cabeça e tipo de cabelo.',
      barberRecommendation:
        parsed.barberRecommendation ||
        'Mostre esta avaliação ao barbeiro para ajustar a altura do acabamento.',
      calculations: {
        overallScore: clampInt(parsed.overallScore, 0, 100, 78),
        headShapeFitScore: clampInt(parsed.headShapeFitScore, 0, 100, 80),
        hairTextureFitScore: clampInt(parsed.hairTextureFitScore, 0, 100, 78),
        lengthSufficiencyScore: clampInt(parsed.lengthSufficiencyScore, 0, 100, 75),
        verdictStatus: safeVerdict,
        riskWarning:
          parsed.riskWarning && parsed.riskWarning.trim().length > 0
            ? parsed.riskWarning.trim()
            : undefined,
        suggestedAdjustments:
          Array.isArray(parsed.suggestedAdjustments) &&
          parsed.suggestedAdjustments.length > 0
            ? parsed.suggestedAdjustments.slice(0, 4)
            : ['Adaptar altura lateral conforme o formato identificado.'],
        betterAlternativeStyleId:
          validAlternative && validAlternative !== chosenStyleId
            ? validAlternative
            : undefined,
      },
      faceAlignment,
      source: 'gemini_vision',
    };

    return NextResponse.json(
      {analysis},
      {headers: {'Cache-Control': 'no-store'}}
    );
  } catch (error) {
    console.error('Virtual try-on AI error:', error);
    return NextResponse.json(
      {
        error:
          'Não foi possível concluir a leitura ao vivo por inteligência artificial neste momento. Verifique sua conexão, ilumine bem o rosto e tente novamente.',
      },
      {status: 502, headers: {'Cache-Control': 'no-store'}}
    );
  }
}
