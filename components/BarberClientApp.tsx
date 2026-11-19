'use client';

import {Calendar, Clock, Home, LogIn, Scissors, User} from 'lucide-react';
import {AnimatePresence, motion, MotionConfig} from 'motion/react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {AppointmentsView} from '@/components/AppointmentsView';
import {BarberProfileSheet} from '@/components/BarberProfileSheet';
import {BarbersView} from '@/components/BarbersView';
import {BookingConfirmationView} from '@/components/BookingConfirmationView';
import {BookingFlowView} from '@/components/BookingFlowView';
import {BrandLogo} from '@/components/BrandLogo';
import {useFirebaseAuth} from '@/components/FirebaseProvider';
import {HomeView} from '@/components/HomeView';
import {MapLocationModal} from '@/components/MapLocationModal';
import {PrivacyPolicyModal} from '@/components/PrivacyPolicyModal';
import {ProfileView} from '@/components/ProfileView';
import {OfflineIndicator, PWAServiceWorkerRegister} from '@/components/PWAControls';
import {ServiceDetailSheet} from '@/components/ServiceDetailSheet';
import {ServicesView} from '@/components/ServicesView';
import {ShopAboutView} from '@/components/ShopAboutView';
import {SplashOverlay} from '@/components/SplashOverlay';
import {VirtualTryOnModal} from '@/components/VirtualTryOnModal';
import {BARBERSHOP_INFO} from '@/lib/data/seed';
import {
  cancelFirestoreAppointment,
  rescheduleFirestoreAppointment,
  subscribeClientAppointments,
} from '@/lib/firebase/repository';
import {
  Appointment,
  Barber,
  ClientProfile,
  Service,
  VirtualHairstyleId,
} from '@/lib/types/domain';
import {sanitizeAppointmentsList, sanitizeClientProfile} from '@/lib/utils/security';

type ActiveRoute =
  | 'inicio'
  | 'servicos'
  | 'agendar'
  | 'horarios'
  | 'perfil'
  | 'barbearia'
  | 'profissionais'
  | 'confirmacao';

const GUEST_PROFILE: ClientProfile = {
  id: 'client-guest',
  name: '',
  phone: '',
  email: '',
  authMethodPrepared: 'guest_demo',
  notificationsEnabled: true,
  whatsappUpdatesEnabled: true,
};

function createVerifiedBaseProfile(
  uid: string,
  displayName?: string | null,
  email?: string | null
): ClientProfile {
  return {
    id: uid,
    name: displayName || 'Cliente Barber Shop',
    phone: '',
    email: email || '',
    authMethodPrepared: 'email_code',
    notificationsEnabled: true,
    whatsappUpdatesEnabled: true,
  };
}

const getProfileStorageKey = (uid?: string | null) =>
  uid ? `black_orange_client_profile_v2_${uid}` : 'black_orange_client_profile_guest_v2';
const getAppointmentsCacheKey = (uid: string) =>
  `barber_shop_cached_appointments_v2_${uid}`;

const VALID_ROUTES: ActiveRoute[] = [
  'inicio',
  'servicos',
  'agendar',
  'horarios',
  'perfil',
  'barbearia',
  'profissionais',
  'confirmacao',
];

function parseRouteFromHash(hash: string): ActiveRoute | null {
  const clean = hash.replace(/^#/, '') as ActiveRoute;
  return VALID_ROUTES.includes(clean) ? clean : null;
}

export function BarberClientApp() {
  const {
    user,
    authReady,
    isVerifiedUser,
    firestoreProfile,
    openAuthModal,
    saveFirestoreProfile,
  } = useFirebaseAuth();

  const [route, setRoute] = useState<ActiveRoute>('inicio');
  const [clientProfile, setClientProfile] = useState<ClientProfile>(GUEST_PROFILE);

  const activeUid = isVerifiedUser && user ? user.uid : null;

  const activeProfile: ClientProfile =
    isVerifiedUser && firestoreProfile
      ? firestoreProfile
      : isVerifiedUser && user
        ? {
            ...createVerifiedBaseProfile(user.uid, user.displayName, user.email),
            ...(clientProfile.id === user.uid
              ? {
                  name: clientProfile.name || user.displayName || 'Cliente Barber Shop',
                  phone: clientProfile.phone,
                  notificationsEnabled: clientProfile.notificationsEnabled,
                  whatsappUpdatesEnabled: clientProfile.whatsappUpdatesEnabled,
                }
              : {}),
          }
        : clientProfile;

  // Booking context when jumping from a specific service/barber/slot
  const [bookingSeed, setBookingSeed] = useState<{
    serviceId?: string;
    barberId?: string;
    dateISO?: string;
    time?: string;
    nonce: number;
  }>({nonce: 0});

  const [confirmedAppointment, setConfirmedAppointment] = useState<Appointment | null>(
    null
  );
  const [pendingAppointmentAction, setPendingAppointmentAction] = useState<{
    appointment: Appointment;
    action: 'cancel' | 'reschedule';
    nonce: number;
  } | null>(null);

  // Appointments state from structured backend (with per-UID offline read-only cache)
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [resolvedAppointmentsUid, setResolvedAppointmentsUid] = useState<string | null>(
    null
  );
  const loadingAppointments =
    !authReady ||
    Boolean(activeUid && resolvedAppointmentsUid !== activeUid && appointments.length === 0);

  // Detail sheets & modals
  const [detailService, setDetailService] = useState<Service | null>(null);
  const [detailBarber, setDetailBarber] = useState<Barber | null>(null);
  const [mapOpen, setMapOpen] = useState<boolean>(false);
  const [privacyOpen, setPrivacyOpen] = useState<boolean>(false);
  const [tryOnOpen, setTryOnOpen] = useState<boolean>(false);
  const [tryOnStyle, setTryOnStyle] = useState<VirtualHairstyleId | undefined>(
    undefined
  );

  // Hydrate per-user profile & offline appointments cache safely without cross-user leakage
  useEffect(() => {
    if (!authReady) return;
    let active = true;
    const baseFallback =
      activeUid && user
        ? createVerifiedBaseProfile(activeUid, user.displayName, user.email)
        : GUEST_PROFILE;

    Promise.resolve().then(() => {
      if (!active) return;
      // Always clear confirmation/pending actions from previous user or session on UID change
      setConfirmedAppointment((curr) =>
        curr && activeUid && curr.clientId === activeUid ? curr : null
      );
      setPendingAppointmentAction((curr) =>
        curr && activeUid && curr.appointment.clientId === activeUid ? curr : null
      );

      try {
        // Clear legacy un-scoped keys so old sessions never leak across accounts
        window.localStorage.removeItem('black_orange_client_profile_v1');
        window.localStorage.removeItem('barber_shop_cached_appointments_v1');

        const savedProfile = window.localStorage.getItem(getProfileStorageKey(activeUid));
        if (savedProfile) {
          const parsed = JSON.parse(savedProfile) as unknown;
          const sanitized = sanitizeClientProfile(parsed, baseFallback);
          setClientProfile(activeUid ? {...sanitized, id: activeUid} : sanitized);
        } else {
          setClientProfile(baseFallback);
        }

        if (activeUid) {
          const cachedApts = window.localStorage.getItem(
            getAppointmentsCacheKey(activeUid)
          );
          if (cachedApts) {
            const parsedApts = JSON.parse(cachedApts) as unknown;
            setAppointments(
              sanitizeAppointmentsList(parsedApts).filter(
                (a) => a.clientId === activeUid
              )
            );
          } else {
            setAppointments([]);
          }
        } else {
          setAppointments([]);
        }
      } catch {
        setClientProfile(baseFallback);
        if (!activeUid) {
          setAppointments([]);
        }
      }
    });
    return () => {
      active = false;
    };
  }, [authReady, activeUid, user]);

  const updateProfile = useCallback(
    (next: Partial<ClientProfile>) => {
      const safeBase =
        activeUid && user
          ? firestoreProfile ||
            createVerifiedBaseProfile(activeUid, user.displayName, user.email)
          : GUEST_PROFILE;

      setClientProfile((prev) => {
        const effectivePrev =
          activeUid && prev.id !== activeUid
            ? safeBase
            : !activeUid && prev.id !== GUEST_PROFILE.id
              ? GUEST_PROFILE
              : prev;
        const merged = sanitizeClientProfile(
          {...effectivePrev, ...next, id: activeUid ?? GUEST_PROFILE.id},
          effectivePrev
        );
        try {
          window.localStorage.setItem(
            getProfileStorageKey(activeUid),
            JSON.stringify(merged)
          );
        } catch {
          // Ignore storage failures
        }
        return merged;
      });
      if (isVerifiedUser) {
        saveFirestoreProfile(next).catch(() => undefined);
      }
    },
    [activeUid, user, firestoreProfile, isVerifiedUser, saveFirestoreProfile]
  );

  useEffect(() => {
    if (!authReady) return;
    let active = true;

    if (isVerifiedUser && user) {
      const unsubscribe = subscribeClientAppointments(
        user.uid,
        (list) => {
          if (!active) return;
          const ownOnly = list.filter((a) => a.clientId === user.uid);
          setAppointments(ownOnly);
          setResolvedAppointmentsUid(user.uid);
          try {
            window.localStorage.setItem(
              getAppointmentsCacheKey(user.uid),
              JSON.stringify(ownOnly)
            );
          } catch {
            // Ignore storage failures
          }
        },
        () => {
          if (active) setResolvedAppointmentsUid(user.uid);
        }
      );

      return () => {
        active = false;
        unsubscribe();
      };
    }

    Promise.resolve().then(() => {
      if (!active) return;
      setAppointments([]);
      setResolvedAppointmentsUid(null);
    });
    return () => {
      active = false;
    };
  }, [authReady, isVerifiedUser, user]);

  const confirmedAppointmentRef = useRef<Appointment | null>(null);
  useEffect(() => {
    confirmedAppointmentRef.current = confirmedAppointment;
  }, [confirmedAppointment]);

  // Sincroniza hash inicial e botão Voltar do navegador / PWA
  useEffect(() => {
    const syncFromHash = () => {
      const hashRoute = parseRouteFromHash(window.location.hash);
      if (hashRoute) {
        if (hashRoute === 'confirmacao' && !confirmedAppointmentRef.current) {
          setRoute('horarios');
          window.history.replaceState(null, '', '#horarios');
          return;
        }
        setRoute(hashRoute);
      } else {
        setRoute('inicio');
      }
    };

    Promise.resolve().then(() => {
      const initialHashRoute = parseRouteFromHash(window.location.hash);
      if (initialHashRoute && initialHashRoute !== 'confirmacao') {
        setRoute(initialHashRoute);
      } else if (!window.location.hash) {
        window.history.replaceState(null, '', '#inicio');
      }
    });

    window.addEventListener('popstate', syncFromHash);
    window.addEventListener('hashchange', syncFromHash);
    return () => {
      window.removeEventListener('popstate', syncFromHash);
      window.removeEventListener('hashchange', syncFromHash);
    };
  }, []);

  const navigateTo = useCallback((nextRoute: ActiveRoute) => {
    setRoute(nextRoute);
    if (typeof window !== 'undefined') {
      const targetHash = `#${nextRoute}`;
      if (window.location.hash !== targetHash) {
        window.history.pushState(null, '', targetHash);
      }
      window.scrollTo({top: 0, behavior: 'smooth'});
    }
  }, []);

  const startBooking = useCallback(
    (serviceId?: string, barberId?: string, dateISO?: string, time?: string) => {
      setBookingSeed({
        serviceId,
        barberId,
        dateISO,
        time,
        nonce: Date.now(),
      });
      navigateTo('agendar');
    },
    [navigateTo]
  );

  const openTryOn = useCallback((styleId?: VirtualHairstyleId) => {
    setTryOnStyle(styleId);
    setTryOnOpen(true);
  }, []);

  const handleBookingConfirmed = useCallback(
    (appointment: Appointment) => {
      setConfirmedAppointment(appointment);
      setAppointments((prev) => {
        const next = [appointment, ...prev];
        if (activeUid) {
          try {
            window.localStorage.setItem(
              getAppointmentsCacheKey(activeUid),
              JSON.stringify(next)
            );
          } catch {
            // Ignore storage failures
          }
        }
        return next;
      });
      navigateTo('confirmacao');
    },
    [activeUid, navigateTo]
  );

  const handleCancelAppointment = useCallback(
    async (id: string, reason?: string) => {
      if (!navigator.onLine) {
        throw new Error(
          'Você está offline. Conecte-se à internet para cancelar um agendamento.'
        );
      }
      if (!isVerifiedUser || !user) {
        openAuthModal();
        throw new Error(
          'Conecte sua conta Google / Gmail para gerenciar seus agendamentos.'
        );
      }
      const target = appointments.find((a) => a.id === id);
      if (!target) {
        throw new Error('Agendamento não encontrado.');
      }

      const updated = await cancelFirestoreAppointment({
        uid: user.uid,
        appointment: target,
        reason,
      });
      setAppointments((prev) => {
        const next = prev.map((a) => (a.id === id ? updated : a));
        try {
          window.localStorage.setItem(
            getAppointmentsCacheKey(user.uid),
            JSON.stringify(next)
          );
        } catch {
          // Ignore storage failures
        }
        return next;
      });
      if (confirmedAppointment?.id === id) {
        setConfirmedAppointment(updated);
      }
    },
    [isVerifiedUser, user, appointments, confirmedAppointment, openAuthModal]
  );

  const handleRequestReschedule = useCallback(
    async (
      id: string,
      preferredDate: string,
      preferredTime: string,
      reason?: string
    ) => {
      if (!navigator.onLine) {
        throw new Error(
          'Você está offline. Conecte-se à internet para solicitar reagendamento.'
        );
      }
      if (!isVerifiedUser || !user) {
        openAuthModal();
        throw new Error(
          'Conecte sua conta Google / Gmail para solicitar reagendamento.'
        );
      }
      const target = appointments.find((a) => a.id === id);
      if (!target) {
        throw new Error('Agendamento não encontrado.');
      }

      const updated = await rescheduleFirestoreAppointment({
        appointment: target,
        preferredDate,
        preferredTime,
        reason,
      });
      setAppointments((prev) => {
        const next = prev.map((a) => (a.id === id ? updated : a));
        try {
          window.localStorage.setItem(
            getAppointmentsCacheKey(user.uid),
            JSON.stringify(next)
          );
        } catch {
          // Ignore storage failures
        }
        return next;
      });
      if (confirmedAppointment?.id === id) {
        setConfirmedAppointment(updated);
      }
    },
    [isVerifiedUser, user, appointments, confirmedAppointment, openAuthModal]
  );

  const bottomNavItems: {
    id: ActiveRoute;
    label: string;
    icon: typeof Home;
  }[] = [
    {id: 'inicio', label: 'Início', icon: Home},
    {id: 'servicos', label: 'Serviços', icon: Scissors},
    {id: 'agendar', label: 'Agendar', icon: Calendar},
    {id: 'horarios', label: 'Meus horários', icon: Clock},
    {id: 'perfil', label: 'Perfil', icon: User},
  ];

  const isNavActive = (itemId: ActiveRoute): boolean => {
    if (route === itemId) return true;
    if (itemId === 'inicio' && (route === 'barbearia' || route === 'profissionais')) {
      return true;
    }
    if (itemId === 'agendar' && route === 'confirmacao') {
      return true;
    }
    return false;
  };

  return (
    <MotionConfig reducedMotion="user">
      <PWAServiceWorkerRegister />
      <SplashOverlay />

      <div className="min-h-screen w-full max-w-full flex flex-col bg-[#111111] text-white overflow-x-clip">
        {/* Top Bar — Mobile compact & Desktop 3-Zone Contract */}
        <header className="sticky top-0 z-30 w-full border-b border-[#2B2B2B] bg-[#111111]/95 backdrop-blur-md">
          <div className="mx-auto w-full max-w-6xl min-w-0 px-3 sm:px-6 h-[54px] md:h-16 flex items-center justify-between gap-2 sm:gap-4 md:gap-8">
            {/* Zone 1: Brand wordmark */}
            <button
              type="button"
              onClick={() => navigateTo('inicio')}
              className="min-w-0 shrink text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7931E] rounded-lg"
            >
              <BrandLogo size="sm" showWordmark />
            </button>

            {/* Zone 2: Desktop single-line text nav links */}
            <nav
              className="hidden md:flex items-center gap-6 text-sm font-medium text-[#E5E5E5]/75"
              aria-label="Navegação principal"
            >
              <button
                type="button"
                onClick={() => navigateTo('inicio')}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-white ${
                  route === 'inicio'
                    ? 'text-white underline underline-offset-8 decoration-[#F7931E]'
                    : ''
                }`}
              >
                Início
              </button>
              <button
                type="button"
                onClick={() => navigateTo('servicos')}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-white ${
                  route === 'servicos'
                    ? 'text-white underline underline-offset-8 decoration-[#F7931E]'
                    : ''
                }`}
              >
                Serviços
              </button>
              <button
                type="button"
                onClick={() => navigateTo('profissionais')}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-white ${
                  route === 'profissionais'
                    ? 'text-white underline underline-offset-8 decoration-[#F7931E]'
                    : ''
                }`}
              >
                Profissionais
              </button>
              <button
                type="button"
                onClick={() => navigateTo('barbearia')}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-white ${
                  route === 'barbearia'
                    ? 'text-white underline underline-offset-8 decoration-[#F7931E]'
                    : ''
                }`}
              >
                Barbearia
              </button>
              <button
                type="button"
                onClick={() => navigateTo('horarios')}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-white ${
                  route === 'horarios'
                    ? 'text-white underline underline-offset-8 decoration-[#F7931E]'
                    : ''
                }`}
              >
                Meus horários
              </button>
              <button
                type="button"
                onClick={() => navigateTo('perfil')}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-white ${
                  route === 'perfil'
                    ? 'text-white underline underline-offset-8 decoration-[#F7931E]'
                    : ''
                }`}
              >
                Perfil
              </button>
            </nav>

            {/* Zone 3: Auth status + Primary Action CTA */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {authReady && !isVerifiedUser && (
                <button
                  type="button"
                  onClick={openAuthModal}
                  className="min-h-[40px] md:min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] hover:border-[#F7931E]/60 px-2.5 sm:px-3 py-2 text-xs md:text-sm font-medium text-white transition-colors whitespace-nowrap shrink-0"
                >
                  <LogIn className="h-3.5 w-3.5 text-[#F7931E]" />
                  <span>Entrar</span>
                </button>
              )}
              {authReady && isVerifiedUser && (
                <button
                  type="button"
                  onClick={() => navigateTo('perfil')}
                  aria-label="Conta conectada"
                  className="hidden lg:inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#2B2B2B] bg-[#1C1C1C] hover:border-[#F7931E]/60 px-3 py-2 text-xs font-medium text-[#E5E5E5] transition-colors whitespace-nowrap shrink-0 max-w-[140px]"
                >
                  <User className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">{activeProfile.name.split(' ')[0]}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => startBooking()}
                className="min-h-[40px] md:min-h-[44px] inline-flex items-center justify-center rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-2.5 sm:px-4 md:px-5 py-2 text-xs md:text-sm font-semibold text-[#111111] transition-colors whitespace-nowrap shrink-0"
              >
                Agendar horário
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Canvas */}
        <main className="flex-1 mx-auto w-full max-w-6xl min-w-0 px-3 sm:px-6 pt-4 sm:pt-8 pb-24 md:pb-12 overflow-x-clip">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${route}-${bookingSeed.nonce}`}
              initial={{opacity: 0, y: 6}}
              animate={{opacity: 1, y: 0}}
              exit={{opacity: 0, y: -6}}
              transition={{duration: 0.18, ease: [0.16, 1, 0.3, 1]}}
            >
              {route === 'inicio' && (
                <HomeView
                  onBookNow={(sId, bId) => startBooking(sId, bId)}
                  onOpenServices={() => navigateTo('servicos')}
                  onOpenServiceDetail={(s) => setDetailService(s)}
                  onOpenBarbers={() => navigateTo('profissionais')}
                  onOpenBarberProfile={(b) => setDetailBarber(b)}
                  onOpenShopAbout={() => navigateTo('barbearia')}
                  onOpenMap={() => setMapOpen(true)}
                  onOpenTryOn={(styleId) => openTryOn(styleId)}
                />
              )}

              {route === 'servicos' && (
                <ServicesView
                  onBookService={(sId) => startBooking(sId)}
                  onOpenServiceDetail={(s) => setDetailService(s)}
                  onOpenTryOn={(styleId) => openTryOn(styleId)}
                />
              )}

              {route === 'barbearia' && (
                <ShopAboutView
                  onBack={() => navigateTo('inicio')}
                  onBookNow={() => startBooking()}
                  onOpenMap={() => setMapOpen(true)}
                  onOpenServices={() => navigateTo('servicos')}
                />
              )}

              {route === 'profissionais' && (
                <BarbersView
                  onBack={() => navigateTo('inicio')}
                  onOpenBarberProfile={(b) => setDetailBarber(b)}
                  onBookWithBarber={(bId) => startBooking(undefined, bId)}
                />
              )}

              {route === 'agendar' && (
                <BookingFlowView
                  initialServiceId={bookingSeed.serviceId}
                  initialBarberId={bookingSeed.barberId}
                  initialDateISO={bookingSeed.dateISO}
                  initialTime={bookingSeed.time}
                  clientProfile={activeProfile}
                  onUpdateProfile={updateProfile}
                  onBookingConfirmed={handleBookingConfirmed}
                  onCancelFlow={() => navigateTo('inicio')}
                />
              )}

              {route === 'confirmacao' &&
                confirmedAppointment &&
                (!activeUid || confirmedAppointment.clientId === activeUid) && (
                  <BookingConfirmationView
                    appointment={confirmedAppointment}
                    onOpenMap={() => setMapOpen(true)}
                    onViewMyAppointments={() => {
                      setPendingAppointmentAction(null);
                      navigateTo('horarios');
                    }}
                    onRequestCancel={(apt) => {
                      setPendingAppointmentAction({
                        appointment: apt,
                        action: 'cancel',
                        nonce: Date.now(),
                      });
                      navigateTo('horarios');
                    }}
                    onRequestReschedule={(apt) => {
                      setPendingAppointmentAction({
                        appointment: apt,
                        action: 'reschedule',
                        nonce: Date.now(),
                      });
                      navigateTo('horarios');
                    }}
                  />
                )}

              {(route === 'horarios' ||
                (route === 'confirmacao' &&
                  (!confirmedAppointment ||
                    (activeUid && confirmedAppointment.clientId !== activeUid)))) && (
                <AppointmentsView
                  key={pendingAppointmentAction?.nonce ?? 'default'}
                  appointments={appointments}
                  loading={loadingAppointments}
                  initialActionTarget={pendingAppointmentAction}
                  onClearInitialAction={() => setPendingAppointmentAction(null)}
                  onBookNew={() => startBooking()}
                  onCancelAppointment={handleCancelAppointment}
                  onRequestReschedule={handleRequestReschedule}
                />
              )}

              {route === 'perfil' && (
                <ProfileView
                  key={`${activeProfile.id}-${activeProfile.name}-${activeProfile.phone}-${activeProfile.email}-${activeProfile.notificationsEnabled}-${activeProfile.whatsappUpdatesEnabled}`}
                  profile={activeProfile}
                  onSaveProfile={(next) => updateProfile(next)}
                  onOpenShopAbout={() => navigateTo('barbearia')}
                  onOpenBarbers={() => navigateTo('profissionais')}
                  onOpenPrivacy={() => setPrivacyOpen(true)}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Quiet Footer */}
        <footer className="hidden md:block border-t border-[#2B2B2B] bg-[#111111]">
          <div className="mx-auto max-w-6xl px-6 py-6 flex flex-wrap items-center justify-between gap-4 text-xs text-[#E5E5E5]/60">
            <p>
              © {new Date().getFullYear()} {BARBERSHOP_INFO.name} ·{' '}
              {BARBERSHOP_INFO.address.street}, {BARBERSHOP_INFO.address.city} —{' '}
              {BARBERSHOP_INFO.address.state}
            </p>
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => navigateTo('barbearia')}
                className="hover:text-white transition-colors"
              >
                Sobre a barbearia
              </button>
              <button
                type="button"
                onClick={() => setPrivacyOpen(true)}
                className="hover:text-white transition-colors"
              >
                Política de Privacidade (LGPD)
              </button>
            </div>
          </div>
        </footer>

        {/* Mobile Bottom Navigation Bar — 5 items requested */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 w-full max-w-full overflow-x-clip bg-[#111111]/95 backdrop-blur-md border-t border-[#2B2B2B] pb-safe"
          aria-label="Navegação inferior do aplicativo"
        >
          <div className="grid grid-cols-5 items-center h-[60px] w-full">
            {bottomNavItems.map((item) => {
              const Icon = item.icon;
              const active = isNavActive(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id === 'agendar') {
                      startBooking();
                    } else {
                      navigateTo(item.id);
                    }
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={`min-w-0 min-h-[48px] flex flex-col items-center justify-center gap-1 px-0.5 transition-colors ${
                    active ? 'text-[#F7931E]' : 'text-[#E5E5E5]/65 hover:text-white'
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${active ? 'stroke-[2.4]' : 'stroke-[1.8]'}`}
                  />
                  <span className="text-[10px] font-medium tracking-tight leading-none truncate max-w-full">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Modais e Detalhes */}
        <ServiceDetailSheet
          service={detailService}
          onClose={() => setDetailService(null)}
          onBookService={(sId, bId) => startBooking(sId, bId)}
          onSelectBarber={(b) => setDetailBarber(b)}
          onOpenTryOn={(styleId) => openTryOn(styleId)}
        />

        <BarberProfileSheet
          barber={detailBarber}
          onClose={() => setDetailBarber(null)}
          onBookWithBarber={(bId, sId, date, time) =>
            startBooking(sId, bId, date, time)
          }
          onSelectService={(s) => setDetailService(s)}
        />

        <MapLocationModal open={mapOpen} onClose={() => setMapOpen(false)} />
        <PrivacyPolicyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
        <VirtualTryOnModal
          key={`${tryOnStyle}-${tryOnOpen}`}
          open={tryOnOpen}
          initialStyleId={tryOnStyle}
          onClose={() => setTryOnOpen(false)}
          onOpenPrivacy={() => setPrivacyOpen(true)}
          onBookStyle={(sId) => startBooking(sId)}
        />
        <OfflineIndicator />
      </div>
    </MotionConfig>
  );
}
