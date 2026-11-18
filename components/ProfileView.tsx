'use client';

import {
  Bell,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  ExternalLink,
  LogIn,
  LogOut,
  Mail,
  MessageCircle,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';
import {useState} from 'react';
import {useFirebaseAuth} from '@/components/FirebaseProvider';
import {PWAInstallButton} from '@/components/PWAControls';
import {useCameraPermission} from '@/hooks/useCameraPermission';
import {BARBERSHOP_INFO} from '@/lib/data/seed';
import {ClientProfile} from '@/lib/types/domain';
import {buildWhatsAppLink, formatPhoneBR} from '@/lib/utils/formatters';
import {sanitizeTextField} from '@/lib/utils/security';

interface ProfileViewProps {
  profile: ClientProfile;
  onSaveProfile: (next: ClientProfile) => void;
  onOpenShopAbout: () => void;
  onOpenBarbers: () => void;
  onOpenPrivacy: () => void;
}

export function ProfileView({
  profile,
  onSaveProfile,
  onOpenShopAbout,
  onOpenBarbers,
  onOpenPrivacy,
}: ProfileViewProps) {
  const {user, isVerifiedUser, openAuthModal, signOutUser} = useFirebaseAuth();

  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    profile.notificationsEnabled
  );
  const [whatsappUpdatesEnabled, setWhatsappUpdatesEnabled] = useState(
    profile.whatsappUpdatesEnabled
  );
  const [savedNotice, setSavedNotice] = useState(false);

  const {preference: cameraPref, allowCamera, denyCamera} = useCameraPermission();
  const [cameraMsg, setCameraMsg] = useState<{
    message: string;
    isIframeBlocked: boolean;
  } | null>(null);

  const isGoogleAccount = Boolean(
    user?.providerData?.some((p) => p.providerId === 'google.com')
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = sanitizeTextField(name, 80);
    const cleanPhone = sanitizeTextField(phone, 20);
    const cleanEmail = sanitizeTextField(email, 120);
    setName(cleanName);
    setPhone(cleanPhone);
    setEmail(cleanEmail);
    onSaveProfile({
      ...profile,
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      notificationsEnabled,
      whatsappUpdatesEnabled,
    });
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2400);
  };

  const whatsappUrl = buildWhatsAppLink(
    BARBERSHOP_INFO.contact.whatsappDigits,
    `Olá! Sou ${name || 'cliente'} e gostaria de atendimento na Barber Shop.`
  );

  return (
    <div className="space-y-6 pb-8 max-w-3xl">
      <header className="space-y-1">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
          Meu Perfil
        </h1>
        <p className="text-sm text-[#E5E5E5]/75">
          Seus dados agilizam os próximos agendamentos e mantêm sua conta sincronizada na
          nuvem.
        </p>
      </header>

      {/* Conta Conectada (Firebase Authentication) */}
      <div className="rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-[#111111] border border-[#2B2B2B] flex items-center justify-center shrink-0">
            {isVerifiedUser ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            ) : user ? (
              <Mail className="h-5 w-5 text-[#F7931E]" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-[#F7931E]" />
            )}
          </div>
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-base font-semibold text-white">
                {isVerifiedUser
                  ? 'Conta Conectada'
                  : user
                    ? 'Verificação de e-mail pendente'
                    : 'Conecte sua conta Google / Gmail'}
              </h2>
              {isVerifiedUser && (
                <span className="text-[11px] font-medium text-emerald-400">
                  {isGoogleAccount ? 'Google / Gmail verificado' : 'E-mail verificado'}
                </span>
              )}
            </div>
            <p className="text-xs text-[#E5E5E5]/70 leading-relaxed">
              {isVerifiedUser
                ? `Autenticado como ${user?.email}. Seus agendamentos ficam protegidos no Firebase.`
                : user
                  ? `Confirme o link enviado para ${user.email} para liberar o sincronismo na nuvem.`
                  : 'Entre com Google / Gmail ou e-mail para proteger seus horários e acessar de qualquer dispositivo.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isVerifiedUser ? (
            <button
              type="button"
              onClick={() => signOutUser()}
              className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-[#2B2B2B] bg-[#111111] hover:border-red-500/40 px-4 py-2 text-xs font-medium text-[#E5E5E5] transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sair da conta</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={openAuthModal}
              className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-4 py-2 text-xs font-semibold text-[#111111] transition-colors"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>{user ? 'Confirmar e-mail' : 'Entrar com Google / Gmail'}</span>
            </button>
          )}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] p-5 sm:p-6 space-y-5"
      >
        <div className="flex items-center gap-3 pb-3 border-b border-[#2B2B2B]">
          <div className="h-12 w-12 rounded-xl bg-[#111111] border border-[#2B2B2B] flex items-center justify-center">
            <User className="h-6 w-6 text-[#F7931E]" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-white">
              {name || 'Cliente Barber Shop'}
            </h2>
            <p className="text-xs text-[#E5E5E5]/65">
              Cliente {BARBERSHOP_INFO.name} ·{' '}
              {isVerifiedUser
                ? 'Dados sincronizados na sua conta Firebase'
                : 'Dados salvos para agilizar seus agendamentos'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <label
              htmlFor="profile-name"
              className="block text-xs font-medium text-[#E5E5E5]/85"
            >
              Nome completo
            </label>
            <input
              id="profile-name"
              type="text"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome completo"
              className="w-full min-h-[46px] rounded-xl border border-[#2B2B2B] bg-[#111111] px-4 py-2.5 text-sm text-white focus:border-[#F7931E] focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="profile-phone"
              className="block text-xs font-medium text-[#E5E5E5]/85"
            >
              Telefone / WhatsApp
            </label>
            <input
              id="profile-phone"
              type="tel"
              maxLength={20}
              value={phone}
              onChange={(e) => setPhone(formatPhoneBR(e.target.value))}
              placeholder="(11) 99999-9999"
              className="w-full min-h-[46px] rounded-xl border border-[#2B2B2B] bg-[#111111] px-4 py-2.5 text-sm font-mono text-white focus:border-[#F7931E] focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="profile-email"
              className="block text-xs font-medium text-[#E5E5E5]/85"
            >
              E-mail
            </label>
            <input
              id="profile-email"
              type="email"
              maxLength={120}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              className="w-full min-h-[46px] rounded-xl border border-[#2B2B2B] bg-[#111111] px-4 py-2.5 text-sm text-white focus:border-[#F7931E] focus:outline-none"
            />
          </div>
        </div>

        {/* Preferências de notificações */}
        <div className="space-y-3 pt-2 border-t border-[#2B2B2B]">
          <h3 className="font-display text-sm font-semibold text-white inline-flex items-center gap-2">
            <Bell className="h-4 w-4 text-[#F7931E]" />
            <span>Preferências de lembretes</span>
          </h3>

          <label className="flex items-center justify-between gap-4 cursor-pointer min-h-[44px]">
            <span className="text-sm text-[#E5E5E5]/85">
              Receber lembretes de horários agendados
            </span>
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(e) => setNotificationsEnabled(e.target.checked)}
              className="h-5 w-5 accent-[#F7931E]"
            />
          </label>

          <label className="flex items-center justify-between gap-4 cursor-pointer min-h-[44px]">
            <span className="text-sm text-[#E5E5E5]/85">
              Receber confirmações via WhatsApp
            </span>
            <input
              type="checkbox"
              checked={whatsappUpdatesEnabled}
              onChange={(e) => setWhatsappUpdatesEnabled(e.target.checked)}
              className="h-5 w-5 accent-[#F7931E]"
            />
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="submit"
            className="min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-6 py-2.5 text-sm font-semibold text-[#111111] transition-colors"
          >
            {savedNotice ? (
              <>
                <Check className="h-4 w-4" />
                <span>Dados salvos</span>
              </>
            ) : (
              <span>Salvar alterações</span>
            )}
          </button>
        </div>
      </form>

      {/* Permissão de Câmera */}
      <div className="rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-[#111111] border border-[#2B2B2B] flex items-center justify-center shrink-0">
            <Camera className="h-5 w-5 text-[#F7931E]" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-white">
              Acesso à câmera (Análise Face ID)
            </h3>
            <p className="text-xs text-[#E5E5E5]/70 mt-0.5">
              Status atual:{' '}
              <strong className="text-white">
                {cameraPref === 'granted'
                  ? 'Permitida'
                  : cameraPref === 'denied'
                    ? 'Recusada pelo usuário'
                    : 'Não definida'}
              </strong>
            </p>
            {cameraMsg && (
              <p className="text-xs text-amber-300 mt-1 leading-relaxed">
                {cameraMsg.message}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {cameraMsg?.isIframeBlocked && typeof window !== 'undefined' && (
            <a
              href={`${window.location.origin}${window.location.pathname}${window.location.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-4 py-2 text-xs font-semibold text-[#111111] transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Abrir em nova aba</span>
            </a>
          )}
          {cameraPref !== 'granted' ? (
            <button
              type="button"
              onClick={async () => {
                setCameraMsg(null);
                const res = await allowCamera();
                if (!res.ok && res.error) {
                  setCameraMsg({
                    message: res.error,
                    isIframeBlocked: Boolean(res.isIframeBlocked),
                  });
                }
              }}
              className="min-h-[42px] rounded-xl bg-[#F7931E] hover:bg-[#D97706] px-4 py-2 text-xs font-semibold text-[#111111] transition-colors"
            >
              Permitir câmera
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setCameraMsg(null);
                denyCamera();
              }}
              className="min-h-[42px] rounded-xl border border-[#2B2B2B] bg-[#111111] hover:border-red-500/40 px-4 py-2 text-xs font-medium text-[#E5E5E5] transition-colors"
            >
              Desativar câmera
            </button>
          )}
        </div>
      </div>

      {/* Atalhos informativos e LGPD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onOpenShopAbout}
          className="min-h-[56px] flex items-center gap-3 rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] hover:border-[#F7931E]/60 px-4 py-3 text-left transition-colors"
        >
          <Building2 className="h-5 w-5 text-[#F7931E] shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white">Sobre a barbearia</p>
            <p className="text-xs text-[#E5E5E5]/65">Fotos, horários e endereço</p>
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenBarbers}
          className="min-h-[56px] flex items-center gap-3 rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] hover:border-[#F7931E]/60 px-4 py-3 text-left transition-colors"
        >
          <Users className="h-5 w-5 text-[#F7931E] shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white">Profissionais</p>
            <p className="text-xs text-[#E5E5E5]/65">Conheça nossa equipe</p>
          </div>
        </button>

        <button
          type="button"
          onClick={onOpenPrivacy}
          className="min-h-[56px] flex items-center gap-3 rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] hover:border-[#F7931E]/60 px-4 py-3 text-left transition-colors"
        >
          <ShieldCheck className="h-5 w-5 text-[#F7931E] shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white">Política de Privacidade</p>
            <p className="text-xs text-[#E5E5E5]/65">Uso da câmera e LGPD</p>
          </div>
        </button>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-[56px] flex items-center gap-3 rounded-2xl border border-[#2B2B2B] bg-[#1C1C1C] hover:border-[#F7931E]/60 px-4 py-3 text-left transition-colors"
        >
          <MessageCircle className="h-5 w-5 text-[#F7931E] shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white">Atendimento WhatsApp</p>
            <p className="text-xs text-[#E5E5E5]/65">{BARBERSHOP_INFO.contact.phone}</p>
          </div>
        </a>
      </div>

      {/* Aplicativo Instalável (PWA) */}
      <PWAInstallButton variant="card" />
    </div>
  );
}
