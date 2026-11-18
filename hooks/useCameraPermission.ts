'use client';

import {useCallback, useSyncExternalStore} from 'react';

export type CameraPermissionPreference = 'unset' | 'granted' | 'denied';

const STORAGE_KEY = 'barber_shop_camera_pref_v1';
const CHANGE_EVENT = 'barber-shop-camera-pref-change';

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function getSnapshot(): CameraPermissionPreference {
  if (typeof window === 'undefined') return 'unset';
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'granted' || raw === 'denied') return raw;
    return 'unset';
  } catch {
    return 'unset';
  }
}

function getServerSnapshot(): CameraPermissionPreference {
  return 'unset';
}

export function setCameraPermissionPreference(pref: CameraPermissionPreference) {
  if (typeof window === 'undefined') return;
  try {
    if (pref === 'unset') {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, pref);
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Ignore storage quota errors
  }
}

export function isEmbeddedInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export async function requestCameraStreamWithFallback(
  facingMode: 'user' | 'environment' = 'user'
): Promise<MediaStream> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {
    throw new DOMException(
      'getUserMedia indisponível neste contexto',
      'NotSupportedError'
    );
  }

  const attempts: MediaStreamConstraints[] = [
    {
      video: {
        facingMode: {ideal: facingMode},
        width: {ideal: 720},
        height: {ideal: 960},
      },
      audio: false,
    },
    {video: {facingMode}, audio: false},
    {video: true, audio: false},
  ];

  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastError = err;
      const name = err instanceof DOMException ? err.name : '';
      // If user or iframe explicitly denied permission, do not retry further
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        throw err;
      }
    }
  }
  throw lastError;
}

export function describeCameraError(err: unknown): {
  message: string;
  isIframeBlocked: boolean;
} {
  const inIframe = isEmbeddedInIframe();
  const name = err instanceof DOMException ? err.name : '';

  if (name === 'NotSupportedError') {
    return {
      isIframeBlocked: inIframe,
      message: inIframe
        ? 'O acesso à câmera está bloqueado dentro da pré-visualização do Google AI Studio. Abra o app em uma nova aba do navegador para usar a câmera.'
        : 'Este navegador ou conexão (precisa ser HTTPS) não permite acesso direto à câmera.',
    };
  }

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    if (inIframe) {
      return {
        isIframeBlocked: true,
        message:
          'A pré-visualização embutida do Google AI Studio bloqueou a câmera (política de iframe) ou a permissão foi recusada no navegador. Abra o aplicativo em uma nova aba direta para testar o Face ID com câmera.',
      };
    }
    return {
      isIframeBlocked: false,
      message:
        'Permissão da câmera bloqueada no navegador. Toque no ícone de cadeado na barra de endereço para liberar a câmera e tente novamente.',
    };
  }

  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return {
      isIframeBlocked: false,
      message:
        'Nenhuma câmera foi encontrada neste dispositivo. Conecte uma webcam ou teste no celular.',
    };
  }

  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return {
      isIframeBlocked: false,
      message:
        'A câmera parece estar em uso por outro aplicativo ou aba. Feche outros apps de vídeo e tente novamente.',
    };
  }

  return {
    isIframeBlocked: inIframe,
    message: inIframe
      ? 'Não foi possível iniciar a câmera dentro da pré-visualização embutida. Tente abrir o app em uma nova aba.'
      : 'Não foi possível acessar a câmera no momento. Verifique as permissões do navegador.',
  };
}

export function useCameraPermission() {
  const preference = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const allowCamera = useCallback(async (): Promise<{
    ok: boolean;
    error?: string;
    isIframeBlocked?: boolean;
  }> => {
    try {
      const stream = await requestCameraStreamWithFallback();
      stream.getTracks().forEach((track) => track.stop());
      setCameraPermissionPreference('granted');
      return {ok: true};
    } catch (err) {
      const info = describeCameraError(err);
      // Only mark explicitly denied when it's a real browser permission denial outside iframe issues
      if (!info.isIframeBlocked) {
        setCameraPermissionPreference('denied');
      }
      return {
        ok: false,
        error: info.message,
        isIframeBlocked: info.isIframeBlocked,
      };
    }
  }, []);

  const denyCamera = useCallback(() => {
    setCameraPermissionPreference('denied');
  }, []);

  const resetPreference = useCallback(() => {
    setCameraPermissionPreference('unset');
  }, []);

  return {
    preference,
    allowCamera,
    denyCamera,
    resetPreference,
  };
}
