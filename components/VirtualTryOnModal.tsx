'use client';

import {
  Calendar,
  CheckCircle2,
  RotateCcw,
  Ruler,
  ScanFace,
  ShieldCheck,
  SlidersHorizontal,
  X,
  XCircle,
} from 'lucide-react';
import {useCallback, useEffect, useState} from 'react';
import {SERVICES, VIRTUAL_HAIRSTYLE_PRESETS} from '@/lib/data/seed';
import {
  CranialShapeCategory,
  FaceShape,
  HairLengthCategory,
  HairType,
  VirtualHairstyleId,
} from '@/lib/types/domain';
import {formatCurrencyBRL, formatDuration} from '@/lib/utils/formatters';
import {
  classificarFormatoRostoPorMedidas,
  diagnosticarVisagismoBinario,
  DiagnosticoVisagismoBinario,
  FORMATOS_CRANIO_VALIDOS,
  MedidasBasicasVisagismo,
} from '@/lib/utils/visagismo';

interface VirtualTryOnModalProps {
  open: boolean;
  initialStyleId?: VirtualHairstyleId;
  onClose: () => void;
  onOpenPrivacy: () => void;
  onBookStyle: (serviceId: string) => void;
}

type ModalStage = 'dados' | 'resultado';

interface ResultadoAvaliado {
  diagnostico: DiagnosticoVisagismoBinario;
  styleId: VirtualHairstyleId;
  formatoRosto: FaceShape;
  tipoCabelo: HairType;
  comprimentoCabelo: HairLengthCategory;
  medidasBasicas?: MedidasBasicasVisagismo;
}

const FACE_SHAPES: FaceShape[] = [
  'Oval',
  'Quadrado',
  'Redondo',
  'Diamante',
  'Triangular',
  'Alongado',
];

const HAIR_TYPES: HairType[] = ['Liso', 'Ondulado', 'Cacheado', 'Crespo'];

const HAIR_LENGTHS: HairLengthCategory[] = [
  'Raspado / Muito curto',
  'Curto',
  'Médio',
  'Longo',
];

function getServiceMeta(serviceId: string) {
  return SERVICES.find((s) => s.id === serviceId);
}

export function VirtualTryOnModal({
  open,
  initialStyleId,
  onClose,
  onOpenPrivacy,
  onBookStyle,
}: VirtualTryOnModalProps) {
  const [stage, setStage] = useState<ModalStage>('dados');
  const [chosenStyleId, setChosenStyleId] = useState<VirtualHairstyleId>(
    () => initialStyleId || VIRTUAL_HAIRSTYLE_PRESETS[0].id
  );

  const [faceShape, setFaceShape] = useState<FaceShape>('Oval');
  const [hairType, setHairType] = useState<HairType>('Ondulado');
  const [hairLength, setHairLength] = useState<HairLengthCategory>('Médio');
  const [useMeasurements, setUseMeasurements] = useState(false);
  const [faceLengthCm, setFaceLengthCm] = useState('19.5');
  const [cheekboneWidthCm, setCheekboneWidthCm] = useState('14.2');
  const [jawWidthCm, setJawWidthCm] = useState('11.6');
  const [foreheadWidthCm, setForeheadWidthCm] = useState('13.4');
  const [cranialShape, setCranialShape] = useState<CranialShapeCategory>('Equilibrado');

  const [resultadoAvaliado, setResultadoAvaliado] = useState<ResultadoAvaliado | null>(
    null
  );

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleClose]);

  const buildMedidasBasicas = useCallback((): MedidasBasicasVisagismo | undefined => {
    if (!useMeasurements) return undefined;
    const parseOpt = (raw: string) => {
      const n = Number(raw.replace(',', '.'));
      return Number.isFinite(n) && n >= 6 && n <= 35 ? n : undefined;
    };
    return {
      alturaRostoCm: parseOpt(faceLengthCm),
      larguraMacasCm: parseOpt(cheekboneWidthCm),
      larguraMandibulaCm: parseOpt(jawWidthCm),
      larguraTestaCm: parseOpt(foreheadWidthCm),
      formatoCabeca: cranialShape,
    };
  }, [
    useMeasurements,
    faceLengthCm,
    cheekboneWidthCm,
    jawWidthCm,
    foreheadWidthCm,
    cranialShape,
  ]);

  const executarDiagnostico = useCallback(
    (
      nextStyleId: VirtualHairstyleId = chosenStyleId,
      nextFace: FaceShape = faceShape,
      nextType: HairType = hairType,
      nextLength: HairLengthCategory = hairLength
    ) => {
      const medidasBasicas = buildMedidasBasicas();
      const formatoResolvido =
        (medidasBasicas ? classificarFormatoRostoPorMedidas(medidasBasicas) : null) ??
        nextFace;

      const diagnostico = diagnosticarVisagismoBinario({
        styleId: nextStyleId,
        tipoCabelo: nextType,
        formatoRosto: formatoResolvido,
        comprimentoCabelo: nextLength,
        medidasBasicas,
      });

      setFaceShape(formatoResolvido);
      setChosenStyleId(nextStyleId);
      setResultadoAvaliado({
        diagnostico,
        styleId: nextStyleId,
        formatoRosto: formatoResolvido,
        tipoCabelo: nextType,
        comprimentoCabelo: nextLength,
        medidasBasicas,
      });
      setStage('resultado');
    },
    [buildMedidasBasicas, chosenStyleId, faceShape, hairLength, hairType]
  );

  if (!open) return null;

  const activePreset =
    VIRTUAL_HAIRSTYLE_PRESETS.find((p) => p.id === chosenStyleId) ??
    VIRTUAL_HAIRSTYLE_PRESETS[0];
  const serviceMeta = getServiceMeta(activePreset.serviceId);

  const isPositiveVerdict = resultadoAvaliado?.diagnostico.cor === 'verde';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tryon-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full sm:max-w-3xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-[#1C1C1C] border border-[#2B2B2B] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-[#2B2B2B] bg-[#161616] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-[#111111] border border-[#2B2B2B] flex items-center justify-center shrink-0">
              <ScanFace className="h-5 w-5 text-[#F7931E]" />
            </div>
            <div className="min-w-0">
              <h2
                id="tryon-modal-title"
                className="font-display text-base sm:text-lg font-bold text-white leading-snug break-words"
              >
                Face ID · Diagnóstico em Dados
              </h2>
              <p className="text-xs text-[#E5E5E5]/65 leading-snug break-words">
                Avaliação direta por formato do rosto, tipo de cabelo e medidas básicas
                (sem imagens ou vídeo)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Fechar Face ID"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#E5E5E5]/70 hover:text-white hover:bg-[#2B2B2B] transition-colors shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Seletor de corte/serviço */}
          <section className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-white">
                Corte ou serviço para avaliar
              </h3>
              {stage === 'resultado' && (
                <button
                  type="button"
                  onClick={() => setStage('dados')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#F7931E] hover:underline"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>Editar dados</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {VIRTUAL_HAIRSTYLE_PRESETS.map((preset) => {
                const selected = preset.id === chosenStyleId;
                const svc = getServiceMeta(preset.serviceId);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setChosenStyleId(preset.id);
                      if (stage === 'resultado') {
                        executarDiagnostico(preset.id, faceShape, hairType, hairLength);
                      }
                    }}
                    aria-pressed={selected}
                    className={`rounded-xl border p-3 text-left transition-colors min-w-0 ${
                      selected
                        ? 'border-[#F7931E] bg-[#F7931E]/10'
                        : 'border-[#2B2B2B] bg-[#111111] hover:border-[#F7931E]/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-display text-sm font-semibold text-white min-w-0 break-words leading-snug">
                        {preset.name}
                      </span>
                      {svc && (
                        <span className="font-mono text-xs font-bold text-[#F7931E] tabular-nums shrink-0">
                          {formatCurrencyBRL(svc.priceCents)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[#E5E5E5]/70 leading-relaxed break-words">
                      {preset.subtitle}
                    </p>
                    {svc && (
                      <p className="mt-1 text-[11px] font-mono text-[#E5E5E5]/55 tabular-nums">
                        Duração: {formatDuration(svc.durationMinutes)}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* STAGE 1: Entrada de dados (sem captura ou processamento de imagem) */}
          {stage === 'dados' && (
            <section className="rounded-2xl border border-[#2B2B2B] bg-[#111111] p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-sm font-semibold text-white">
                  Informe seus dados para diagnóstico
                </h3>
                <span className="text-[11px] font-medium text-[#E5E5E5]/60">
                  Resultado binário: Verde ou Vermelho
                </span>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-[#E5E5E5]/80">
                  Formato do rosto
                </label>
                <div className="flex flex-wrap gap-2">
                  {FACE_SHAPES.map((shape) => (
                    <button
                      key={shape}
                      type="button"
                      onClick={() => setFaceShape(shape)}
                      aria-pressed={faceShape === shape}
                      className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                        faceShape === shape
                          ? 'border-[#F7931E] bg-[#F7931E] text-[#111111] font-semibold'
                          : 'border-[#2B2B2B] bg-[#1C1C1C] text-[#E5E5E5] hover:border-[#F7931E]/50'
                      }`}
                    >
                      {shape}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-[#E5E5E5]/80">
                  Tipo de cabelo
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {HAIR_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setHairType(type)}
                      aria-pressed={hairType === type}
                      className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                        hairType === type
                          ? 'border-[#F7931E] bg-[#F7931E] text-[#111111] font-semibold'
                          : 'border-[#2B2B2B] bg-[#1C1C1C] text-[#E5E5E5] hover:border-[#F7931E]/50'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-[#E5E5E5]/80">
                  Comprimento atual do cabelo
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {HAIR_LENGTHS.map((len) => (
                    <button
                      key={len}
                      type="button"
                      onClick={() => setHairLength(len)}
                      aria-pressed={hairLength === len}
                      className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                        hairLength === len
                          ? 'border-[#F7931E] bg-[#F7931E] text-[#111111] font-semibold'
                          : 'border-[#2B2B2B] bg-[#1C1C1C] text-[#E5E5E5] hover:border-[#F7931E]/50'
                      }`}
                    >
                      {len}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5 pt-1 border-t border-[#2B2B2B]">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs font-medium text-[#E5E5E5]">
                  <input
                    type="checkbox"
                    checked={useMeasurements}
                    onChange={(e) => setUseMeasurements(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-[#2B2B2B] bg-[#1C1C1C] accent-[#F7931E] shrink-0"
                  />
                  <span className="min-w-0 break-words leading-relaxed">
                    Usar medidas básicas (cm) e formato da cabeça no cálculo
                  </span>
                </label>

                {useMeasurements && (
                  <div className="rounded-xl border border-[#2B2B2B] bg-[#161616] p-3.5 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <label className="space-y-1 text-[11px] text-[#E5E5E5]/75">
                        <span className="block">Altura do rosto (cm)</span>
                        <input
                          type="number"
                          step="0.1"
                          min="6"
                          max="35"
                          value={faceLengthCm}
                          onChange={(e) => setFaceLengthCm(e.target.value)}
                          className="w-full min-h-[38px] rounded-lg border border-[#2B2B2B] bg-[#111111] px-2.5 text-xs text-white focus:border-[#F7931E] focus:outline-none"
                        />
                      </label>
                      <label className="space-y-1 text-[11px] text-[#E5E5E5]/75">
                        <span className="block">Largura maçãs (cm)</span>
                        <input
                          type="number"
                          step="0.1"
                          min="6"
                          max="35"
                          value={cheekboneWidthCm}
                          onChange={(e) => setCheekboneWidthCm(e.target.value)}
                          className="w-full min-h-[38px] rounded-lg border border-[#2B2B2B] bg-[#111111] px-2.5 text-xs text-white focus:border-[#F7931E] focus:outline-none"
                        />
                      </label>
                      <label className="space-y-1 text-[11px] text-[#E5E5E5]/75">
                        <span className="block">Mandíbula (cm)</span>
                        <input
                          type="number"
                          step="0.1"
                          min="6"
                          max="35"
                          value={jawWidthCm}
                          onChange={(e) => setJawWidthCm(e.target.value)}
                          className="w-full min-h-[38px] rounded-lg border border-[#2B2B2B] bg-[#111111] px-2.5 text-xs text-white focus:border-[#F7931E] focus:outline-none"
                        />
                      </label>
                      <label className="space-y-1 text-[11px] text-[#E5E5E5]/75">
                        <span className="block">Testa (cm)</span>
                        <input
                          type="number"
                          step="0.1"
                          min="6"
                          max="35"
                          value={foreheadWidthCm}
                          onChange={(e) => setForeheadWidthCm(e.target.value)}
                          className="w-full min-h-[38px] rounded-lg border border-[#2B2B2B] bg-[#111111] px-2.5 text-xs text-white focus:border-[#F7931E] focus:outline-none"
                        />
                      </label>
                    </div>
                    <p className="text-[11px] text-[#E5E5E5]/55">
                      Aceita valores entre 6 e 35 cm (campos vazios ou fora da faixa são
                      ignorados).
                    </p>

                    <div className="space-y-1.5">
                      <span className="block text-[11px] text-[#E5E5E5]/75">
                        Formato da cabeça (crânio)
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {FORMATOS_CRANIO_VALIDOS.map((cranial) => (
                          <button
                            key={cranial}
                            type="button"
                            onClick={() => setCranialShape(cranial)}
                            aria-pressed={cranialShape === cranial}
                            className={`min-h-[36px] px-3 py-1 rounded-lg text-xs border transition-colors ${
                              cranialShape === cranial
                                ? 'border-[#F7931E] bg-[#F7931E] text-[#111111] font-semibold'
                                : 'border-[#2B2B2B] bg-[#111111] text-[#E5E5E5] hover:border-[#F7931E]/50'
                            }`}
                          >
                            {cranial}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => executarDiagnostico()}
                className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-5 py-2.5 text-sm font-semibold text-[#111111] transition-colors"
              >
                <SlidersHorizontal className="h-4 w-4 shrink-0" />
                <span>Ver diagnóstico em dados</span>
              </button>
            </section>
          )}

          {/* STAGE 2: Resultado Binário (Verde = positivo | Vermelho = negativo) */}
          {stage === 'resultado' && resultadoAvaliado && (
            <section
              className={`rounded-2xl border p-4 sm:p-5 space-y-4 ${
                isPositiveVerdict
                  ? 'border-emerald-500/50 bg-[#111111]'
                  : 'border-red-500/50 bg-[#111111]'
              }`}
            >
              {/* Card principal Verde ou Vermelho */}
              <div
                className={`rounded-xl border p-4 sm:p-5 flex items-start gap-3.5 ${
                  isPositiveVerdict
                    ? 'border-emerald-500/55 bg-emerald-500/15'
                    : 'border-red-500/55 bg-red-500/15'
                }`}
              >
                {isPositiveVerdict ? (
                  <CheckCircle2 className="h-7 w-7 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-7 w-7 text-red-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1.5 min-w-0">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-xs font-semibold ${
                      isPositiveVerdict
                        ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                        : 'border-red-500/50 bg-red-500/20 text-red-300'
                    }`}
                  >
                    {isPositiveVerdict
                      ? 'Resultado Positivo (Verde)'
                      : 'Resultado Negativo (Vermelho)'}
                  </span>

                  <h3
                    className={`font-display text-lg sm:text-xl font-bold leading-snug break-words ${
                      isPositiveVerdict ? 'text-emerald-300' : 'text-red-300'
                    }`}
                  >
                    {isPositiveVerdict
                      ? `${activePreset.name}: vai ficar legal!`
                      : `${activePreset.name}: não fica legal neste perfil`}
                  </h3>

                  <p className="text-xs sm:text-sm text-[#E5E5E5]/90 leading-relaxed break-words">
                    {isPositiveVerdict
                      ? 'Pelos dados informados de formato de rosto, tipo de cabelo e medidas, este corte tem aprovação positiva.'
                      : 'Pelos dados informados de formato de rosto, tipo de cabelo e medidas, este corte recebeu retorno negativo. Teste outro estilo acima ou ajuste os dados.'}
                  </p>
                </div>
              </div>

              {/* Dados informados que geraram o diagnóstico */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] p-3 space-y-0.5 min-w-0">
                  <span className="text-[11px] uppercase tracking-wide text-[#E5E5E5]/55">
                    Formato do rosto
                  </span>
                  <p className="font-display text-sm font-bold text-white break-words">
                    {resultadoAvaliado.formatoRosto}
                  </p>
                </div>

                <div className="rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] p-3 space-y-0.5 min-w-0">
                  <span className="text-[11px] uppercase tracking-wide text-[#E5E5E5]/55">
                    Tipo de cabelo
                  </span>
                  <p className="font-display text-sm font-bold text-white break-words">
                    {resultadoAvaliado.tipoCabelo}
                  </p>
                </div>

                <div className="rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] p-3 space-y-0.5 min-w-0">
                  <span className="text-[11px] uppercase tracking-wide text-[#E5E5E5]/55">
                    Comprimento atual
                  </span>
                  <p className="font-display text-sm font-bold text-white break-words">
                    {resultadoAvaliado.comprimentoCabelo}
                  </p>
                </div>
              </div>

              {resultadoAvaliado.medidasBasicas && (
                <div className="rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] p-3 flex items-start gap-2.5 text-xs text-[#E5E5E5]/85 leading-relaxed">
                  <Ruler className="h-4 w-4 text-[#F7931E] shrink-0 mt-0.5" />
                  <span className="min-w-0 break-words">
                    Medidas aplicadas:{' '}
                    {[
                      resultadoAvaliado.medidasBasicas.alturaRostoCm
                        ? `altura ${resultadoAvaliado.medidasBasicas.alturaRostoCm} cm`
                        : null,
                      resultadoAvaliado.medidasBasicas.larguraMacasCm
                        ? `maçãs ${resultadoAvaliado.medidasBasicas.larguraMacasCm} cm`
                        : null,
                      resultadoAvaliado.medidasBasicas.larguraMandibulaCm
                        ? `mandíbula ${resultadoAvaliado.medidasBasicas.larguraMandibulaCm} cm`
                        : null,
                      resultadoAvaliado.medidasBasicas.larguraTestaCm
                        ? `testa ${resultadoAvaliado.medidasBasicas.larguraTestaCm} cm`
                        : null,
                      resultadoAvaliado.medidasBasicas.formatoCabeca
                        ? `crânio ${resultadoAvaliado.medidasBasicas.formatoCabeca}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    .
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setStage('dados')}
                  className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] hover:border-[#F7931E]/60 px-3.5 py-2 text-xs font-medium text-white transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-[#F7931E]" />
                  <span>Alterar dados</span>
                </button>
              </div>
            </section>
          )}

          {/* LGPD */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#E5E5E5]/60">
            <span className="inline-flex items-start gap-1.5 min-w-0">
              <ShieldCheck className="h-4 w-4 text-[#F7931E] shrink-0 mt-0.5" />
              <span className="break-words">
                Diagnóstico calculado localmente apenas pelos seus dados — nenhuma foto ou
                vídeo é capturada ou salva.
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                handleClose();
                onOpenPrivacy();
              }}
              className="text-[#F7931E] hover:underline shrink-0"
            >
              Privacidade e LGPD
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:px-6 border-t border-[#2B2B2B] bg-[#161616] flex flex-col sm:flex-row gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="sm:w-auto min-h-[46px] rounded-xl border border-[#2B2B2B] bg-[#111111] hover:border-[#E5E5E5]/40 px-5 py-2.5 text-sm font-medium text-[#E5E5E5] transition-colors"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={() => {
              handleClose();
              onBookStyle(activePreset.serviceId);
            }}
            className="flex-1 min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-4 py-2.5 text-sm font-semibold text-[#111111] transition-colors text-center"
          >
            <Calendar className="h-4 w-4 shrink-0" />
            <span className="break-words">
              Agendar {activePreset.name}
              {serviceMeta ? ` · ${formatCurrencyBRL(serviceMeta.priceCents)}` : ''}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
