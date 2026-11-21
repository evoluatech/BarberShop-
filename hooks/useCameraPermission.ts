'use client';

import {useCallback, useSyncExternalStore} from 'react';

export type CameraPermissionPreference = 'unset' | 'granted' | 'denied';

const STORAGE_KEY = 'barber_shop_camera_pref_v1';
const CHANGE_EVENT = 'barber-shop-camera-pref-change';

function subscribe(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

function getSnapshot(): CameraPermissionPreference {
  if (typeof window === 'undefined') return 'unset';
  try {
    const val = window.localStorage.getItem(STORAGE_KEY);
    if (val === 'granted' || val === 'denied') return val;
  } catch {
    // Ignore storage errors
  }
  return 'unset';
}

function getServerSnapshot(): CameraPermissionPreference {
  return 'unset';
}

export function setCameraPermissionPreference(pref: CameraPermissionPreference) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Ignore storage errors
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export async function requestCameraStreamWithFallback(
  facingMode: 'user' | 'environment' = 'user'
): Promise<MediaStream> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {
    throw new Error(
      'A câmera não está disponível neste navegador ou o endereço não está em HTTPS.'
    );
  }

  const attempts: MediaStreamConstraints[] = [
    {
      video: {
        facingMode: {ideal: facingMode},
        width: {ideal: 960},
        height: {ideal: 960},
      },
      audio: false,
    },
    {
      video: {facingMode},
      audio: false,
    },
    {
      video: true,
      audio: false,
    },
  ];

  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

export function describeCameraError(err: unknown): {
  message: string;
  isIframeBlocked: boolean;
} {
  const errName = err instanceof DOMException ? err.name : '';
  const errMsg = err instanceof Error ? err.message : '';
  const inIframe =
    typeof window !== 'undefined' &&
    (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();

  if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
    if (inIframe) {
      return {
        message:
          'A pré-visualização embutida bloqueou o acesso à câmera ou a permissão foi negada. Abra o app em uma nova aba para usar o Face ID ou preencha apenas os dados.',
        isIframeBlocked: true,
      };
    }
    return {
      message:
        'Permissão da câmera recusada. Libere o acesso à câmera nas configurações do navegador ou calcule usando apenas seus dados.',
      isIframeBlocked: false,
    };
  }

  if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
    return {
      message:
        'Nenhuma câmera encontrada neste dispositivo. Você pode fazer o cálculo selecionando apenas seus dados.',
      isIframeBlocked: false,
    };
  }

  if (errName === 'NotReadableError' || errName === 'TrackStartError') {
    return {
      message:
        'A câmera está ocupada por outro aplicativo no momento. Feche o outro app e tente novamente, ou use o cálculo por dados.',
      isIframeBlocked: false,
    };
  }

  return {
    message:
      errMsg ||
      'Não foi possível abrir a câmera agora. Você pode testar normalmente informando apenas seus dados.',
    isIframeBlocked: inIframe,
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
      const stream = await requestCameraStreamWithFallback('user');
      stream.getTracks().forEach((t) => t.stop());
      setCameraPermissionPreference('granted');
      return {ok: true};
    } catch (err) {
      const info = describeCameraError(err);
      if (
        err instanceof DOMException &&
        (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') &&
        !info.isIframeBlocked
      ) {
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

  const resetCameraPreference = useCallback(() => {
    setCameraPermissionPreference('unset');
  }, []);

  return {
    preference,
    allowCamera,
    denyCamera,
    resetCameraPreference,
  };
}
