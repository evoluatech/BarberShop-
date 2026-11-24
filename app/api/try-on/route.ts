import {NextRequest, NextResponse} from 'next/server';
import {VIRTUAL_HAIRSTYLE_PRESETS} from '@/lib/data/seed';
import {
  FaceShape,
  HairLengthCategory,
  HairType,
  VirtualHairstyleId,
} from '@/lib/types/domain';
import {
  processFaceIdData,
  sanitizeFacialMeasurements,
} from '@/lib/utils/face-id-processor';

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
    styleId?: unknown;
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
      styleId,
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
  } catch {
    return NextResponse.json(
      {error: 'Não foi possível calcular o diagnóstico de visagismo.'},
      {status: 500, headers: {'Cache-Control': 'no-store'}}
    );
  }
}
