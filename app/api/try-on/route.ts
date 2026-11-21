import {GoogleGenAI, ThinkingLevel, Type} from '@google/genai';
import {NextRequest, NextResponse} from 'next/server';
import {VIRTUAL_HAIRSTYLE_PRESETS} from '@/lib/data/seed';
import {
  FaceShape,
  HairLengthCategory,
  HairType,
  VirtualHairstyleId,
  VirtualTryOnAnalysis,
  VisagismVerdict,
} from '@/lib/types/domain';
import {
  processFaceIdData,
  sanitizeFacialMeasurements,
} from '@/lib/utils/face-id-processor';

function clamp(num: unknown, min: number, max: number, fallback: number): number {
  if (typeof num !== 'number' || Number.isNaN(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function clampInt(num: unknown, min: number, max: number, fallback: number): number {
  return Math.round(clamp(num, min, max, fallback));
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
const VALID_STYLE_IDS = new Set<VirtualHairstyleId>(
  VIRTUAL_HAIRSTYLE_PRESETS.map((p) => p.id)
);

export async function POST(req: NextRequest) {
  let body: {
    imageBase64?: unknown;
    mimeType?: unknown;
    styleId?: unknown;
    mode?: unknown;
    manualFaceShape?: unknown;
    manualHairType?: unknown;
    manualHairLength?: unknown;
    facialMeasurements?: unknown;
  };
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json(
        {error: 'Corpo da requisição inválido para análise.'},
        {status: 400, headers: {'Cache-Control': 'no-store'}}
      );
    }
    body = parsed as typeof body;
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
      facialMeasurements,
    } = body;

    if (
      styleId !== undefined &&
      (typeof styleId !== 'string' || !VALID_STYLE_IDS.has(styleId as VirtualHairstyleId))
    ) {
      return NextResponse.json(
        {error: 'Estilo de corte selecionado é inválido.'},
        {status: 400, headers: {'Cache-Control': 'no-store'}}
      );
    }

    const chosenStyleId: VirtualHairstyleId =
      typeof styleId === 'string' && VALID_STYLE_IDS.has(styleId as VirtualHairstyleId)
        ? (styleId as VirtualHairstyleId)
        : 'corte-degrade';

    if (mode !== undefined && mode !== 'vision' && mode !== 'manual') {
      return NextResponse.json(
        {error: 'Modo de análise inválido.'},
        {status: 400, headers: {'Cache-Control': 'no-store'}}
      );
    }

    if (mode === 'manual' && !imageBase64) {
      if (
        manualFaceShape !== undefined &&
        (typeof manualFaceShape !== 'string' ||
          !VALID_FACE_SHAPES.has(manualFaceShape as FaceShape))
      ) {
        return NextResponse.json(
          {error: 'Formato de rosto informado é inválido.'},
          {status: 400, headers: {'Cache-Control': 'no-store'}}
        );
      }
      if (
        manualHairType !== undefined &&
        (typeof manualHairType !== 'string' ||
          !VALID_HAIR_TYPES.has(manualHairType as HairType))
      ) {
        return NextResponse.json(
          {error: 'Tipo de cabelo informado é inválido.'},
          {status: 400, headers: {'Cache-Control': 'no-store'}}
        );
      }
      if (
        manualHairLength !== undefined &&
        (typeof manualHairLength !== 'string' ||
          !VALID_HAIR_LENGTHS.has(manualHairLength as HairLengthCategory))
      ) {
        return NextResponse.json(
          {error: 'Comprimento de cabelo informado é inválido.'},
          {status: 400, headers: {'Cache-Control': 'no-store'}}
        );
      }

      if (
        facialMeasurements !== undefined &&
        (typeof facialMeasurements !== 'object' ||
          facialMeasurements === null ||
          Array.isArray(facialMeasurements))
      ) {
        return NextResponse.json(
          {error: 'Objeto de medidas faciais inválido.'},
          {status: 400, headers: {'Cache-Control': 'no-store'}}
        );
      }

      const cleanMeasurements = sanitizeFacialMeasurements(facialMeasurements);
      const safeFaceShape: FaceShape | undefined =
        typeof manualFaceShape === 'string'
          ? (manualFaceShape as FaceShape)
          : undefined;
      const safeHairType: HairType =
        typeof manualHairType === 'string' ? (manualHairType as HairType) : 'Ondulado';
      const safeHairLength: HairLengthCategory =
        typeof manualHairLength === 'string'
          ? (manualHairLength as HairLengthCategory)
          : 'Médio';

      return NextResponse.json(
        {
          analysis: processFaceIdData({
            styleId: chosenStyleId,
            faceShape: safeFaceShape,
            facialMeasurements: cleanMeasurements,
            hairType: safeHairType,
            hairLength: safeHairLength,
          }),
        },
        {headers: {'Cache-Control': 'no-store'}}
      );
    }

    if (typeof imageBase64 !== 'string' || !imageBase64.trim()) {
      return NextResponse.json(
        {
          error:
            'Nenhum quadro ao vivo da câmera foi recebido. Centralize o rosto no scanner Face ID ou use o cálculo pelos seus dados.',
        },
        {status: 400, headers: {'Cache-Control': 'no-store'}}
      );
    }

    const rawApiKey = process.env.GEMINI_API_KEY?.trim();
    const apiKey =
      rawApiKey && rawApiKey !== 'MY_GEMINI_API_KEY' ? rawApiKey : undefined;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'A leitura Face ID por IA não está disponível neste endereço (em links compartilhados o AI Studio não injeta a chave GEMINI_API_KEY). Abra no preview de desenvolvimento ou toque em "Ir para cálculo em dados agora".',
          code: 'GEMINI_KEY_UNAVAILABLE',
        },
        {status: 503, headers: {'Cache-Control': 'no-store'}}
      );
    }

    const preset =
      VIRTUAL_HAIRSTYLE_PRESETS.find((p) => p.id === chosenStyleId) ??
      VIRTUAL_HAIRSTYLE_PRESETS[0];

    const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const detectedMimeMatch = imageBase64.match(
      /^data:(image\/[a-zA-Z0-9.+-]+);base64,/
    );
    const resolvedMimeType =
      detectedMimeMatch?.[1] ||
      (typeof mimeType === 'string' ? mimeType : 'image/jpeg');

    if (!allowedMimeTypes.has(resolvedMimeType)) {
      return NextResponse.json(
        {error: 'Formato de quadro da câmera não suportado para análise.'},
        {status: 400, headers: {'Cache-Control': 'no-store'}}
      );
    }

    if (imageBase64.length > 2_800_000) {
      return NextResponse.json(
        {error: 'Quadro capturado excede o tamanho máximo permitido para leitura.'},
        {status: 413, headers: {'Cache-Control': 'no-store'}}
      );
    }

    const cleanBase64 = imageBase64
      .replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '')
      .trim();
    if (!cleanBase64 || cleanBase64.length < 32) {
      return NextResponse.json(
        {error: 'Quadro inválido ou vazio para leitura Face ID.'},
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
Analise RIGOROSAMENTE a leitura Face ID do cliente para avaliar em DADOS OBJETIVOS o corte "${preset.name}" (${preset.subtitle}).

INSTRUÇÕES CRÍTICAS DE HONESTIDADE E PRECISÃO (NUNCA INVENTE DADOS):
1. Verifique primeiro se há uma pessoa com rosto e cabelo suficientemente visíveis (sem boné/touca cobrindo tudo, sem escuridão extrema). Se não estiver visível o suficiente, marque imageQualityOk=false e explique claramente o que ajustar em imageQualityMessage.
2. Analise visualmente no quadro:
   - Formato do rosto (Oval, Quadrado, Redondo, Diamante, Triangular ou Alongado) e geometria craniana (cranialGeometry).
   - Tipo de cabelo visível (detectedHairType: Liso, Ondulado, Cacheado ou Crespo).
   - Comprimento atual visível (detectedHairLength: "Raspado / Muito curto", "Curto", "Médio" ou "Longo"), linha frontal/entradas (hairlineObservation), volume aparente (apparentVolume) e barba (beardObservation).
3. Calcule se DÁ BOM CORTE OU NÃO (0 a 100) para o estilo "${preset.name}":
   - headShapeFitScore: quanto esse corte equilibra o formato real do rosto e crânio.
   - hairTextureFitScore: quanto o tipo de fio real sustenta esse corte.
   - lengthSufficiencyScore: quanto o comprimento ATUAL permite fazer esse corte hoje (se estiver curto demais, dê nota baixa e verdictStatus = "Exige crescimento prévio").
   - overallScore: média ponderada coerente desses 3 fatores.
   - binaryDiagnosis: "positivo" quando o corte vai ficar bom/legal no perfil (overallScore >= 75 e comprimento suficiente), ou "negativo" quando não fica legal / há risco estético / falta comprimento.
   - compatibilitySummary: resumo direto dizendo se dá bom corte ou não e por quê.
   - riskWarning: seja 100% sincero sobre possíveis riscos (ex.: entradas, cabelo curto demais, laterais abrindo rosto redondo). Se não houver risco relevante, retorne string vazia "".
   - howItWillLookOnYou: explique em texto objetivo como esse corte vai assentar nesse formato de rosto e tipo de fio.
   - suggestedAdjustments: 2 a 3 ajustes técnicos objetivos para o barbeiro fazer.
   - betterAlternativeStyleId: se binaryDiagnosis = "negativo", indique o ID alternativo mais compatível entre ('corte-degrade', 'corte-social', 'corte-tesoura', 'barba-desenhada', 'combo-corte-barba', 'corte-barba-sobrancelha'); caso contrário retorne "".

Responda exclusivamente em português do Brasil claro, técnico e honesto.`;

    const schemaConfig = {
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
        binaryDiagnosis: {
          type: Type.STRING,
          enum: ['positivo', 'negativo'],
        },
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
        'binaryDiagnosis',
        'verdictStatus',
        'suggestedAdjustments',
      ],
    };

    const contentsPayload = {
      parts: [
        {
          inlineData: {
            mimeType: resolvedMimeType,
            data: cleanBase64,
          },
        },
        {text: promptText},
      ],
    };

    const callVisionModel = (model: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite') =>
      ai.models.generateContent({
        model,
        contents: contentsPayload,
        config: {
          thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
          responseMimeType: 'application/json',
          responseSchema: schemaConfig,
        },
      });

    const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
      new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(label)), ms);
        promise.then(
          (val) => {
            clearTimeout(timer);
            resolve(val);
          },
          (err) => {
            clearTimeout(timer);
            reject(err);
          }
        );
      });

    let response;
    try {
      response = await withTimeout(
        callVisionModel('gemini-4-hydrogen'),
        18000,
        'GEMINI_PRIMARY_TIMEOUT'
      );
    } catch (firstErr) {
      const firstStatus =
        typeof firstErr === 'object' && firstErr !== null && 'status' in firstErr
          ? Number((firstErr as {status?: unknown}).status)
          : 0;
      const firstMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
      const isTransient =
        firstStatus === 503 ||
        firstStatus === 500 ||
        firstMsg.includes('UNAVAILABLE') ||
        firstMsg.includes('503') ||
        firstMsg.includes('GEMINI_PRIMARY_TIMEOUT');
      if (!isTransient) {
        throw firstErr;
      }
      response = await withTimeout(
        callVisionModel('gemini-3.1-flash-lite'),
        18000,
        'GEMINI_FALLBACK_TIMEOUT'
      );
    }

    const cleanedResponseText = (response.text ?? '')
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let parsed: {
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
      binaryDiagnosis?: 'positivo' | 'negativo';
      verdictStatus?: VisagismVerdict;
      riskWarning?: string;
      suggestedAdjustments?: string[];
      betterAlternativeStyleId?: string;
    };
    try {
      parsed = JSON.parse(cleanedResponseText || '{}');
    } catch {
      throw new Error('GEMINI_INVALID_JSON_RESPONSE');
    }

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

    const safeHeadScore = clampInt(parsed.headShapeFitScore, 0, 100, 80);
    const safeTextureScore = clampInt(parsed.hairTextureFitScore, 0, 100, 78);
    const safeLengthScore = clampInt(parsed.lengthSufficiencyScore, 0, 100, 75);
    const rawOverallScore = clampInt(parsed.overallScore, 0, 100, 78);

    const hasNegativeSignal =
      parsed.binaryDiagnosis === 'negativo' ||
      rawOverallScore < 75 ||
      safeLengthScore < 55 ||
      safeVerdict === 'Exige crescimento prévio' ||
      safeVerdict === 'Risco estético — avalie alternativas';

    const normalizedBinaryDiagnosis: 'positivo' | 'negativo' = hasNegativeSignal
      ? 'negativo'
      : 'positivo';

    const normalizedOverallScore =
      normalizedBinaryDiagnosis === 'negativo' && rawOverallScore >= 75
        ? 68
        : rawOverallScore;

    const normalizedVerdictStatus: VisagismVerdict =
      normalizedBinaryDiagnosis === 'negativo' &&
      (safeVerdict === 'Altamente recomendado' ||
        safeVerdict === 'Recomendado com adaptações')
        ? safeLengthScore < 55
          ? 'Exige crescimento prévio'
          : 'Risco estético — avalie alternativas'
        : safeVerdict;

    const analysis: VirtualTryOnAnalysis = {
      imageQualityOk: parsed.imageQualityOk !== false,
      imageQualityMessage: parsed.imageQualityMessage || undefined,
      faceShape: safeFaceShape,
      cranialGeometry:
        parsed.cranialGeometry || 'Geometria craniana avaliada pelo Face ID.',
      detectedHairType: safeHairType,
      detectedHairLength: safeHairLength,
      hairlineObservation:
        parsed.hairlineObservation || 'Linha frontal avaliada pela leitura Face ID.',
      apparentVolume: parsed.apparentVolume || 'Volume avaliado pela textura dos fios.',
      estimatedLength: parsed.estimatedLength || safeHairLength,
      visualTexture: parsed.visualTexture || `Fio ${safeHairType.toLowerCase()}.`,
      facialProportions: parsed.facialProportions || `Rosto ${safeFaceShape.toLowerCase()}.`,
      beardObservation: parsed.beardObservation || 'Contorno facial verificado.',
      compatibilityLabel: safeCompatibilityLabel,
      compatibilitySummary:
        parsed.compatibilitySummary || 'Leitura Face ID concluída com sucesso.',
      howItWillLookOnYou:
        parsed.howItWillLookOnYou ||
        parsed.compatibilitySummary ||
        'Compatibilidade avaliada considerando o formato do seu rosto e tipo de cabelo.',
      barberRecommendation:
        parsed.barberRecommendation ||
        'Mostre estes dados ao barbeiro para alinhar altura das laterais e acabamento.',
      calculations: {
        diagnosticOutcome:
          normalizedBinaryDiagnosis === 'positivo' ? 'sucesso' : 'falha',
        binaryDiagnosis: normalizedBinaryDiagnosis,
        overallScore: normalizedOverallScore,
        headShapeFitScore: safeHeadScore,
        hairTextureFitScore: safeTextureScore,
        lengthSufficiencyScore: safeLengthScore,
        verdictStatus: normalizedVerdictStatus,
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
      source: 'gemini_vision',
    };

    return NextResponse.json(
      {analysis},
      {headers: {'Cache-Control': 'no-store'}}
    );
  } catch (error) {
    const rawMsg = error instanceof Error ? error.message : String(error);
    const errStatus =
      typeof error === 'object' && error !== null && 'status' in error
        ? Number((error as {status?: unknown}).status)
        : 0;
    console.error('Face ID analysis AI error:', errStatus || 'unknown', rawMsg);

    if (
      errStatus === 429 ||
      rawMsg.includes('RESOURCE_EXHAUSTED') ||
      rawMsg.includes('"code":429')
    ) {
      return NextResponse.json(
        {
          error:
            'Limite temporário de uso da IA atingido. Aguarde alguns instantes e tente novamente ou use o cálculo pelos seus dados.',
          code: 'GEMINI_QUOTA_EXCEEDED',
        },
        {status: 429, headers: {'Cache-Control': 'no-store'}}
      );
    }

    if (
      errStatus === 403 ||
      errStatus === 400 ||
      rawMsg.includes('PERMISSION_DENIED') ||
      rawMsg.includes('API_KEY_INVALID') ||
      rawMsg.includes('API key not valid') ||
      rawMsg.includes('API key expired')
    ) {
      return NextResponse.json(
        {
          error:
            'A credencial de IA configurada neste ambiente foi recusada pelo serviço. Verifique em Settings > Secrets ou use o cálculo pelos seus dados.',
          code: 'GEMINI_AUTH_ERROR',
          upstreamStatus: errStatus || undefined,
        },
        {status: 502, headers: {'Cache-Control': 'no-store'}}
      );
    }

    if (errStatus === 404 || rawMsg.includes('NOT_FOUND')) {
      return NextResponse.json(
        {
          error:
            'Modelo de análise Face ID indisponível no momento. Tente novamente ou use o cálculo pelos seus dados.',
          code: 'GEMINI_MODEL_NOT_FOUND',
          upstreamStatus: errStatus || undefined,
        },
        {status: 502, headers: {'Cache-Control': 'no-store'}}
      );
    }

    return NextResponse.json(
      {
        error:
          'Não foi possível concluir a leitura Face ID neste momento. Ilumine bem o rosto e tente novamente, ou calcule pelos seus dados.',
        code: rawMsg.includes('GEMINI_INVALID_JSON_RESPONSE')
          ? 'GEMINI_INVALID_JSON_RESPONSE'
          : 'GEMINI_UPSTREAM_ERROR',
        upstreamStatus: errStatus || undefined,
      },
      {status: 502, headers: {'Cache-Control': 'no-store'}}
    );
  }
}
