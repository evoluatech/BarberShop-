'use client';

import {
  Activity,
  AlertTriangle,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  RotateCcw,
  ScanFace,
  Scissors,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Video,
  VideoOff,
  WifiOff,
  X,
} from 'lucide-react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {
  describeCameraError,
  requestCameraStreamWithFallback,
  setCameraPermissionPreference,
  useCameraPermission,
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
import {
  alignmentToMirroredHeadBox,
  analyzeContinuousCameraFrame,
  computeObjectCoverCrop,
  drawLiveCutAROverlay,
  LiveHeadBox,
} from '@/lib/utils/liveFaceIdOverlay';
import {computeManualVisagism} from '@/lib/utils/visagism';

interface VirtualTryOnModalProps {
  open: boolean;
  initialStyleId?: VirtualHairstyleId;
  onClose: () => void;
  onOpenPrivacy: () => void;
  onBookStyle: (serviceId: string) => void;
}

type TryOnStage = 'consent' | 'camera' | 'result';

interface LiveCameraTelemetry {
  brightnessLabel: 'Ideal' | 'Escura' | 'Muito clara';
  lightingOk: boolean;
  framingLabel: string;
  framingOk: boolean;
}

interface BrowserFaceDetector {
  detect: (image: HTMLCanvasElement) => Promise<{boundingBox: DOMRectReadOnly}[]>;
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

function extractLiveVideoFrame(
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
    // Un-mirror front camera orientation for accurate spatial analysis
    ctx.translate(targetW, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, targetW, targetH);
  return canvas.toDataURL('image/jpeg', 0.85);
}

function getServiceMeta(serviceId: string) {
  return SERVICES.find((s) => s.id === serviceId);
}

function ScoreBar({label, value}: {label: string; value: number}) {
  const safeVal = Math.max(0, Math.min(100, Math.round(value)));
  const barColor =
    safeVal >= 80 ? 'bg-emerald-400' : safeVal >= 60 ? 'bg-[#F7931E]' : 'bg-red-400';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#E5E5E5]/80">{label}</span>
        <span className="font-mono font-bold text-white tabular-nums">{safeVal}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-[#2B2B2B] overflow-hidden">
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
  const {preference: cameraPref, denyCamera} = useCameraPermission();

  const [stage, setStage] = useState<TryOnStage>(() =>
    cameraPref === 'granted' ? 'camera' : 'consent'
  );

  // Explicit choice gate: initial scan waits until customer selects a cut or plan
  const [chosenStyleId, setChosenStyleId] = useState<VirtualHairstyleId | null>(null);
  const [selectedStyleId, setSelectedStyleId] = useState<VirtualHairstyleId>(
    initialStyleId || 'corte-degrade'
  );
  const [hasScannedFace, setHasScannedFace] = useState<boolean>(false);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<{
    message: string;
    isIframeBlocked: boolean;
  } | null>(null);
  const [cameraReady, setCameraReady] = useState<boolean>(false);
  const [liveCameraActive, setLiveCameraActive] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [telemetry, setTelemetry] = useState<LiveCameraTelemetry>({
    brightnessLabel: 'Ideal',
    lightingOk: true,
    framingLabel: 'Posicione o rosto dentro do círculo',
    framingOk: false,
  });

  // Live continuous AR & background analysis controls
  const [showCutOverlay, setShowCutOverlay] = useState<boolean>(true);
  const [showGuides, setShowGuides] = useState<boolean>(true);
  const [continuousAnalysisEnabled, setContinuousAnalysisEnabled] =
    useState<boolean>(true);
  const [isContinuousSyncing, setIsContinuousSyncing] = useState<boolean>(false);
  const [lastContinuousSyncLabel, setLastContinuousSyncLabel] = useState<string | null>(
    null
  );

  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<VirtualTryOnAnalysis | null>(null);

  // Explicit manual calculator state (fallback only if user declines/has no camera)
  const [manualFaceShape, setManualFaceShape] = useState<FaceShape>('Oval');
  const [manualHairType, setManualHairType] = useState<HairType>('Ondulado');
  const [manualHairLength, setManualHairLength] = useState<HairLengthCategory>('Médio');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const arCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scannerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestSeqRef = useRef<number>(0);
  const cameraStartingRef = useRef<boolean>(false);
  const facingModeRef = useRef<'user' | 'environment'>(facingMode);
  // Transient memory-only frame from live camera (never displayed or stored as photo)
  const lastLiveFrameRef = useRef<string | null>(null);
  const scanTriggeredRef = useRef<boolean>(false);
  const continuousInFlightRef = useRef<boolean>(false);

  // Real-time smoothed AR head box + sampled live hair tone
  const liveHeadBoxRef = useRef<LiveHeadBox>({
    cx: 0.5,
    cy: 0.45,
    w: 0.42,
    h: 0.56,
    rollRad: 0,
  });
  const targetHeadBoxRef = useRef<LiveHeadBox>({
    cx: 0.5,
    cy: 0.45,
    w: 0.42,
    h: 0.56,
    rollRad: 0,
  });
  const liveHairHexRef = useRef<string>('#1F1A17');

  const isMirrored = facingMode === 'user';

  useEffect(() => {
    facingModeRef.current = facingMode;
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    cameraRequestSeqRef.current += 1;
    cameraStartingRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
    setLiveCameraActive(false);
  }, []);

  const handleCloseModal = useCallback(() => {
    stopCamera();
    lastLiveFrameRef.current = null;
    onClose();
  }, [stopCamera, onClose]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      lastLiveFrameRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleCloseModal]);

  const startCamera = useCallback(
    async (
      targetStage: TryOnStage = 'camera',
      requestedFacing: 'user' | 'environment' = 'user'
    ) => {
      const reqSeq = ++cameraRequestSeqRef.current;
      cameraStartingRef.current = true;
      setCameraError(null);
      setCameraReady(false);
      setScanProgress(0);
      setAnalysisError(null);
      scanTriggeredRef.current = false;

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      setStage(targetStage);
      try {
        const stream = await requestCameraStreamWithFallback(requestedFacing);
        if (reqSeq !== cameraRequestSeqRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        setCameraPermissionPreference('granted');
        streamRef.current = stream;
        setLiveCameraActive(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
          if (reqSeq === cameraRequestSeqRef.current) {
            setCameraReady(true);
          }
        }
      } catch (err) {
        if (reqSeq !== cameraRequestSeqRef.current) {
          return;
        }
        const info = describeCameraError(err);
        if (!info.isIframeBlocked) {
          setCameraPermissionPreference('denied');
        }
        setLiveCameraActive(false);
        setCameraError(info);
      } finally {
        if (reqSeq === cameraRequestSeqRef.current) {
          cameraStartingRef.current = false;
        }
      }
    },
    []
  );

  // Automatically open live camera preview when entering camera stage with granted permission
  useEffect(() => {
    if (
      !open ||
      stage !== 'camera' ||
      streamRef.current ||
      cameraStartingRef.current ||
      cameraError
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (!streamRef.current && !cameraStartingRef.current) {
        startCamera('camera', facingModeRef.current);
      }
    }, 60);
    return () => window.clearTimeout(timer);
  }, [open, stage, cameraError, startCamera]);

  const runLiveVisionAnalysis = useCallback(
    async (
      styleId: VirtualHairstyleId,
      transientFrame: string,
      options?: {
        keepLiveVideo?: boolean;
        silentBackground?: boolean;
      }
    ) => {
      const keepLiveVideo = options?.keepLiveVideo ?? true;
      const silentBackground = options?.silentBackground ?? false;

      if (!navigator.onLine) {
        if (!silentBackground) {
          setAnalysisError(
            'Você está offline. Conecte-se à internet para realizar a leitura Face ID por inteligência artificial.'
          );
        }
        return;
      }

      if (silentBackground) {
        if (continuousInFlightRef.current) return;
        continuousInFlightRef.current = true;
        setIsContinuousSyncing(true);
      } else {
        setAnalyzing(true);
        setAnalysisError(null);
      }

      try {
        const next = await analyzeTryOnVision({
          styleId,
          imageBase64: transientFrame,
          mimeType: 'image/jpeg',
        });

        const calibratedBox = alignmentToMirroredHeadBox(
          next.faceAlignment,
          facingMode === 'user'
        );

        // Blend smooth anchor so live overlay never jumps harshly during continuous updates
        targetHeadBoxRef.current = {
          ...calibratedBox,
          rollRad: targetHeadBoxRef.current.rollRad,
        };
        if (!silentBackground) {
          liveHeadBoxRef.current = calibratedBox;
        }
        if (next.faceAlignment.hairColorHex) {
          liveHairHexRef.current = next.faceAlignment.hairColorHex;
        }

        setAnalysis(next);
        setManualFaceShape(next.faceShape);
        setManualHairType(next.detectedHairType);
        setManualHairLength(next.detectedHairLength);
        setHasScannedFace(true);

        const nowStr = new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        setLastContinuousSyncLabel(`Atualizado ao vivo às ${nowStr}`);

        if (!keepLiveVideo) {
          stopCamera();
        } else if (streamRef.current) {
          setLiveCameraActive(true);
        }
        setStage('result');
      } catch (err) {
        if (!silentBackground) {
          setAnalysisError(
            err instanceof Error
              ? err.message
              : 'Não foi possível concluir a leitura Face ID agora.'
          );
          scanTriggeredRef.current = false;
          setScanProgress(0);
        }
      } finally {
        if (silentBackground) {
          continuousInFlightRef.current = false;
          setIsContinuousSyncing(false);
        } else {
          setAnalyzing(false);
        }
      }
    },
    [facingMode, stopCamera]
  );

  const triggerLiveFrameScan = useCallback(() => {
    if (!videoRef.current || analyzing || scanTriggeredRef.current || !chosenStyleId) {
      return;
    }
    const frame = extractLiveVideoFrame(videoRef.current, isMirrored, 640);
    if (!frame) return;
    scanTriggeredRef.current = true;
    lastLiveFrameRef.current = frame;
    runLiveVisionAnalysis(chosenStyleId, frame, {
      keepLiveVideo: true,
      silentBackground: false,
    });
  }, [analyzing, chosenStyleId, isMirrored, runLiveVisionAnalysis]);

  // Real-time banking-style Face ID scanner loop in 'camera' stage:
  // Continuously measures lighting & framing; waits for `chosenStyleId !== null` to trigger AI scan.
  useEffect(() => {
    if (stage !== 'camera' || !cameraReady || analyzing) return;
    let active = true;
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 160;
    sampleCanvas.height = 213;
    const sampleCtx = sampleCanvas.getContext('2d', {willReadFrequently: true});

    const FaceDetectorCtor = (
      window as unknown as {
        FaceDetector?: new (opts?: {
          fastMode?: boolean;
          maxDetectedFaces?: number;
        }) => BrowserFaceDetector;
      }
    ).FaceDetector;
    const detector = FaceDetectorCtor
      ? new FaceDetectorCtor({fastMode: true, maxDetectedFaces: 1})
      : null;

    const inspectLiveStream = async () => {
      if (!active || !videoRef.current || !sampleCtx || scanTriggeredRef.current) {
        return;
      }
      const video = videoRef.current;
      if (video.readyState < 2 || video.videoWidth === 0) return;

      const crop = computeObjectCoverCrop(
        video.videoWidth,
        video.videoHeight,
        sampleCanvas.width,
        sampleCanvas.height
      );
      sampleCtx.save();
      sampleCtx.clearRect(0, 0, sampleCanvas.width, sampleCanvas.height);
      if (isMirrored) {
        sampleCtx.translate(sampleCanvas.width, 0);
        sampleCtx.scale(-1, 1);
      }
      sampleCtx.drawImage(
        video,
        crop.sx,
        crop.sy,
        crop.sw,
        crop.sh,
        0,
        0,
        sampleCanvas.width,
        sampleCanvas.height
      );
      sampleCtx.restore();

      const cont = analyzeContinuousCameraFrame(
        sampleCtx,
        sampleCanvas.width,
        sampleCanvas.height,
        targetHeadBoxRef.current
      );
      liveHairHexRef.current = cont.liveHairHex;
      targetHeadBoxRef.current = cont.headBox;

      let framingOk = cont.framingOk;
      let framingLabel = !chosenStyleId
        ? 'Escolha o corte ou plano acima para iniciar'
        : framingOk
          ? 'Rosto detectado — escaneando ao vivo'
          : 'Centralize seu rosto dentro do círculo';

      if (detector) {
        try {
          const faces = await detector.detect(sampleCanvas);
          if (faces.length > 0) {
            const box = faces[0].boundingBox;
            const cx = (box.x + box.width / 2) / sampleCanvas.width;
            const ratio = box.width / sampleCanvas.width;
            if (cx >= 0.3 && cx <= 0.7 && ratio >= 0.2 && ratio <= 0.78) {
              framingOk = true;
              targetHeadBoxRef.current = {
                cx,
                cy: Math.max(
                  0.22,
                  Math.min(0.74, (box.y + box.height * 0.42) / sampleCanvas.height)
                ),
                w: Math.max(0.24, Math.min(0.66, ratio * 1.12)),
                h: Math.max(
                  0.32,
                  Math.min(0.76, (box.height / sampleCanvas.height) * 1.24)
                ),
                rollRad: cont.headBox.rollRad,
              };
              framingLabel = !chosenStyleId
                ? 'Rosto pronto — escolha o corte ou plano acima'
                : 'Rosto enquadrado — analisando ao vivo';
            } else if (ratio < 0.2) {
              framingOk = false;
              framingLabel = 'Aproxime um pouco o rosto da câmera';
            } else {
              framingOk = false;
              framingLabel = 'Centralize seu rosto dentro do círculo';
            }
          } else if (!cont.framingOk) {
            framingOk = false;
            framingLabel = 'Posicione seu rosto dentro do círculo';
          }
        } catch {
          // Use continuous pixel symmetry metrics
        }
      }

      if (!active) return;

      setTelemetry({
        brightnessLabel: cont.brightnessLabel,
        lightingOk: cont.lightingOk,
        framingLabel,
        framingOk,
      });

      // Strictly wait for user to choose a cut/plan before advancing scan progress!
      if (!chosenStyleId) {
        setScanProgress(0);
        return;
      }

      setScanProgress((prev) => {
        if (!navigator.onLine) return 0;
        if (framingOk && cont.lightingOk) {
          const next = Math.min(100, prev + 25);
          if (next >= 100 && !scanTriggeredRef.current) {
            window.setTimeout(() => {
              triggerLiveFrameScan();
            }, 0);
          }
          return next;
        }
        return Math.max(0, prev - 20);
      });
    };

    const intervalId = window.setInterval(inspectLiveStream, 260);
    inspectLiveStream();

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [stage, cameraReady, analyzing, chosenStyleId, isMirrored, triggerLiveFrameScan]);

  // Continuous 60fps real-time face-tracked AR haircut overlay loop across BOTH camera & result stages!
  useEffect(() => {
    const activeCanvas =
      stage === 'camera'
        ? scannerCanvasRef.current
        : stage === 'result' && hasScannedFace && liveCameraActive && !cameraError
          ? arCanvasRef.current
          : null;

    if (!activeCanvas || !cameraReady) return;

    let rafId = 0;
    let active = true;
    let lastSampleTime = 0;
    let detectorBusy = false;

    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 160;
    sampleCanvas.height = 213;
    const sampleCtx = sampleCanvas.getContext('2d', {willReadFrequently: true});

    const FaceDetectorCtor = (
      window as unknown as {
        FaceDetector?: new (opts?: {
          fastMode?: boolean;
          maxDetectedFaces?: number;
        }) => BrowserFaceDetector;
      }
    ).FaceDetector;
    const detector = FaceDetectorCtor
      ? new FaceDetectorCtor({fastMode: true, maxDetectedFaces: 1})
      : null;

    const anchorBox = alignmentToMirroredHeadBox(analysis?.faceAlignment, isMirrored);
    const activePreset =
      VIRTUAL_HAIRSTYLE_PRESETS.find((p) => p.id === selectedStyleId) ??
      VIRTUAL_HAIRSTYLE_PRESETS[0];

    const renderLoop = (now: number) => {
      if (!active) return;

      const video = videoRef.current;
      const canvas =
        stage === 'camera' ? scannerCanvasRef.current : arCanvasRef.current;

      if (
        video &&
        canvas &&
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cssW = canvas.clientWidth || 320;
        const cssH = canvas.clientHeight || 426;
        const targetPixelW = Math.round(cssW * dpr);
        const targetPixelH = Math.round(cssH * dpr);

        if (canvas.width !== targetPixelW || canvas.height !== targetPixelH) {
          canvas.width = targetPixelW;
          canvas.height = targetPixelH;
        }

        // In 'result' stage, sample continuously at ~12fps for buttery real-time tracking
        if (stage === 'result' && sampleCtx && now - lastSampleTime > 80) {
          lastSampleTime = now;
          const crop = computeObjectCoverCrop(
            video.videoWidth,
            video.videoHeight,
            sampleCanvas.width,
            sampleCanvas.height
          );
          sampleCtx.save();
          sampleCtx.clearRect(0, 0, sampleCanvas.width, sampleCanvas.height);
          if (isMirrored) {
            sampleCtx.translate(sampleCanvas.width, 0);
            sampleCtx.scale(-1, 1);
          }
          sampleCtx.drawImage(
            video,
            crop.sx,
            crop.sy,
            crop.sw,
            crop.sh,
            0,
            0,
            sampleCanvas.width,
            sampleCanvas.height
          );
          sampleCtx.restore();

          const dynamicAnchor = {
            ...anchorBox,
            cx: anchorBox.cx * 0.2 + targetHeadBoxRef.current.cx * 0.8,
            cy: anchorBox.cy * 0.2 + targetHeadBoxRef.current.cy * 0.8,
          };

          const cont = analyzeContinuousCameraFrame(
            sampleCtx,
            sampleCanvas.width,
            sampleCanvas.height,
            dynamicAnchor
          );
          liveHairHexRef.current = cont.liveHairHex;

          if (detector && !detectorBusy) {
            detectorBusy = true;
            detector
              .detect(sampleCanvas)
              .then((faces) => {
                if (!active) return;
                if (faces.length > 0) {
                  const box = faces[0].boundingBox;
                  const detectedW = Math.max(
                    0.22,
                    Math.min(0.68, (box.width / sampleCanvas.width) * 1.12)
                  );
                  const detectedH = Math.max(
                    0.3,
                    Math.min(0.76, (box.height / sampleCanvas.height) * 1.24)
                  );
                  const detectedCx = Math.max(
                    0.2,
                    Math.min(0.8, (box.x + box.width / 2) / sampleCanvas.width)
                  );
                  const detectedCy = Math.max(
                    0.22,
                    Math.min(0.74, (box.y + box.height * 0.42) / sampleCanvas.height)
                  );
                  targetHeadBoxRef.current = {
                    cx: detectedCx,
                    cy: detectedCy,
                    w: detectedW,
                    h: detectedH,
                    rollRad: cont.headBox.rollRad,
                  };
                } else {
                  targetHeadBoxRef.current = cont.headBox;
                }
              })
              .catch(() => {
                if (active) {
                  targetHeadBoxRef.current = cont.headBox;
                }
              })
              .finally(() => {
                detectorBusy = false;
              });
          } else if (!detector) {
            targetHeadBoxRef.current = cont.headBox;
          }
        }

        // Smooth 60fps exponential interpolation across position, scale, and tilt
        const lerp = 0.24;
        liveHeadBoxRef.current = {
          cx:
            liveHeadBoxRef.current.cx +
            (targetHeadBoxRef.current.cx - liveHeadBoxRef.current.cx) * lerp,
          cy:
            liveHeadBoxRef.current.cy +
            (targetHeadBoxRef.current.cy - liveHeadBoxRef.current.cy) * lerp,
          w:
            liveHeadBoxRef.current.w +
            (targetHeadBoxRef.current.w - liveHeadBoxRef.current.w) * lerp,
          h:
            liveHeadBoxRef.current.h +
            (targetHeadBoxRef.current.h - liveHeadBoxRef.current.h) * lerp,
          rollRad:
            liveHeadBoxRef.current.rollRad +
            (targetHeadBoxRef.current.rollRad - liveHeadBoxRef.current.rollRad) * lerp,
        };

        const arCtx = canvas.getContext('2d');
        if (arCtx) {
          arCtx.save();
          arCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
          drawLiveCutAROverlay(arCtx, cssW, cssH, {
            styleId: stage === 'camera' ? chosenStyleId : selectedStyleId,
            styleName: activePreset.name,
            compatibilityScore: analysis?.calculations.overallScore,
            headBox: liveHeadBoxRef.current,
            alignment: analysis?.faceAlignment,
            showCutOverlay:
              stage === 'camera' ? Boolean(chosenStyleId) : showCutOverlay,
            showGuides: stage === 'camera' ? true : showGuides,
            detectedHairType: analysis?.detectedHairType,
            faceShape: analysis?.faceShape,
            liveHairHex: liveHairHexRef.current,
          });
          arCtx.restore();
        }
      }

      rafId = window.requestAnimationFrame(renderLoop);
    };

    rafId = window.requestAnimationFrame(renderLoop);
    return () => {
      active = false;
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [
    stage,
    cameraReady,
    hasScannedFace,
    liveCameraActive,
    cameraError,
    chosenStyleId,
    selectedStyleId,
    showCutOverlay,
    showGuides,
    isMirrored,
    analysis,
  ]);

  // Continuous live AI background analysis loop:
  // Keeps head shape, hair texture, length sufficiency, and visagism scores synced continuously
  // from the active camera stream without interrupting the live AR preview or saving static photos.
  useEffect(() => {
    if (
      !open ||
      stage !== 'result' ||
      !hasScannedFace ||
      !liveCameraActive ||
      !continuousAnalysisEnabled ||
      !isOnline ||
      analyzing ||
      cameraError
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      if (continuousInFlightRef.current) return;

      const freshFrame = extractLiveVideoFrame(videoRef.current, isMirrored, 640);
      if (!freshFrame) return;
      lastLiveFrameRef.current = freshFrame;
      runLiveVisionAnalysis(selectedStyleId, freshFrame, {
        keepLiveVideo: true,
        silentBackground: true,
      });
    }, 7500);

    return () => window.clearInterval(intervalId);
  }, [
    open,
    stage,
    hasScannedFace,
    liveCameraActive,
    continuousAnalysisEnabled,
    isOnline,
    analyzing,
    cameraError,
    selectedStyleId,
    isMirrored,
    runLiveVisionAnalysis,
  ]);

  const runManualCalculation = useCallback(
    async (
      styleId: VirtualHairstyleId,
      faceShape: FaceShape,
      hairType: HairType,
      hairLength: HairLengthCategory
    ) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setAnalysisError(null);
        setAnalysis(
          computeManualVisagism({
            styleId,
            faceShape,
            hairType,
            hairLength,
          })
        );
        return;
      }

      setAnalyzing(true);
      setAnalysisError(null);
      try {
        const nextAnalysis = await calculateTryOnManual({
          styleId,
          manualFaceShape: faceShape,
          manualHairType: hairType,
          manualHairLength: hairLength,
        });
        setAnalysis(nextAnalysis);
      } catch {
        setAnalysis(
          computeManualVisagism({
            styleId,
            faceShape,
            hairType,
            hairLength,
          })
        );
      } finally {
        setAnalyzing(false);
      }
    },
    []
  );

  const attachVideoElement = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current) {
      if (el.srcObject !== streamRef.current) {
        el.srcObject = streamRef.current;
        el.play().catch(() => undefined);
      }
      if (el.readyState >= 2) {
        setCameraReady(true);
      }
    }
  }, []);

  const handleStartManualWithoutCamera = () => {
    stopCamera();
    lastLiveFrameRef.current = null;
    setHasScannedFace(false);
    setAnalysis(null);
    const fallbackStyle = chosenStyleId ?? selectedStyleId;
    setChosenStyleId(fallbackStyle);
    setSelectedStyleId(fallbackStyle);
    setStage('result');
    runManualCalculation(
      fallbackStyle,
      manualFaceShape,
      manualHairType,
      manualHairLength
    );
  };

  const handleChooseServiceForScan = (presetId: VirtualHairstyleId) => {
    setChosenStyleId(presetId);
    setSelectedStyleId(presetId);
    setScanProgress(0);
    setAnalysisError(null);
    scanTriggeredRef.current = false;
  };

  const handleSwitchStyle = (nextStyleId: VirtualHairstyleId) => {
    setChosenStyleId(nextStyleId);
    setSelectedStyleId(nextStyleId);
    if (stage === 'camera') {
      setScanProgress(0);
      scanTriggeredRef.current = false;
      return;
    }

    if (hasScannedFace) {
      const freshLiveFrame =
        liveCameraActive && videoRef.current
          ? extractLiveVideoFrame(videoRef.current, isMirrored, 640)
          : null;
      const frameToAnalyze = freshLiveFrame || lastLiveFrameRef.current;
      if (frameToAnalyze) {
        lastLiveFrameRef.current = frameToAnalyze;
        runLiveVisionAnalysis(nextStyleId, frameToAnalyze, {
          keepLiveVideo: liveCameraActive,
          silentBackground: false,
        });
        return;
      }
    }

    runManualCalculation(
      nextStyleId,
      manualFaceShape,
      manualHairType,
      manualHairLength
    );
  };

  const handleResetToLiveScan = () => {
    setAnalysis(null);
    setAnalysisError(null);
    setScanProgress(0);
    setChosenStyleId(null);
    setLastContinuousSyncLabel(null);
    scanTriggeredRef.current = false;
    startCamera('camera', facingMode);
  };

  const handleToggleLiveCameraInResult = () => {
    if (liveCameraActive) {
      stopCamera();
    } else {
      startCamera('result', facingMode);
    }
  };

  const handleToggleFacingMode = () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
    startCamera(stage === 'result' ? 'result' : 'camera', nextFacing);
  };

  if (!open) return null;

  const activePreset =
    VIRTUAL_HAIRSTYLE_PRESETS.find((p) => p.id === selectedStyleId) ??
    VIRTUAL_HAIRSTYLE_PRESETS[0];

  const activeServiceMeta = getServiceMeta(activePreset.serviceId);

  const betterAltPreset = analysis?.calculations.betterAlternativeStyleId
    ? VIRTUAL_HAIRSTYLE_PRESETS.find(
        (p) => p.id === analysis.calculations.betterAlternativeStyleId
      )
    : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tryon-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCloseModal();
      }}
    >
      <div className="w-full sm:max-w-3xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-[#1C1C1C] border border-[#2B2B2B] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3.5 sm:px-5 sm:py-4 border-b border-[#2B2B2B]">
          <div className="flex items-center gap-2.5 min-w-0">
            <ScanFace className="h-5 w-5 text-[#F7931E] shrink-0" />
            <h2
              id="tryon-modal-title"
              className="font-display text-sm sm:text-lg font-bold text-white leading-snug"
            >
              Face ID Contínuo & Prévia do Corte ao Vivo (IA)
            </h2>
          </div>
          <button
            type="button"
            onClick={handleCloseModal}
            aria-label="Fechar análise Face ID"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#E5E5E5]/70 hover:text-white hover:bg-[#2B2B2B] transition-colors shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {!isOnline && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 flex items-start gap-2.5 text-xs text-amber-200">
              <WifiOff className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Você está offline. A leitura Face ID contínua com inteligência
                artificial exige conexão com a internet.
              </span>
            </div>
          )}

          {/* Etapa 1: Permissão da câmera */}
          {stage === 'consent' && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-[#2B2B2B] bg-[#111111] p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-6 w-6 text-[#F7931E] shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <h3 className="font-display text-lg font-bold text-white">
                      Análise contínua pela câmera + corte acompanhando seu rosto ao
                      vivo
                    </h3>
                    <p className="text-sm leading-relaxed text-[#E5E5E5]/80">
                      Primeiro você escolhe o corte ou plano desejado. Em seguida, nossa
                      câmera Face ID analisa continuamente o formato da sua cabeça e o
                      estilo do seu cabelo em tempo real, mantendo a sobreposição do
                      corte alinhada ao seu rosto enquanto você se movimenta — sem tirar
                      foto estática.
                    </p>
                  </div>
                </div>

                {cameraPref === 'denied' && (
                  <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3.5 text-xs text-amber-200 flex items-start gap-2.5">
                    <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      O acesso à câmera está desativado nas suas preferências. Libere a
                      câmera abaixo para iniciar o espelho Face ID contínuo.
                    </span>
                  </div>
                )}

                <ul className="space-y-2 text-xs sm:text-sm text-[#E5E5E5]/75 pl-1">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#F7931E] shrink-0 mt-0.5" />
                    <span>
                      Você escolhe o corte ou combo antes da IA iniciar a leitura.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#F7931E] shrink-0 mt-0.5" />
                    <span>
                      Rastreamento contínuo em webcam ou câmera do celular: o corte
                      acompanha posição, distância e inclinação da sua cabeça em tempo
                      real.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#F7931E] shrink-0 mt-0.5" />
                    <span>Nenhuma foto estática é tirada ou salva.</span>
                  </li>
                </ul>

                <button
                  type="button"
                  onClick={onOpenPrivacy}
                  className="text-xs font-medium text-[#F7931E] hover:underline"
                >
                  Ler Política de Privacidade (LGPD)
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => startCamera('camera', facingMode)}
                  className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-4 py-3 text-sm font-semibold text-[#111111] transition-colors"
                >
                  <ScanFace className="h-4 w-4" />
                  <span>Permitir e escolher corte</span>
                </button>

                <button
                  type="button"
                  onClick={handleStartManualWithoutCamera}
                  className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#2B2B2B] bg-[#111111] hover:border-[#F7931E]/60 px-4 py-3 text-sm font-medium text-white transition-colors"
                >
                  <SlidersHorizontal className="h-4 w-4 text-[#F7931E]" />
                  <span>Cálculo sem câmera</span>
                </button>

                {cameraPref !== 'denied' && (
                  <button
                    type="button"
                    onClick={() => {
                      denyCamera();
                    }}
                    className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#2B2B2B] bg-[#111111] hover:border-red-500/40 px-4 py-3 text-sm font-medium text-[#E5E5E5]/80 transition-colors"
                  >
                    <X className="h-4 w-4 text-red-400" />
                    <span>Recusar câmera</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Etapa 2: Escolha obrigatória do corte/plano + Scanner contínuo ao vivo */}
          {stage === 'camera' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#2B2B2B] bg-[#111111] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Scissors className="h-4 w-4 text-[#F7931E] shrink-0" />
                    <p className="text-xs sm:text-sm font-semibold text-white">
                      1. Escolha o corte ou plano para o Face ID analisar ao vivo:
                    </p>
                  </div>
                  {!chosenStyleId && (
                    <span className="text-[11px] font-medium text-[#F7931E]">
                      Obrigatório antes da leitura
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {VIRTUAL_HAIRSTYLE_PRESETS.map((preset) => {
                    const isSelected = chosenStyleId === preset.id;
                    const isSuggested = !chosenStyleId && initialStyleId === preset.id;
                    const serviceMeta = getServiceMeta(preset.serviceId);

                    return (
                      <button
                        key={preset.id}
                        type="button"
                        disabled={analyzing}
                        onClick={() => handleChooseServiceForScan(preset.id)}
                        className={`text-left rounded-xl p-3 border transition-all ${
                          isSelected
                            ? 'border-[#F7931E] bg-[#F7931E]/15 text-white'
                            : isSuggested
                              ? 'border-[#F7931E]/60 bg-[#1C1C1C] text-white hover:border-[#F7931E]'
                              : 'border-[#2B2B2B] bg-[#1C1C1C] text-[#E5E5E5] hover:border-[#F7931E]/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold leading-snug">
                            {preset.name}
                          </span>
                          {isSelected && (
                            <CheckCircle2 className="h-4 w-4 text-[#F7931E] shrink-0" />
                          )}
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-[#E5E5E5]/65">
                          {serviceMeta ? (
                            <span className="font-mono tabular-nums text-[#F7931E]">
                              {formatCurrencyBRL(serviceMeta.priceCents)} ·{' '}
                              {formatDuration(serviceMeta.durationMinutes)}
                            </span>
                          ) : (
                            <span>{preset.idealFaces}</span>
                          )}
                          {isSuggested && (
                            <span className="text-[10px] text-[#F7931E] font-medium">
                              Toque p/ iniciar
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {cameraError ? (
                <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-100 leading-relaxed">
                      {cameraError.message}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {cameraError.isIframeBlocked && typeof window !== 'undefined' && (
                      <a
                        href={`${window.location.origin}${window.location.pathname}${window.location.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-4 py-2 text-sm font-semibold text-[#111111]"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span>Abrir em nova aba (liberar câmera)</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => startCamera('camera', facingMode)}
                      className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
                        cameraError.isIframeBlocked
                          ? 'border border-[#2B2B2B] bg-[#111111] text-white'
                          : 'bg-[#F7931E] text-[#111111]'
                      }`}
                    >
                      <Camera className="h-4 w-4" />
                      <span>Tentar liberar câmera</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleStartManualWithoutCamera}
                      className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-[#2B2B2B] bg-[#111111] px-4 py-2 text-sm font-medium text-white"
                    >
                      <span>Usar cálculo sem câmera</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Status em tempo real */}
                  <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                    <span
                      className={`px-3 py-1 rounded-lg border ${
                        telemetry.lightingOk
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                          : 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                      }`}
                    >
                      Iluminação: {telemetry.brightnessLabel}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-lg border ${
                        !chosenStyleId
                          ? 'border-[#F7931E]/50 bg-[#F7931E]/10 text-[#F7931E]'
                          : telemetry.framingOk
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                            : 'border-[#2B2B2B] bg-[#111111] text-[#E5E5E5]/80'
                      }`}
                    >
                      {analyzing
                        ? 'IA analisando formato e fios...'
                        : telemetry.framingLabel}
                    </span>
                  </div>

                  {/* Moldura circular Face ID com prévia AR rastreada já durante a leitura */}
                  <div
                    className="relative mx-auto w-64 h-64 min-[380px]:w-72 min-[380px]:h-72 sm:w-80 sm:h-80 rounded-full p-1.5 transition-all"
                    style={{
                      background: `conic-gradient(#F7931E 0% ${
                        analyzing ? 100 : scanProgress
                      }%, #2B2B2B ${analyzing ? 100 : scanProgress}% 100%)`,
                    }}
                  >
                    <div className="relative h-full w-full rounded-full overflow-hidden bg-[#111111]">
                      <video
                        ref={attachVideoElement}
                        onLoadedMetadata={() => setCameraReady(true)}
                        playsInline
                        muted
                        className={`h-full w-full object-cover ${
                          isMirrored ? 'scale-x-[-1]' : ''
                        }`}
                      />
                      <canvas
                        ref={scannerCanvasRef}
                        className="pointer-events-none absolute inset-0 h-full w-full"
                        aria-hidden="true"
                      />

                      {!cameraReady && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#111111]/85 text-xs text-[#E5E5E5]/75">
                          <Loader2 className="h-6 w-6 text-[#F7931E] animate-spin" />
                          <span>Abrindo câmera Face ID...</span>
                        </div>
                      )}

                      {cameraReady && !chosenStyleId && !analyzing && (
                        <div className="pointer-events-none absolute inset-x-4 bottom-6 rounded-xl bg-[#111111]/85 border border-[#F7931E]/50 px-3 py-2 text-center">
                          <p className="text-[11px] font-semibold text-[#F7931E]">
                            Aguardando escolha do serviço
                          </p>
                          <p className="text-[10px] text-[#E5E5E5]/80">
                            Toque no corte ou plano acima para iniciar
                          </p>
                        </div>
                      )}

                      {analyzing && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-[#111111]/65 text-center px-6">
                          <Loader2 className="h-8 w-8 text-[#F7931E] animate-spin" />
                          <p className="text-xs font-semibold text-white">
                            Analisando formato da cabeça e fios para {activePreset.name}
                            ...
                          </p>
                        </div>
                      )}

                      <div
                        className="pointer-events-none absolute inset-4 rounded-full border-2 border-dashed border-white/25"
                        aria-hidden="true"
                      />
                    </div>
                  </div>

                  <div className="text-center space-y-1">
                    <p className="font-mono text-xs font-semibold text-[#F7931E] tabular-nums">
                      {!chosenStyleId
                        ? 'Passo 1 pendente: selecione o corte ou plano acima'
                        : analyzing
                          ? 'Processando leitura biométrica por IA...'
                          : `Leitura contínua (${activePreset.name}): ${scanProgress}%`}
                    </p>
                    <p className="text-xs text-[#E5E5E5]/65">
                      Sem tirar foto estática — o scanner acompanha seu rosto direto no
                      vídeo ao vivo.
                    </p>
                  </div>

                  {analysisError && (
                    <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200 space-y-2.5">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{analysisError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleStartManualWithoutCamera}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#F7931E]/50 bg-[#F7931E]/15 hover:bg-[#F7931E]/25 px-3 py-1.5 text-[11px] font-semibold text-[#F7931E] transition-colors"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        <span>Usar cálculo manual sem IA</span>
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={triggerLiveFrameScan}
                      disabled={
                        !chosenStyleId || !cameraReady || !isOnline || analyzing
                      }
                      className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] disabled:opacity-45 px-5 py-2.5 text-sm font-semibold text-[#111111] transition-colors"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>
                        {chosenStyleId
                          ? `Analisar ${activePreset.name} agora`
                          : 'Escolha um serviço acima'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleFacingMode}
                      className="min-h-[46px] inline-flex items-center gap-2 rounded-xl border border-[#2B2B2B] bg-[#111111] hover:border-[#F7931E]/50 px-4 py-2.5 text-xs sm:text-sm font-medium text-white"
                    >
                      <RefreshCw className="h-4 w-4 text-[#F7931E]" />
                      <span>Trocar câmera</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        stopCamera();
                        setStage('consent');
                      }}
                      className="min-h-[46px] rounded-xl border border-[#2B2B2B] bg-[#111111] px-4 py-2.5 text-sm font-medium text-white"
                    >
                      Sair da câmera
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Etapa 3: Espelho AR ao vivo contínuo + Relatório Real */}
          {stage === 'result' && (
            <div className="space-y-5">
              {/* Cabeçalho de status */}
              <div className="rounded-2xl border border-[#2B2B2B] bg-[#111111] p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-[#1C1C1C] border border-[#2B2B2B] flex items-center justify-center shrink-0">
                    {hasScannedFace ? (
                      <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                    ) : (
                      <SlidersHorizontal className="h-5 w-5 text-[#F7931E]" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">
                      {hasScannedFace
                        ? 'Rastreamento contínuo Face ID ativo'
                        : 'Cálculo manual sem câmera'}
                    </p>
                    <p className="text-xs text-[#E5E5E5]/65">
                      {hasScannedFace
                        ? lastContinuousSyncLabel ||
                          'Movimente ou incline a cabeça no vídeo: o corte acompanha seu rosto em tempo real.'
                        : 'Ative o Face ID contínuo para ver o corte acompanhando seu rosto em tempo real.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleResetToLiveScan}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] hover:border-[#F7931E]/60 px-3.5 py-2 text-xs font-medium text-white"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-[#F7931E]" />
                  <span>
                    {hasScannedFace ? 'Reiniciar scanner' : 'Abrir Face ID ao vivo'}
                  </span>
                </button>
              </div>

              {/* Espelho ao vivo contínuo com projeção AR que acompanha posição, escala e inclinação */}
              {hasScannedFace && (
                <div className="rounded-2xl border border-[#2B2B2B] bg-[#111111] p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          liveCameraActive
                            ? 'bg-emerald-400 animate-pulse'
                            : 'bg-[#E5E5E5]/40'
                        }`}
                      />
                      <span className="text-xs font-semibold text-white">
                        {liveCameraActive
                          ? `Espelho AR ao vivo: ${activePreset.name}`
                          : 'Vídeo ao vivo pausado'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {liveCameraActive && (
                        <>
                          <button
                            type="button"
                            onClick={() => setShowCutOverlay((prev) => !prev)}
                            className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                              showCutOverlay
                                ? 'border-[#F7931E] bg-[#F7931E]/15 text-[#F7931E]'
                                : 'border-[#2B2B2B] bg-[#1C1C1C] text-[#E5E5E5]/75'
                            }`}
                          >
                            {showCutOverlay ? (
                              <Eye className="h-3.5 w-3.5" />
                            ) : (
                              <EyeOff className="h-3.5 w-3.5" />
                            )}
                            <span>Prévia do corte</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowGuides((prev) => !prev)}
                            className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                              showGuides
                                ? 'border-[#F7931E] bg-[#F7931E]/15 text-[#F7931E]'
                                : 'border-[#2B2B2B] bg-[#1C1C1C] text-[#E5E5E5]/75'
                            }`}
                          >
                            <ScanFace className="h-3.5 w-3.5" />
                            <span>Guias visagismo</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setContinuousAnalysisEnabled((prev) => !prev)
                            }
                            className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                              continuousAnalysisEnabled
                                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                                : 'border-[#2B2B2B] bg-[#1C1C1C] text-[#E5E5E5]/75'
                            }`}
                          >
                            <Activity className="h-3.5 w-3.5" />
                            <span>
                              {continuousAnalysisEnabled
                                ? 'Análise contínua: ON'
                                : 'Análise contínua: OFF'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={handleToggleFacingMode}
                            title="Alternar entre webcam frontal e câmera traseira"
                            className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg border border-[#2B2B2B] bg-[#1C1C1C] hover:border-[#F7931E]/60 px-2.5 py-1 text-[11px] font-medium text-white"
                          >
                            <RefreshCw className="h-3.5 w-3.5 text-[#F7931E]" />
                            <span>Alternar câmera</span>
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={handleToggleLiveCameraInResult}
                        className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg border border-[#2B2B2B] bg-[#1C1C1C] hover:border-[#F7931E]/60 px-2.5 py-1 text-[11px] font-medium text-white"
                      >
                        {liveCameraActive ? (
                          <>
                            <VideoOff className="h-3.5 w-3.5 text-[#E5E5E5]/75" />
                            <span>Pausar vídeo</span>
                          </>
                        ) : (
                          <>
                            <Video className="h-3.5 w-3.5 text-[#F7931E]" />
                            <span>Reativar ao vivo</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {liveCameraActive ? (
                    <div className="relative mx-auto w-full max-w-[340px] aspect-[3/4] rounded-2xl overflow-hidden border border-[#2B2B2B] bg-black">
                      <video
                        ref={attachVideoElement}
                        onLoadedMetadata={() => setCameraReady(true)}
                        playsInline
                        muted
                        autoPlay
                        className={`h-full w-full object-cover ${
                          isMirrored ? 'scale-x-[-1]' : ''
                        }`}
                      />
                      <canvas
                        ref={arCanvasRef}
                        className="pointer-events-none absolute inset-0 h-full w-full"
                        aria-hidden="true"
                      />

                      {/* HUD ao vivo compacto */}
                      <div className="pointer-events-none absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#111111]/85 border border-[#2B2B2B] px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>
                            {continuousAnalysisEnabled
                              ? 'AO VIVO · CONTÍNUO'
                              : 'AO VIVO'}
                          </span>
                        </div>

                        {isContinuousSyncing && (
                          <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#111111]/85 border border-[#F7931E]/40 px-2.5 py-1 text-[10px] font-medium text-[#F7931E]">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Recalculando IA...</span>
                          </div>
                        )}
                      </div>

                      {analysis && (
                        <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-xl bg-[#111111]/85 border border-[#2B2B2B] px-3 py-2 flex items-center justify-between gap-2 text-xs">
                          <div className="min-w-0">
                            <p className="font-semibold text-white truncate">
                              {activePreset.name}
                            </p>
                            <p className="text-[11px] text-[#E5E5E5]/70 truncate">
                              Rosto {analysis.faceShape} · Fio{' '}
                              {analysis.detectedHairType.toLowerCase()} ·{' '}
                              {analysis.detectedHairLength.toLowerCase()}
                            </p>
                          </div>
                          <span className="font-mono text-sm font-bold text-[#F7931E] tabular-nums shrink-0">
                            {analysis.calculations.overallScore}%
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-[#2B2B2B] bg-[#1C1C1C] p-5 text-center space-y-2">
                      <p className="text-xs text-[#E5E5E5]/75">
                        A câmera está pausada. O relatório completo abaixo continua
                        disponível ou você pode reativar o vídeo contínuo a qualquer
                        momento.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Seletores manuais (exibidos apenas no modo manual sem câmera) */}
              {!hasScannedFace && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-2xl border border-[#2B2B2B] bg-[#111111] p-4">
                  <div className="space-y-1">
                    <label
                      htmlFor="manual-face"
                      className="block text-[11px] text-[#E5E5E5]/70"
                    >
                      Formato estimado do rosto
                    </label>
                    <select
                      id="manual-face"
                      value={manualFaceShape}
                      onChange={(e) => {
                        const next = e.target.value as FaceShape;
                        setManualFaceShape(next);
                        runManualCalculation(
                          selectedStyleId,
                          next,
                          manualHairType,
                          manualHairLength
                        );
                      }}
                      className="w-full min-h-[40px] rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] px-3 text-xs text-white"
                    >
                      {FACE_SHAPES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="manual-hair-type"
                      className="block text-[11px] text-[#E5E5E5]/70"
                    >
                      Tipo do seu cabelo
                    </label>
                    <select
                      id="manual-hair-type"
                      value={manualHairType}
                      onChange={(e) => {
                        const next = e.target.value as HairType;
                        setManualHairType(next);
                        runManualCalculation(
                          selectedStyleId,
                          manualFaceShape,
                          next,
                          manualHairLength
                        );
                      }}
                      className="w-full min-h-[40px] rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] px-3 text-xs text-white"
                    >
                      {HAIR_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="manual-hair-length"
                      className="block text-[11px] text-[#E5E5E5]/70"
                    >
                      Comprimento atual
                    </label>
                    <select
                      id="manual-hair-length"
                      value={manualHairLength}
                      onChange={(e) => {
                        const next = e.target.value as HairLengthCategory;
                        setManualHairLength(next);
                        runManualCalculation(
                          selectedStyleId,
                          manualFaceShape,
                          manualHairType,
                          next
                        );
                      }}
                      className="w-full min-h-[40px] rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] px-3 text-xs text-white"
                    >
                      {HAIR_LENGTHS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Trocar estilo / plano para comparar ao vivo */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-[#E5E5E5]/75">
                  Testar outros cortes ou planos ao vivo no seu rosto:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {VIRTUAL_HAIRSTYLE_PRESETS.map((preset) => {
                    const active = preset.id === selectedStyleId;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        disabled={analyzing}
                        onClick={() => handleSwitchStyle(preset.id)}
                        className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          active
                            ? 'bg-[#F7931E] text-[#111111] font-semibold'
                            : 'bg-[#111111] border border-[#2B2B2B] text-[#E5E5E5] hover:border-[#F7931E]/50'
                        }`}
                      >
                        {preset.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Relatório completo da IA */}
              <div className="rounded-2xl border border-[#2B2B2B] bg-[#111111] p-5 space-y-4">
                {analyzing ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                    <Loader2 className="h-7 w-7 text-[#F7931E] animate-spin" />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-white">
                        Recalculando compatibilidade para {activePreset.name}...
                      </p>
                      <p className="text-xs text-[#E5E5E5]/65">
                        Avaliando formato da cabeça, textura do fio e comprimento atual.
                      </p>
                    </div>
                  </div>
                ) : analysisError ? (
                  <div className="space-y-3">
                    <p className="text-xs sm:text-sm text-red-300 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{analysisError}</span>
                    </p>
                    <button
                      type="button"
                      onClick={handleResetToLiveScan}
                      className="min-h-[40px] rounded-xl bg-[#F7931E] px-4 py-2 text-xs font-semibold text-[#111111]"
                    >
                      Reiniciar scanner Face ID
                    </button>
                  </div>
                ) : analysis ? (
                  <>
                    {!analysis.imageQualityOk && analysis.imageQualityMessage && (
                      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3.5 text-xs text-red-200 flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="font-semibold text-white">
                              Leitura facial comprometida
                            </p>
                            <p>{analysis.imageQualityMessage}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleResetToLiveScan}
                          className="shrink-0 rounded-lg bg-red-500/20 border border-red-400/40 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Reescanear
                        </button>
                      </div>
                    )}

                    {/* Veredito & Nota Geral */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#2B2B2B]">
                      <div className="space-y-0.5">
                        <span className="text-[11px] uppercase tracking-wider text-[#E5E5E5]/55">
                          Resultado ao vivo para {activePreset.name}
                        </span>
                        <p className="text-lg font-bold text-[#F7931E]">
                          {analysis.calculations.verdictStatus}
                        </p>
                      </div>
                      <div className="rounded-xl bg-[#1C1C1C] border border-[#2B2B2B] px-4 py-2 text-center">
                        <p className="text-[10px] text-[#E5E5E5]/60">Compatibilidade</p>
                        <p className="font-mono text-2xl font-bold text-white tabular-nums">
                          {analysis.calculations.overallScore}%
                        </p>
                      </div>
                    </div>

                    {/* Características reais detectadas */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] p-3">
                        <p className="text-[#E5E5E5]/55 text-[11px]">
                          Formato da cabeça / rosto
                        </p>
                        <p className="font-semibold text-white text-sm mt-0.5">
                          {analysis.faceShape}
                        </p>
                      </div>
                      <div className="rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] p-3">
                        <p className="text-[#E5E5E5]/55 text-[11px]">
                          Tipo de cabelo identificado
                        </p>
                        <p className="font-semibold text-white text-sm mt-0.5">
                          {analysis.detectedHairType}
                        </p>
                      </div>
                      <div className="rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] p-3">
                        <p className="text-[#E5E5E5]/55 text-[11px]">
                          Comprimento atual
                        </p>
                        <p className="font-semibold text-white text-sm mt-0.5">
                          {analysis.detectedHairLength}
                        </p>
                      </div>
                    </div>

                    {/* Alerta sincero de risco */}
                    {analysis.calculations.riskWarning && (
                      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-2.5">
                        <div className="flex items-start gap-2.5 text-xs text-amber-100">
                          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-white text-sm">
                              Atenção antes de cortar
                            </p>
                            <p className="mt-0.5 leading-relaxed">
                              {analysis.calculations.riskWarning}
                            </p>
                          </div>
                        </div>
                        {betterAltPreset && (
                          <button
                            type="button"
                            onClick={() => handleSwitchStyle(betterAltPreset.id)}
                            className="min-h-[38px] rounded-lg bg-[#F7931E] hover:bg-[#D97706] px-3.5 py-1.5 text-xs font-semibold text-[#111111]"
                          >
                            Testar alternativa recomendada: {betterAltPreset.name}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Cálculos quantitativos */}
                    <div className="space-y-3 pt-1">
                      <p className="text-xs font-semibold text-white">
                        Cálculo técnico de visagismo
                      </p>
                      <ScoreBar
                        label="Harmonia com o formato da cabeça"
                        value={analysis.calculations.headShapeFitScore}
                      />
                      <ScoreBar
                        label={`Adequação ao fio ${analysis.detectedHairType.toLowerCase()}`}
                        value={analysis.calculations.hairTextureFitScore}
                      />
                      <ScoreBar
                        label="Suficiência do comprimento atual"
                        value={analysis.calculations.lengthSufficiencyScore}
                      />
                    </div>

                    {/* Como vai ficar na cabeça e no fio */}
                    <div className="space-y-1.5 pt-3 border-t border-[#2B2B2B]">
                      <p className="text-xs font-semibold text-white">
                        Como este corte vai ficar em você
                      </p>
                      <p className="text-sm leading-relaxed text-[#E5E5E5]/90">
                        {analysis.howItWillLookOnYou}
                      </p>
                    </div>

                    {/* Observações detalhadas */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3 border-t border-[#2B2B2B] text-xs text-[#E5E5E5]/75">
                      <p>
                        <strong className="text-white">Estrutura craniana:</strong>{' '}
                        {analysis.cranialGeometry}
                      </p>
                      <p>
                        <strong className="text-white">Linha frontal:</strong>{' '}
                        {analysis.hairlineObservation}
                      </p>
                      <p>
                        <strong className="text-white">Volume e textura:</strong>{' '}
                        {analysis.apparentVolume}
                      </p>
                      <p>
                        <strong className="text-white">Barba / contorno:</strong>{' '}
                        {analysis.beardObservation}
                      </p>
                    </div>

                    {/* Ajustes para o barbeiro */}
                    {analysis.calculations.suggestedAdjustments.length > 0 && (
                      <div className="pt-3 border-t border-[#2B2B2B] space-y-1.5">
                        <p className="text-xs font-semibold text-white">
                          Orientações para pedir ao barbeiro:
                        </p>
                        <ul className="space-y-1 text-xs text-[#E5E5E5]/85">
                          {analysis.calculations.suggestedAdjustments.map(
                            (adj, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <Check className="h-3.5 w-3.5 text-[#F7931E] shrink-0 mt-0.5" />
                                <span>{adj}</span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                  </>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => {
                  handleCloseModal();
                  onBookStyle(activePreset.serviceId);
                }}
                className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-5 py-3 text-sm font-semibold text-[#111111] transition-colors"
              >
                <Calendar className="h-4 w-4" />
                <span>
                  Agendar {activePreset.name}
                  {activeServiceMeta
                    ? ` · ${formatCurrencyBRL(activeServiceMeta.priceCents)}`
                    : ''}
                </span>
              </button>
            </div>
          )}

          {/* Aviso de transparência */}
          <div className="rounded-xl border border-[#2B2B2B] bg-[#111111] p-3.5 text-xs leading-relaxed text-[#E5E5E5]/70">
            “A leitura Face ID analisa continuamente ao vivo o formato da sua cabeça,
            textura e comprimento do cabelo por inteligência artificial, mantendo o
            corte alinhado ao seu rosto no vídeo em tempo real sem tirar fotos
            estáticas. Confirme sempre os ajustes finais com o barbeiro.”
          </div>
        </div>
      </div>
    </div>
  );
}
