'use client';

import {
  AlertTriangle,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
  ScanFace,
  Scissors,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  WifiOff,
  X,
} from 'lucide-react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {
  describeCameraError,
  requestCameraStreamWithFallback,
  setCameraPermissionPreference,
} from '@/hooks/useCameraPermission';
import {useOnlineStatus} from '@/hooks/useOnlineStatus';
import {analyzeTryOnVision, calculateTryOnManual} from '@/lib/api/client';
import {SERVICES, VIRTUAL_HAIRSTYLE_PRESETS} from '@/lib/data/seed';
import {
  FaceShape,
  HairLengthCategory,
  HairType,
  VirtualHairstyleId,
  VirtualTryOnAnalysis,
} from '@/lib/types/domain';
import {formatCurrencyBRL, formatDuration} from '@/lib/utils/formatters';
import {computeManualVisagism} from '@/lib/utils/visagism';

interface VirtualTryOnModalProps {
  open: boolean;
  initialStyleId?: VirtualHairstyleId;
  onClose: () => void;
  onOpenPrivacy: () => void;
  onBookStyle: (serviceId: string) => void;
}

type ModalStage = 'scanner' | 'manual' | 'result';

interface FrameTelemetry {
  brightnessLabel: 'Iluminação ideal' | 'Ambiente escuro' | 'Luz muito forte';
  lightingOk: boolean;
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

function captureFrameBase64(
  video: HTMLVideoElement,
  mirrored: boolean,
  maxDimension = 640
): string | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  const ratio = Math.min(1, maxDimension / Math.max(vw, vh));
  const targetW = Math.max(1, Math.round(vw * ratio));
  const targetH = Math.max(1, Math.round(vh * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  if (mirrored) {
    ctx.translate(targetW, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, targetW, targetH);
  return canvas.toDataURL('image/jpeg', 0.85);
}

function measureVideoBrightness(video: HTMLVideoElement): FrameTelemetry {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) {
    return {brightnessLabel: 'Iluminação ideal', lightingOk: true};
  }
  const sampleW = 48;
  const sampleH = 48;
  const canvas = document.createElement('canvas');
  canvas.width = sampleW;
  canvas.height = sampleH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {brightnessLabel: 'Iluminação ideal', lightingOk: true};
  }
  ctx.drawImage(video, 0, 0, sampleW, sampleH);
  const {data} = ctx.getImageData(0, 0, sampleW, sampleH);
  let totalLum = 0;
  let count = 0;
  // Focus on central oval region
  for (let y = 10; y < 38; y++) {
    for (let x = 12; x < 36; x++) {
      const idx = (y * sampleW + x) * 4;
      totalLum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      count++;
    }
  }
  const avg = count > 0 ? totalLum / count : 128;
  if (avg < 45) {
    return {brightnessLabel: 'Ambiente escuro', lightingOk: false};
  }
  if (avg > 235) {
    return {brightnessLabel: 'Luz muito forte', lightingOk: false};
  }
  return {brightnessLabel: 'Iluminação ideal', lightingOk: true};
}

function ScoreBar({
  label,
  value,
  highlightColor,
}: {
  label: string;
  value: number;
  highlightColor?: string;
}) {
  const safeVal = Math.max(0, Math.min(100, Math.round(value)));
  const barColor =
    highlightColor ??
    (safeVal >= 85
      ? 'bg-emerald-500'
      : safeVal >= 65
        ? 'bg-[#F7931E]'
        : 'bg-red-500');

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-[#E5E5E5]/85 min-w-0 break-words">{label}</span>
        <span className="font-mono font-bold text-white tabular-nums shrink-0">
          {safeVal}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-[#111111] border border-[#2B2B2B] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{width: `${safeVal}%`}}
        />
      </div>
    </div>
  );
}

export function VirtualTryOnModal({
  open,
  initialStyleId,
  onClose,
  onOpenPrivacy,
  onBookStyle,
}: VirtualTryOnModalProps) {
  const isOnline = useOnlineStatus();

  const [stage, setStage] = useState<ModalStage>('scanner');
  const [chosenStyleId, setChosenStyleId] = useState<VirtualHairstyleId>(
    () => initialStyleId || VIRTUAL_HAIRSTYLE_PRESETS[0].id
  );
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<{
    message: string;
    isIframeBlocked: boolean;
  } | null>(null);
  const [telemetry, setTelemetry] = useState<FrameTelemetry>({
    brightnessLabel: 'Iluminação ideal',
    lightingOk: true,
  });

  const [analyzing, setAnalyzing] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<VirtualTryOnAnalysis | null>(null);

  // Manual profile state (also populated after Face ID reading so user can tweak/test another cut)
  const [faceShape, setFaceShape] = useState<FaceShape>('Oval');
  const [hairType, setHairType] = useState<HairType>('Ondulado');
  const [hairLength, setHairLength] = useState<HairLengthCategory>('Médio');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountIdRef = useRef(0);

  const releaseCameraStream = useCallback(() => {
    mountIdRef.current += 1;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    releaseCameraStream();
    setCameraReady(false);
  }, [releaseCameraStream]);

  const startCamera = useCallback(
    async (mode: 'user' | 'environment') => {
      releaseCameraStream();
      const currentAttempt = ++mountIdRef.current;
      setCameraError(null);
      setScanError(null);
      setCameraReady(false);

      try {
        const stream = await requestCameraStreamWithFallback(mode);
        if (currentAttempt !== mountIdRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setCameraPermissionPreference('granted');
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        if (currentAttempt !== mountIdRef.current) return;
        const info = describeCameraError(err);
        setCameraError(info);
      }
    },
    [releaseCameraStream]
  );

  // Start or stop camera when modal / stage changes
  useEffect(() => {
    if (!open || stage !== 'scanner') {
      releaseCameraStream();
      return;
    }
    const timer = window.setTimeout(() => {
      void startCamera(facingMode);
    }, 40);
    return () => {
      window.clearTimeout(timer);
      releaseCameraStream();
    };
  }, [open, stage, facingMode, startCamera, releaseCameraStream]);

  // Periodic brightness check while scanner is active
  useEffect(() => {
    if (!open || stage !== 'scanner' || !cameraReady) return;
    const id = window.setInterval(() => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        setTelemetry(measureVideoBrightness(videoRef.current));
      }
    }, 900);
    return () => window.clearInterval(id);
  }, [open, stage, cameraReady]);

  // Escape key closes modal safely
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !analyzing) {
        stopCamera();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, analyzing, stopCamera, onClose]);

  const handleClose = useCallback(() => {
    stopCamera();
    onClose();
  }, [stopCamera, onClose]);

  const handleScanFaceId = async () => {
    if (!videoRef.current || !cameraReady) {
      setScanError('Aguarde a câmera abrir para iniciar a leitura Face ID.');
      return;
    }
    if (!isOnline) {
      setScanError(
        'Você está sem conexão no momento. Use o botão "Pular câmera e usar dados" para calcular offline.'
      );
      return;
    }

    const frame = captureFrameBase64(videoRef.current, facingMode === 'user');
    if (!frame) {
      setScanError('Não foi possível ler o quadro da câmera. Tente novamente.');
      return;
    }

    setAnalyzing(true);
    setScanError(null);
    try {
      const result = await analyzeTryOnVision({
        styleId: chosenStyleId,
        imageBase64: frame,
        mimeType: 'image/jpeg',
      });

      if (result.imageQualityOk === false) {
        setScanError(
          result.imageQualityMessage ||
            'Não foi possível enxergar bem seu rosto e cabelo. Melhore a iluminação, remova boné/óculos e centralize o rosto.'
        );
        return;
      }

      // Immediately turn off camera so result screen displays strictly data
      stopCamera();
      setFaceShape(result.faceShape);
      setHairType(result.detectedHairType);
      setHairLength(result.detectedHairLength);
      setAnalysis(result);
      setStage('result');
    } catch (err) {
      setScanError(
        err instanceof Error
          ? err.message
          : 'Erro ao ler dados pelo Face ID. Tente novamente ou use o cálculo por dados.'
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCalculateManual = async (
    nextStyleId: VirtualHairstyleId = chosenStyleId,
    nextFace: FaceShape = faceShape,
    nextType: HairType = hairType,
    nextLength: HairLengthCategory = hairLength
  ) => {
    setAnalyzing(true);
    setScanError(null);
    try {
      let nextResult: VirtualTryOnAnalysis;
      if (isOnline) {
        nextResult = await calculateTryOnManual({
          styleId: nextStyleId,
          manualFaceShape: nextFace,
          manualHairType: nextType,
          manualHairLength: nextLength,
        });
      } else {
        nextResult = computeManualVisagism({
          styleId: nextStyleId,
          faceShape: nextFace,
          hairType: nextType,
          hairLength: nextLength,
        });
      }
      stopCamera();
      setChosenStyleId(nextStyleId);
      setAnalysis(nextResult);
      setStage('result');
    } catch {
      const local = computeManualVisagism({
        styleId: nextStyleId,
        faceShape: nextFace,
        hairType: nextType,
        hairLength: nextLength,
      });
      stopCamera();
      setChosenStyleId(nextStyleId);
      setAnalysis(local);
      setStage('result');
    } finally {
      setAnalyzing(false);
    }
  };

  if (!open) return null;

  const activePreset =
    VIRTUAL_HAIRSTYLE_PRESETS.find((p) => p.id === chosenStyleId) ??
    VIRTUAL_HAIRSTYLE_PRESETS[0];
  const serviceMeta = getServiceMeta(activePreset.serviceId);

  const alternativePreset = analysis?.calculations.betterAlternativeStyleId
    ? VIRTUAL_HAIRSTYLE_PRESETS.find(
        (p) => p.id === analysis.calculations.betterAlternativeStyleId
      )
    : undefined;

  const verdictTone =
    (analysis?.calculations.overallScore ?? 0) >= 85
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
      : (analysis?.calculations.overallScore ?? 0) >= 70
        ? 'border-[#F7931E]/40 bg-[#F7931E]/10 text-[#F7931E]'
        : 'border-amber-500/45 bg-amber-500/15 text-amber-200';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tryon-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !analyzing) handleClose();
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
                Face ID · Análise em Dados
              </h2>
              <p className="text-xs text-[#E5E5E5]/65 leading-snug break-words">
                Leitura do seu rosto e cabelo exibida apenas em dados (sem imagem ou vídeo
                de corte)
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={analyzing}
            onClick={handleClose}
            aria-label="Fechar Face ID"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#E5E5E5]/70 hover:text-white hover:bg-[#2B2B2B] disabled:opacity-50 transition-colors shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {!isOnline && (
            <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-amber-200 leading-relaxed">
              <WifiOff className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
              <span className="min-w-0 break-words">
                Você está offline. A leitura por IA requer internet, mas o cálculo
                pelos seus dados continua funcionando normalmente.
              </span>
            </div>
          )}

          {/* Seletor de corte/serviço (sempre acessível antes ou depois da leitura) */}
          <section className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold text-white">
                Corte ou serviço para avaliar
              </h3>
              <div className="flex items-center gap-2">
                {stage !== 'scanner' && (
                  <button
                    type="button"
                    onClick={() => setStage('scanner')}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#F7931E] hover:underline"
                  >
                    <ScanFace className="h-3.5 w-3.5" />
                    <span>Usar Face ID</span>
                  </button>
                )}
                {stage === 'scanner' && (
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      setStage('manual');
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#E5E5E5]/80 hover:text-[#F7931E]"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>Informar dados sem câmera</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {VIRTUAL_HAIRSTYLE_PRESETS.map((preset) => {
                const selected = preset.id === chosenStyleId;
                const svc = getServiceMeta(preset.serviceId);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={analyzing}
                    onClick={() => {
                      setChosenStyleId(preset.id);
                      if (stage === 'result') {
                        void handleCalculateManual(
                          preset.id,
                          faceShape,
                          hairType,
                          hairLength
                        );
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

          {/* STAGE 1: Scanner Face ID */}
          {stage === 'scanner' && (
            <section className="rounded-2xl border border-[#2B2B2B] bg-[#111111] p-4 sm:p-5 space-y-4">
              {cameraError ? (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1 min-w-0">
                      <p className="text-sm font-semibold text-white">
                        Câmera indisponível neste momento
                      </p>
                      <p className="text-xs text-amber-100/90 leading-relaxed break-words">
                        {cameraError.message}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cameraError.isIframeBlocked && typeof window !== 'undefined' && (
                      <a
                        href={window.location.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-4 py-2 text-xs font-semibold text-[#111111] transition-colors"
                      >
                        <ExternalLink className="h-4 w-4 shrink-0" />
                        <span>Abrir em nova aba para Face ID</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => void startCamera(facingMode)}
                      className="min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] hover:border-[#F7931E]/60 px-4 py-2 text-xs font-medium text-white transition-colors"
                    >
                      <Camera className="h-4 w-4 text-[#F7931E] shrink-0" />
                      <span>Tentar câmera novamente</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStage('manual')}
                      className="min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] hover:border-[#F7931E]/60 px-4 py-2 text-xs font-medium text-[#E5E5E5] transition-colors"
                    >
                      <SlidersHorizontal className="h-4 w-4 text-[#F7931E] shrink-0" />
                      <span>Usar apenas meus dados</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          cameraReady ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                        }`}
                      />
                      <span className="font-medium text-white">
                        {cameraReady
                          ? 'Sensor Face ID pronto para leitura'
                          : 'Abrindo câmera para leitura...'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {cameraReady && (
                        <span
                          className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border ${
                            telemetry.lightingOk
                              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                              : 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                          }`}
                        >
                          {telemetry.brightnessLabel}
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={analyzing}
                        onClick={() =>
                          setFacingMode((m) => (m === 'user' ? 'environment' : 'user'))
                        }
                        aria-label="Alternar câmera frontal ou traseira"
                        className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border border-[#2B2B2B] bg-[#1C1C1C] hover:border-[#F7931E]/60 px-2.5 py-1 text-xs text-[#E5E5E5] transition-colors"
                      >
                        <RefreshCw className="h-3.5 w-3.5 text-[#F7931E]" />
                        <span>Inverter</span>
                      </button>
                    </div>
                  </div>

                  {/* Circular Face ID alignment reticle (no cut images/overlays) */}
                  <div className="flex flex-col items-center space-y-3">
                    <div className="relative h-64 w-64 sm:h-72 sm:w-72 rounded-full overflow-hidden border-2 border-[#F7931E]/70 bg-[#0A0A0A] shadow-inner">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        onLoadedMetadata={() => setCameraReady(true)}
                        className={`h-full w-full object-cover ${
                          facingMode === 'user' ? '-scale-x-100' : ''
                        }`}
                      />
                      {/* Simple Face ID framing ring */}
                      <div
                        className="pointer-events-none absolute inset-4 rounded-full border-2 border-dashed border-[#F7931E]/65"
                        aria-hidden="true"
                      />
                      {!cameraReady && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#111111]/85 text-xs text-[#E5E5E5]">
                          <Loader2 className="h-6 w-6 animate-spin text-[#F7931E]" />
                          <span>Iniciando Face ID...</span>
                        </div>
                      )}
                      {analyzing && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/75 text-xs text-white px-4 text-center">
                          <Loader2 className="h-7 w-7 animate-spin text-[#F7931E]" />
                          <span className="font-semibold">
                            Lendo rosto, tipo de fio e comprimento...
                          </span>
                          <span className="text-[11px] text-[#E5E5E5]/75">
                            Gerando apenas o resultado em dados
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-[#E5E5E5]/70 text-center max-w-md leading-relaxed">
                      Centralize o rosto no círculo com boa luz. Após a leitura, a câmera
                      fecha automaticamente e exibimos apenas os seus dados e se o corte
                      combina.
                    </p>
                  </div>

                  {scanError && (
                    <div
                      role="alert"
                      className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200 flex items-start gap-2 leading-relaxed"
                    >
                      <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                      <span className="min-w-0 break-words">{scanError}</span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <button
                      type="button"
                      disabled={!cameraReady || analyzing || !isOnline}
                      onClick={handleScanFaceId}
                      className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] disabled:opacity-50 px-5 py-2.5 text-sm font-semibold text-[#111111] transition-colors"
                    >
                      {analyzing ? (
                        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      ) : (
                        <ScanFace className="h-4 w-4 shrink-0" />
                      )}
                      <span>
                        {analyzing ? 'Analisando dados...' : 'Ler Face ID e ver dados'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={analyzing}
                      onClick={() => {
                        stopCamera();
                        setStage('manual');
                      }}
                      className="sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] hover:border-[#F7931E]/60 px-4 py-2.5 text-xs sm:text-sm font-medium text-[#E5E5E5] transition-colors"
                    >
                      <SlidersHorizontal className="h-4 w-4 text-[#F7931E] shrink-0" />
                      <span>Pular câmera e usar dados</span>
                    </button>
                  </div>
                </>
              )}
            </section>
          )}

          {/* STAGE 2: Entrada manual de dados (sem câmera) */}
          {stage === 'manual' && (
            <section className="rounded-2xl border border-[#2B2B2B] bg-[#111111] p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-sm font-semibold text-white">
                  Informe suas características para calcular
                </h3>
                <button
                  type="button"
                  onClick={() => setStage('scanner')}
                  className="text-xs font-medium text-[#F7931E] hover:underline"
                >
                  Voltar para Face ID com câmera
                </button>
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

              <button
                type="button"
                disabled={analyzing}
                onClick={() => void handleCalculateManual()}
                className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] disabled:opacity-60 px-5 py-2.5 text-sm font-semibold text-[#111111] transition-colors"
              >
                {analyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SlidersHorizontal className="h-4 w-4" />
                )}
                <span>Calcular compatibilidade em dados</span>
              </button>
            </section>
          )}

          {/* STAGE 3: RESULTADO APENAS EM DADOS (sem fotos, vídeos ou prévias visuais) */}
          {stage === 'result' && analysis && (
            <section className="rounded-2xl border border-[#2B2B2B] bg-[#111111] p-4 sm:p-5 space-y-5">
              {/* Veredito principal: se dá bom corte ou não */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2B2B2B]">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-lg border border-[#2B2B2B] bg-[#1C1C1C] px-2.5 py-1 text-[11px] font-medium text-[#E5E5E5]">
                      {analysis.source === 'gemini_vision' ? (
                        <>
                          <ScanFace className="h-3.5 w-3.5 text-[#F7931E]" />
                          <span>Leitura Face ID (apenas dados)</span>
                        </>
                      ) : (
                        <>
                          <SlidersHorizontal className="h-3.5 w-3.5 text-[#F7931E]" />
                          <span>Cálculo pelos seus dados</span>
                        </>
                      )}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${verdictTone}`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>{analysis.calculations.verdictStatus}</span>
                    </span>
                  </div>

                  <h3 className="font-display text-lg sm:text-xl font-bold text-white leading-snug break-words">
                    {activePreset.name} · {analysis.compatibilityLabel}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#E5E5E5]/85 leading-relaxed break-words">
                    {analysis.compatibilitySummary}
                  </p>
                </div>

                <div className="shrink-0 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] px-4 py-3">
                  <span className="text-[11px] uppercase tracking-wide text-[#E5E5E5]/60">
                    Compatibilidade
                  </span>
                  <span className="font-mono text-3xl font-bold text-[#F7931E] tabular-nums">
                    {analysis.calculations.overallScore}%
                  </span>
                </div>
              </div>

              {/* Grid de Dados Identificados (Rosto, Cabelo, Comprimento, Linha frontal) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] p-3.5 space-y-1 min-w-0">
                  <span className="text-[11px] uppercase tracking-wide text-[#E5E5E5]/55">
                    Formato do rosto
                  </span>
                  <p className="font-display text-base font-bold text-white">
                    {analysis.faceShape}
                  </p>
                  <p className="text-xs text-[#E5E5E5]/75 leading-relaxed break-words">
                    {analysis.cranialGeometry}
                  </p>
                </div>

                <div className="rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] p-3.5 space-y-1 min-w-0">
                  <span className="text-[11px] uppercase tracking-wide text-[#E5E5E5]/55">
                    Tipo de cabelo
                  </span>
                  <p className="font-display text-base font-bold text-white">
                    {analysis.detectedHairType}
                  </p>
                  <p className="text-xs text-[#E5E5E5]/75 leading-relaxed break-words">
                    {analysis.visualTexture} {analysis.apparentVolume}
                  </p>
                </div>

                <div className="rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] p-3.5 space-y-1 min-w-0">
                  <span className="text-[11px] uppercase tracking-wide text-[#E5E5E5]/55">
                    Comprimento atual
                  </span>
                  <p className="font-display text-base font-bold text-white">
                    {analysis.detectedHairLength}
                  </p>
                  <p className="text-xs text-[#E5E5E5]/75 leading-relaxed break-words">
                    {analysis.facialProportions}
                  </p>
                </div>

                <div className="rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] p-3.5 space-y-1 min-w-0">
                  <span className="text-[11px] uppercase tracking-wide text-[#E5E5E5]/55">
                    Linha frontal & barba
                  </span>
                  <p className="text-xs text-[#E5E5E5]/85 leading-relaxed break-words">
                    {analysis.hairlineObservation}
                  </p>
                  <p className="text-xs text-[#E5E5E5]/70 leading-relaxed break-words">
                    {analysis.beardObservation}
                  </p>
                </div>
              </div>

              {/* Aviso de risco / alternativa */}
              {analysis.calculations.riskWarning && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs leading-relaxed text-amber-100 min-w-0">
                      <p className="font-semibold text-amber-300">
                        Ponto de atenção antes de cortar
                      </p>
                      <p className="break-words">{analysis.calculations.riskWarning}</p>
                    </div>
                  </div>
                  {alternativePreset && (
                    <button
                      type="button"
                      disabled={analyzing}
                      onClick={() =>
                        void handleCalculateManual(
                          alternativePreset.id,
                          faceShape,
                          hairType,
                          hairLength
                        )
                      }
                      className="min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#F7931E] hover:bg-[#D97706] px-3 py-1.5 text-xs font-semibold text-[#111111] transition-colors"
                    >
                      <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      <span className="break-words text-left">
                        Avaliar alternativa: {alternativePreset.name}
                      </span>
                    </button>
                  )}
                </div>
              )}

              {/* Barras de compatibilidade técnica */}
              <div className="space-y-3">
                <ScoreBar
                  label="Encaixe no formato do rosto"
                  value={analysis.calculations.headShapeFitScore}
                />
                <ScoreBar
                  label="Aderência ao tipo de fio"
                  value={analysis.calculations.hairTextureFitScore}
                />
                <ScoreBar
                  label="Comprimento atual disponível"
                  value={analysis.calculations.lengthSufficiencyScore}
                />
              </div>

              {/* Análise em texto e orientações para o barbeiro */}
              <div className="rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] p-4 space-y-2.5">
                <p className="text-xs font-semibold text-[#F7931E] inline-flex items-center gap-1.5">
                  <Scissors className="h-3.5 w-3.5 shrink-0" />
                  <span>Resultado técnico do corte</span>
                </p>
                <p className="text-xs sm:text-sm text-[#E5E5E5]/90 leading-relaxed break-words">
                  {analysis.howItWillLookOnYou}
                </p>
                <div className="pt-2 border-t border-[#2B2B2B] space-y-2">
                  <p className="text-xs font-semibold text-white">
                    O que pedir na cadeira do barbeiro
                  </p>
                  <p className="text-xs text-[#E5E5E5]/80 leading-relaxed break-words">
                    {analysis.barberRecommendation}
                  </p>
                  <ul className="space-y-1.5">
                    {analysis.calculations.suggestedAdjustments.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 text-xs text-[#E5E5E5]/85 leading-relaxed"
                      >
                        <Check className="h-3.5 w-3.5 text-[#F7931E] shrink-0 mt-0.5" />
                        <span className="min-w-0 break-words">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Ações secundárias no resultado */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={analyzing}
                  onClick={() => {
                    setAnalysis(null);
                    setStage('scanner');
                  }}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] hover:border-[#F7931E]/60 px-3.5 py-2 text-xs font-medium text-white transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-[#F7931E]" />
                  <span>Refazer leitura Face ID</span>
                </button>
                <button
                  type="button"
                  disabled={analyzing}
                  onClick={() => setStage('manual')}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] hover:border-[#F7931E]/60 px-3.5 py-2 text-xs font-medium text-[#E5E5E5] transition-colors"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 text-[#F7931E]" />
                  <span>Ajustar dados manualmente</span>
                </button>
              </div>
            </section>
          )}

          {/* LGPD */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#E5E5E5]/60">
            <span className="inline-flex items-start gap-1.5 min-w-0">
              <ShieldCheck className="h-4 w-4 text-[#F7931E] shrink-0 mt-0.5" />
              <span className="break-words">
                O Face ID lê apenas em tempo real e mostra somente os dados — nenhuma foto ou
                vídeo é salva ou exibida no resultado.
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
            disabled={analyzing}
            onClick={handleClose}
            className="sm:w-auto min-h-[46px] rounded-xl border border-[#2B2B2B] bg-[#111111] hover:border-[#E5E5E5]/40 px-5 py-2.5 text-sm font-medium text-[#E5E5E5] transition-colors"
          >
            Fechar
          </button>
          <button
            type="button"
            disabled={analyzing}
            onClick={() => {
              handleClose();
              onBookStyle(activePreset.serviceId);
            }}
            className="flex-1 min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] disabled:opacity-60 px-4 py-2.5 text-sm font-semibold text-[#111111] transition-colors text-center"
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
