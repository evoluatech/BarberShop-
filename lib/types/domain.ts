export type ServiceCategory = 'Cortes' | 'Barba' | 'Combos' | 'Acabamentos';

export type PaymentMethod = 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro';

export interface PixDetails {
  pixKey: string;
  pixKeyType: 'Celular' | 'E-mail' | 'CPF/CNPJ' | 'Chave Aleatória';
  holderName: string;
  bankName: string;
  city: string;
}

export type AppointmentStatus =
  'Pendente' | 'Confirmado' | 'Concluído' | 'Cancelado' | 'Reagendamento solicitado';

export interface OpeningHoursDay {
  dayOfWeek: number; // 0 = Domingo ... 6 = Sábado
  label: string;
  isOpen: boolean;
  openTime?: string; // HH:mm
  closeTime?: string; // HH:mm
  displayText: string;
}

export interface BarbershopInfo {
  id: string;
  name: string;
  tagline: string;
  description: string;
  logoUrl: string;
  heroImageUrl: string;
  galleryImages: {
    url: string;
    caption: string;
  }[];
  address: {
    street: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
    fullFormatted: string;
    latitude: number;
    longitude: number;
  };
  contact: {
    phone: string;
    whatsappDigits: string;
    email: string;
    instagram: string;
    facebook: string;
  };
  highlights: string[];
  openingHours: OpeningHoursDay[];
  pixDetails: PixDetails;
}

export interface Service {
  id: string;
  slug: string;
  name: string;
  category: ServiceCategory;
  shortDescription: string;
  detailedDescription: string;
  priceCents: number;
  durationMinutes: number;
  imageUrl: string;
  popular?: boolean;
  supportsVirtualTryOn: boolean;
  tryOnStyleId?: VirtualHairstyleId;
  barberIds: string[];
  careRecommendations: string[];
}

export interface BarberReview {
  id: string;
  clientName: string;
  rating: number;
  serviceName: string;
  dateLabel: string;
  comment: string;
}

export interface Barber {
  id: string;
  name: string;
  role: string;
  bio: string;
  avatarUrl: string;
  specialties: string[];
  experienceYears: number;
  rating: number;
  reviewCount: number;
  isAvailable: boolean;
  workingDays: number[]; // 0..6
  serviceIds: string[];
  reviews: BarberReview[];
  pixDetails: PixDetails;
}

export interface ClientReview {
  id: string;
  clientName: string;
  serviceName: string;
  barberName: string;
  rating: number;
  dateLabel: string;
  comment: string;
}

export interface AppointmentHistoryEntry {
  id: string;
  timestamp: string;
  actor: 'cliente' | 'sistema' | 'barbeiro';
  action: string;
  previousStatus?: AppointmentStatus;
  newStatus: AppointmentStatus;
  note?: string;
}

export interface RescheduleRequest {
  preferredDate: string;
  preferredTime: string;
  reason?: string;
  requestedAt: string;
}

/**
 * Estrutura unificada de Agendamento preparada para compartilhamento
 * futuro entre o Aplicativo do Cliente e o Aplicativo do Barbeiro.
 */
export interface Appointment {
  id: string;
  bookingCode: string;
  shopId: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  serviceId: string;
  serviceName: string;
  serviceDurationMinutes: number;
  priceCents: number;
  barberId: string;
  barberName: string;
  anyBarberRequested: boolean;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  slotLockId?: string;
  notes?: string;
  paymentMethod: PaymentMethod;
  status: AppointmentStatus;
  rescheduleRequest?: RescheduleRequest;
  changeHistory: AppointmentHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface TimeSlotAvailability {
  time: string;
  available: boolean;
  reason?: string;
  availableBarberIds: string[];
}

export interface ClientProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  authMethodPrepared: 'phone_otp' | 'email_code' | 'guest_demo';
  notificationsEnabled: boolean;
  whatsappUpdatesEnabled: boolean;
  privacyAcceptedAt?: string;
}

export type VirtualHairstyleId =
  | 'corte-degrade'
  | 'corte-social'
  | 'corte-tesoura'
  | 'barba-desenhada'
  | 'combo-corte-barba'
  | 'corte-barba-sobrancelha';

export type FaceShape =
  'Oval' | 'Quadrado' | 'Redondo' | 'Diamante' | 'Triangular' | 'Alongado';

export type HairType = 'Liso' | 'Ondulado' | 'Cacheado' | 'Crespo';

export type HairLengthCategory = 'Raspado / Muito curto' | 'Curto' | 'Médio' | 'Longo';

export type VisagismVerdict =
  | 'Altamente recomendado'
  | 'Recomendado com adaptações'
  | 'Exige crescimento prévio'
  | 'Risco estético — avalie alternativas';

export interface VisagismCalculations {
  overallScore: number; // 0..100
  headShapeFitScore: number; // 0..100
  hairTextureFitScore: number; // 0..100
  lengthSufficiencyScore: number; // 0..100
  verdictStatus: VisagismVerdict;
  riskWarning?: string;
  suggestedAdjustments: string[];
  betterAlternativeStyleId?: VirtualHairstyleId;
}

export interface VirtualTryOnAnalysis {
  imageQualityOk?: boolean;
  imageQualityMessage?: string;
  faceShape: FaceShape;
  cranialGeometry: string;
  detectedHairType: HairType;
  detectedHairLength: HairLengthCategory;
  hairlineObservation: string;
  apparentVolume: string;
  estimatedLength: string;
  visualTexture: string;
  facialProportions: string;
  beardObservation: string;
  compatibilityLabel:
    | 'Alta compatibilidade'
    | 'Boa compatibilidade'
    | 'Compatibilidade adaptável'
    | 'Baixa compatibilidade';
  compatibilitySummary: string;
  howItWillLookOnYou: string;
  barberRecommendation: string;
  calculations: VisagismCalculations;
  source: 'gemini_vision' | 'manual_profile';
}
