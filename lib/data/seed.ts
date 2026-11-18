import {
  Appointment,
  Barber,
  BarbershopInfo,
  ClientReview,
  Service,
  VirtualHairstyleId,
} from '@/lib/types/domain';

export const BARBERSHOP_INFO: BarbershopInfo = {
  id: 'black-orange-sp-centro',
  name: 'Barber Shop',
  tagline: 'Seu estilo. Nossa assinatura.',
  description:
    'Na Barber Shop, cada corte é pensado para valorizar o seu estilo. Oferecemos cortes modernos, barba, acabamento e atendimento personalizado em um ambiente confortável e profissional.',
  logoUrl: '/assets/aistudio/1794865202433_4193a4e3.jpg',
  heroImageUrl: '/images/barbershop_hero_1794653287317.jpg',
  galleryImages: [
    {
      url: '/images/barbershop_hero_1794653287317.jpg',
      caption:
        'Estações de atendimento equipadas com iluminação dedicada e cadeiras confortáveis.',
    },
    {
      url: '/images/barbershop_lounge_1794653288316.jpg',
      caption:
        'Lounge de recepção com linha completa de cuidados masculinos e café espresso.',
    },
    {
      url: '/images/service_combo_finish_1794653292260.jpg',
      caption:
        'Ferramentas esterilizadas e produtos selecionados para acabamento impecável.',
    },
  ],
  address: {
    street: 'Avenida Central, nº 450',
    neighborhood: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01000-000',
    fullFormatted: 'Avenida Central, nº 450 — Centro, São Paulo — SP, CEP: 01000-000',
    latitude: -23.55052,
    longitude: -46.633308,
  },
  contact: {
    phone: '(11) 98888-7766',
    whatsappDigits: '5511988887766',
    email: 'contato@blackorangebarber.com',
    instagram: '@blackorangebarber',
    facebook: '/blackorangebarbershop',
  },
  highlights: [
    'Atendimento pontual com agendamento online em segundos',
    'Toalha quente aromática e ritual completo de barba',
    'Consultoria de visagismo conforme formato de rosto e textura',
    'Ambiente climatizado com café espresso e água cortesia',
    'Equipamentos higienizados e esterilizados a cada cliente',
  ],
  openingHours: [
    {
      dayOfWeek: 1,
      label: 'Segunda-feira',
      isOpen: false,
      displayText: 'Fechado',
    },
    {
      dayOfWeek: 2,
      label: 'Terça-feira',
      isOpen: true,
      openTime: '09:00',
      closeTime: '20:00',
      displayText: '09h às 20h',
    },
    {
      dayOfWeek: 3,
      label: 'Quarta-feira',
      isOpen: true,
      openTime: '09:00',
      closeTime: '20:00',
      displayText: '09h às 20h',
    },
    {
      dayOfWeek: 4,
      label: 'Quinta-feira',
      isOpen: true,
      openTime: '09:00',
      closeTime: '20:00',
      displayText: '09h às 20h',
    },
    {
      dayOfWeek: 5,
      label: 'Sexta-feira',
      isOpen: true,
      openTime: '09:00',
      closeTime: '20:00',
      displayText: '09h às 20h',
    },
    {
      dayOfWeek: 6,
      label: 'Sábado',
      isOpen: true,
      openTime: '08:00',
      closeTime: '18:00',
      displayText: '08h às 18h',
    },
    {
      dayOfWeek: 0,
      label: 'Domingo',
      isOpen: true,
      openTime: '09:00',
      closeTime: '14:00',
      displayText: '09h às 14h',
    },
  ],
  pixDetails: {
    pixKey: 'contato@blackorangebarber.com',
    pixKeyType: 'E-mail',
    holderName: 'Barber Shop Studio Ltda',
    bankName: 'Banco Inter',
    city: 'Sao Paulo',
  },
};

export const BARBERS: Barber[] = [
  {
    id: 'rafael-martins',
    name: 'Rafael Martins',
    role: 'Barbeiro especialista em cortes modernos',
    bio: 'Especialista em cortes degradê, cortes masculinos modernos e finalizações personalizadas.',
    avatarUrl: '/images/barber_rafael_1794653288488.jpg',
    specialties: [
      'Low fade',
      'Mid fade',
      'Corte na tesoura',
      'Corte social',
      'Texturização',
    ],
    experienceYears: 8,
    rating: 4.9,
    reviewCount: 148,
    isAvailable: true,
    workingDays: [0, 2, 3, 4, 5, 6],
    serviceIds: [
      'corte-degrade',
      'corte-social',
      'corte-tesoura',
      'corte-infantil',
      'combo-corte-barba',
      'sobrancelha-masculina',
      'corte-barba-sobrancelha',
    ],
    reviews: [
      {
        id: 'rev-r1',
        clientName: 'Henrique Souza',
        rating: 5,
        serviceName: 'Corte Degradê',
        dateLabel: 'Há 3 dias',
        comment:
          'Degradê muito limpo e acabamento na navalha sem irritar a pele. Recomendo demais.',
      },
      {
        id: 'rev-r2',
        clientName: 'Matheus Oliveira',
        rating: 4.9,
        serviceName: 'Corte na Tesoura',
        dateLabel: 'Há 1 semana',
        comment: 'Entendeu exatamente a textura que eu queria manter no topo.',
      },
    ],
    pixDetails: {
      pixKey: '+5511994218801',
      pixKeyType: 'Celular',
      holderName: 'Rafael Martins',
      bankName: 'Nubank',
      city: 'Sao Paulo',
    },
  },
  {
    id: 'lucas-almeida',
    name: 'Lucas Almeida',
    role: 'Barbeiro e especialista em barba',
    bio: 'Profissional focado em visagismo masculino, barba desenhada e cortes personalizados.',
    avatarUrl: '/images/barber_lucas_1794653289184.jpg',
    specialties: [
      'Barba desenhada',
      'Pigmentação',
      'Corte clássico',
      'Degradê',
      'Combo cabelo e barba',
    ],
    experienceYears: 6,
    rating: 4.8,
    reviewCount: 112,
    isAvailable: true,
    workingDays: [2, 3, 4, 5, 6],
    serviceIds: [
      'corte-degrade',
      'barba-tradicional',
      'barba-desenhada',
      'combo-corte-barba',
      'sobrancelha-masculina',
      'corte-barba-sobrancelha',
    ],
    reviews: [
      {
        id: 'rev-l1',
        clientName: 'Bruno Carvalho',
        rating: 5,
        serviceName: 'Barba Desenhada',
        dateLabel: 'Há 2 dias',
        comment:
          'Alinhou minha barba certinho com o formato do rosto. Ritual da toalha quente impecável.',
      },
      {
        id: 'rev-l2',
        clientName: 'Thiago Mendes',
        rating: 4.8,
        serviceName: 'Combo Corte + Barba',
        dateLabel: 'Há 2 semanas',
        comment: 'Atendimento rápido, caprichado e muito organizado.',
      },
    ],
    pixDetails: {
      pixKey: 'lucas.almeida@blackorangebarber.com',
      pixKeyType: 'E-mail',
      holderName: 'Lucas Almeida',
      bankName: 'Mercado Pago',
      city: 'Sao Paulo',
    },
  },
  {
    id: 'diego-ferreira',
    name: 'Diego Ferreira',
    role: 'Barbeiro especialista em cortes clássicos',
    bio: 'Atendimento personalizado para quem busca um visual elegante, clássico e bem finalizado.',
    avatarUrl: '/images/barber_diego_1794653289512.jpg',
    specialties: [
      'Corte clássico',
      'Corte na tesoura',
      'Corte social',
      'Barba tradicional',
      'Sobrancelha',
    ],
    experienceYears: 10,
    rating: 5.0,
    reviewCount: 194,
    isAvailable: true,
    workingDays: [0, 2, 3, 4, 5, 6],
    serviceIds: [
      'corte-social',
      'corte-tesoura',
      'corte-infantil',
      'barba-tradicional',
      'combo-corte-barba',
      'sobrancelha-masculina',
      'corte-barba-sobrancelha',
    ],
    reviews: [
      {
        id: 'rev-d1',
        clientName: 'Eduardo Nogueira',
        rating: 5,
        serviceName: 'Corte Social',
        dateLabel: 'Ontem',
        comment:
          'Dez anos de experiência fazem diferença. Corte social perfeito para reuniões.',
      },
      {
        id: 'rev-d2',
        clientName: 'Felipe Castro',
        rating: 5,
        serviceName: 'Corte + Barba + Sobrancelha',
        dateLabel: 'Há 5 dias',
        comment: 'Saí renovado. Atenção nos mínimos detalhes do início ao fim.',
      },
    ],
    pixDetails: {
      pixKey: '+5511973104422',
      pixKeyType: 'Celular',
      holderName: 'Diego Ferreira',
      bankName: 'Itaú',
      city: 'Sao Paulo',
    },
  },
];

export const SERVICES: Service[] = [
  {
    id: 'corte-degrade',
    slug: 'corte-degrade',
    name: 'Corte Degradê',
    category: 'Cortes',
    shortDescription:
      'Corte moderno com transição gradual nas laterais e acabamento personalizado.',
    detailedDescription:
      'Técnica de transição suave nas laterais e nuca (low, mid ou high fade) combinada com acabamento na navalha e finalização no topo com pomada de efeito natural ou matte.',
    priceCents: 4500,
    durationMinutes: 45,
    imageUrl: '/images/service_fade_cut_1794653288698.jpg',
    popular: true,
    supportsVirtualTryOn: true,
    tryOnStyleId: 'corte-degrade',
    barberIds: ['rafael-martins', 'lucas-almeida'],
    careRecommendations: [
      'Evite usar boné nas primeiras 2 horas após a finalização com pomada.',
      'Para manter o degradê alinhado, recomenda-se manutenção entre 15 e 20 dias.',
      'Chegue com o cabelo limpo e sem excesso de gel para melhor leitura dos fios.',
    ],
  },
  {
    id: 'corte-social',
    slug: 'corte-social',
    name: 'Corte Social',
    category: 'Cortes',
    shortDescription:
      'Corte clássico e versátil, ideal para um visual elegante e profissional.',
    detailedDescription:
      'Corte equilibrado com laterais discretas e topo estruturado para fácil modelagem no dia a dia. Ideal para ambientes corporativos e ocasiões formais sem perder praticidade.',
    priceCents: 4000,
    durationMinutes: 40,
    imageUrl: '/images/service_scissor_cut_1794653290939.jpg',
    popular: true,
    supportsVirtualTryOn: true,
    tryOnStyleId: 'corte-social',
    barberIds: ['rafael-martins', 'diego-ferreira'],
    careRecommendations: [
      'Use pequena quantidade de creme ou pomada leve com os fios levemente úmidos.',
      'Manutenção sugerida a cada 3 a 4 semanas para preservar o caimento lateral.',
    ],
  },
  {
    id: 'corte-tesoura',
    slug: 'corte-tesoura',
    name: 'Corte na Tesoura',
    category: 'Cortes',
    shortDescription:
      'Corte realizado predominantemente com tesoura, respeitando o formato e o caimento do cabelo.',
    detailedDescription:
      'Execução artesanal feita fio a fio com tesoura de precisão para manter movimento natural, volume controlado e crescimento mais uniforme ao longo das semanas.',
    priceCents: 5000,
    durationMinutes: 50,
    imageUrl: '/images/service_scissor_cut_1794653290939.jpg',
    popular: false,
    supportsVirtualTryOn: true,
    tryOnStyleId: 'corte-tesoura',
    barberIds: ['rafael-martins', 'diego-ferreira'],
    careRecommendations: [
      'Indicado para cabelos médios, longos ou com redemoinhos acentuados.',
      'Finalize com secador em temperatura morna para ativar o volume natural.',
    ],
  },
  {
    id: 'corte-infantil',
    slug: 'corte-infantil',
    name: 'Corte Infantil',
    category: 'Cortes',
    shortDescription:
      'Corte masculino para crianças, realizado com cuidado e atendimento personalizado.',
    detailedDescription:
      'Atendimento paciente e acolhedor para crianças de até 12 anos, com foco em conforto, segurança e um visual prático para a rotina escolar e passeios.',
    priceCents: 3500,
    durationMinutes: 35,
    imageUrl: '/images/service_fade_cut_1794653288698.jpg',
    popular: false,
    supportsVirtualTryOn: false,
    barberIds: ['rafael-martins', 'diego-ferreira'],
    careRecommendations: [
      'Acompanhamento de um responsável é obrigatório durante todo o atendimento.',
      'Se possível, traga uma referência visual do corte desejado.',
    ],
  },
  {
    id: 'barba-tradicional',
    slug: 'barba-tradicional',
    name: 'Barba Tradicional',
    category: 'Barba',
    shortDescription: 'Modelagem, toalha quente, acabamento e finalização da barba.',
    detailedDescription:
      'Ritual clássico com aplicação de toalha quente para abertura dos poros, espuma hidratante, alinhamento na navalha e finalização refrescante com pós-barba e óleo nutritivo.',
    priceCents: 3000,
    durationMinutes: 30,
    imageUrl: '/images/service_beard_ritual_1794653292138.jpg',
    popular: false,
    supportsVirtualTryOn: false,
    barberIds: ['lucas-almeida', 'diego-ferreira'],
    careRecommendations: [
      'Evite exposição solar intensa logo após o barbear com navalha.',
      'Hidrate os fios diariamente com óleo ou balm específico para barba.',
    ],
  },
  {
    id: 'barba-desenhada',
    slug: 'barba-desenhada',
    name: 'Barba Desenhada',
    category: 'Barba',
    shortDescription:
      'Desenho personalizado da barba de acordo com o formato do rosto.',
    detailedDescription:
      'Consultoria de visagismo aplicada ao contorno das bochechas, mandíbula e pescoço, criando linhas simétricas e degradê na barba para valorizar os traços faciais.',
    priceCents: 3500,
    durationMinutes: 35,
    imageUrl: '/images/service_beard_ritual_1794653292138.jpg',
    popular: true,
    supportsVirtualTryOn: true,
    tryOnStyleId: 'barba-desenhada',
    barberIds: ['lucas-almeida'],
    careRecommendations: [
      'Não apare os contornos em casa 3 dias antes do horário para melhor definição.',
      'Use balm modelador para manter os fios alinhados durante o dia.',
    ],
  },
  {
    id: 'combo-corte-barba',
    slug: 'combo-corte-barba',
    name: 'Combo Corte + Barba',
    category: 'Combos',
    shortDescription: 'Corte completo acompanhado de modelagem e acabamento da barba.',
    detailedDescription:
      'Sessão integrada combinando o corte de sua preferência com o ritual completo de barba, toalha quente e alinhamento harmônico entre costeletas e mandíbula.',
    priceCents: 7000,
    durationMinutes: 75,
    imageUrl: '/images/service_combo_finish_1794653292260.jpg',
    popular: true,
    supportsVirtualTryOn: true,
    tryOnStyleId: 'combo-corte-barba',
    barberIds: ['rafael-martins', 'lucas-almeida', 'diego-ferreira'],
    careRecommendations: [
      'Reserve 75 minutos tranquilos na agenda para aproveitar o ritual completo.',
      'Informe ao barbeiro se possui pele sensível para seleção do pós-barba ideal.',
    ],
  },
  {
    id: 'sobrancelha-masculina',
    slug: 'sobrancelha-masculina',
    name: 'Sobrancelha Masculina',
    category: 'Acabamentos',
    shortDescription:
      'Limpeza e alinhamento da sobrancelha com acabamento discreto e natural.',
    detailedDescription:
      'Remoção cuidadosa dos excessos com navalha de precisão e aparo dos fios longos, preservando o desenho natural e a expressão masculina.',
    priceCents: 2000,
    durationMinutes: 15,
    imageUrl: '/images/service_combo_finish_1794653292260.jpg',
    popular: false,
    supportsVirtualTryOn: false,
    barberIds: ['rafael-martins', 'lucas-almeida', 'diego-ferreira'],
    careRecommendations: [
      'Procedimento rápido, ideal para combinar com qualquer corte.',
      'Evite passar ácidos ou cremes esfoliantes na região no mesmo dia.',
    ],
  },
  {
    id: 'corte-barba-sobrancelha',
    slug: 'corte-barba-sobrancelha',
    name: 'Corte + Barba + Sobrancelha',
    category: 'Combos',
    shortDescription:
      'Experiência completa com corte, barba e acabamento das sobrancelhas.',
    detailedDescription:
      'Nosso pacote mais completo para renovação total do visual: corte personalizado, ritual de barba com toalha quente, limpeza discreta de sobrancelhas e finalização premium.',
    priceCents: 8500,
    durationMinutes: 90,
    imageUrl: '/images/service_combo_finish_1794653292260.jpg',
    popular: false,
    supportsVirtualTryOn: true,
    tryOnStyleId: 'corte-barba-sobrancelha',
    barberIds: ['rafael-martins', 'lucas-almeida', 'diego-ferreira'],
    careRecommendations: [
      'Chegue com 5 minutos de antecedência para escolher seu café e alinhar o estilo.',
      'Ideal antes de eventos, viagens ou compromissos importantes.',
    ],
  },
];

export const CLIENT_REVIEWS: ClientReview[] = [
  {
    id: 'cr-1',
    clientName: 'Gustavo Nogueira',
    serviceName: 'Combo Corte + Barba',
    barberName: 'Rafael Martins',
    rating: 5,
    dateLabel: 'Novembro 2026',
    comment:
      'Ambiente impecável, zero atraso e o degradê ficou exatamente como eu pedi. O agendamento pelo app resolve tudo em segundos.',
  },
  {
    id: 'cr-2',
    clientName: 'André Vasconcelos',
    serviceName: 'Barba Desenhada',
    barberName: 'Lucas Almeida',
    rating: 4.9,
    dateLabel: 'Novembro 2026',
    comment:
      'A consultoria de visagismo fez muita diferença na linha da barba. Toalha quente e atendimento muito profissional.',
  },
  {
    id: 'cr-3',
    clientName: 'Rodrigo Tavares',
    serviceName: 'Corte Social',
    barberName: 'Diego Ferreira',
    rating: 5,
    dateLabel: 'Outubro 2026',
    comment:
      'Vou há meses com o Diego. Organização exemplar, lugar limpo e fácil de estacionar no Centro.',
  },
];

export const VIRTUAL_HAIRSTYLE_PRESETS: {
  id: VirtualHairstyleId;
  name: string;
  serviceId: string;
  subtitle: string;
  idealFaces: string;
  finishNote: string;
}[] = [
  {
    id: 'corte-degrade',
    name: 'Corte Degradê',
    serviceId: 'corte-degrade',
    subtitle: 'Laterais limpas em transição gradual e topo texturizado',
    idealFaces: 'Oval, Redondo e Quadrado',
    finishNote: 'Alonga visualmente as laterais e destaca a linha do maxilar.',
  },
  {
    id: 'corte-social',
    name: 'Corte Social',
    serviceId: 'corte-social',
    subtitle: 'Lateral clássica bem contornada e divisão lateral discreta',
    idealFaces: 'Oval, Quadrado e Diamante',
    finishNote: 'Proporção equilibrada e elegante para rotina executiva.',
  },
  {
    id: 'corte-tesoura',
    name: 'Corte na Tesoura',
    serviceId: 'corte-tesoura',
    subtitle: 'Camadas naturais com volume controlado no topo e laterais',
    idealFaces: 'Diamante, Triangular e Oval',
    finishNote: 'Suaviza ângulos marcados com movimento leve.',
  },
  {
    id: 'barba-desenhada',
    name: 'Barba Desenhada',
    serviceId: 'barba-desenhada',
    subtitle: 'Contorno geométrico limpo que define o terço inferior',
    idealFaces: 'Redondo, Oval e Triangular',
    finishNote: 'Cria definição na mandíbula e equilíbrio facial.',
  },
  {
    id: 'combo-corte-barba',
    name: 'Combo Corte + Barba',
    serviceId: 'combo-corte-barba',
    subtitle: 'Harmonia integrada entre degradê lateral e barba alinhada',
    idealFaces: 'Todos os formatos de rosto',
    finishNote: 'Transição contínua entre têmporas, costeletas e barba.',
  },
  {
    id: 'corte-barba-sobrancelha',
    name: 'Plano Completo (Corte + Barba + Sobrancelha)',
    serviceId: 'corte-barba-sobrancelha',
    subtitle: 'Pacote completo com corte, barba desenhada e limpeza de sobrancelha',
    idealFaces: 'Todos os formatos de rosto',
    finishNote: 'Equilíbrio total do terço superior ao maxilar com sobrancelha limpa.',
  },
];

export const DEMONSTRATION_SLOTS: string[] = [
  '08:00',
  '08:30',
  '09:00',
  '09:45',
  '10:30',
  '11:15',
  '13:00',
  '13:45',
  '14:30',
  '15:15',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
];

function getRelativeDateISO(daysOffset: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const date = new Date(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day) + daysOffset,
    12,
    0,
    0
  );
  // Skip Monday (1) if offset lands on closed day
  if (date.getDay() === 1) {
    date.setDate(date.getDate() + (daysOffset >= 0 ? 1 : -1));
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function createInitialSeedAppointments(): Appointment[] {
  const todayOpen = getRelativeDateISO(0);
  const nextOpen = getRelativeDateISO(2);
  const pastOpen1 = getRelativeDateISO(-6);
  const pastOpen2 = getRelativeDateISO(-21);

  return [
    {
      id: 'apt-seed-1',
      bookingCode: 'BO-4821',
      shopId: BARBERSHOP_INFO.id,
      clientId: 'client-demo',
      clientName: 'Lucas Ribeiro',
      clientPhone: '(11) 98765-4321',
      clientEmail: 'lucas.ribeiro@exemplo.com',
      serviceId: 'corte-degrade',
      serviceName: 'Corte Degradê',
      serviceDurationMinutes: 45,
      priceCents: 4500,
      barberId: 'rafael-martins',
      barberName: 'Rafael Martins',
      anyBarberRequested: false,
      date: nextOpen,
      startTime: '10:30',
      endTime: '11:15',
      notes: 'Manter topo um pouco mais alto na tesoura.',
      paymentMethod: 'pix',
      status: 'Confirmado',
      changeHistory: [
        {
          id: 'hist-1',
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          actor: 'cliente',
          action: 'Agendamento criado pelo aplicativo do cliente',
          newStatus: 'Confirmado',
        },
      ],
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    // Busy slots from other fictitious clients today so availability realistically shows some occupied times
    {
      id: 'apt-busy-1',
      bookingCode: 'BO-4790',
      shopId: BARBERSHOP_INFO.id,
      clientId: 'other-client-1',
      clientName: 'Marcos Vinícius',
      clientPhone: '(11) 98111-2233',
      serviceId: 'corte-degrade',
      serviceName: 'Corte Degradê',
      serviceDurationMinutes: 45,
      priceCents: 4500,
      barberId: 'rafael-martins',
      barberName: 'Rafael Martins',
      anyBarberRequested: false,
      date: todayOpen,
      startTime: '09:45',
      endTime: '10:30',
      paymentMethod: 'cartao_credito',
      status: 'Confirmado',
      changeHistory: [],
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      updatedAt: new Date(Date.now() - 172800000).toISOString(),
    },
    {
      id: 'apt-busy-2',
      bookingCode: 'BO-4792',
      shopId: BARBERSHOP_INFO.id,
      clientId: 'other-client-2',
      clientName: 'Daniel Costa',
      clientPhone: '(11) 98222-3344',
      serviceId: 'combo-corte-barba',
      serviceName: 'Combo Corte + Barba',
      serviceDurationMinutes: 75,
      priceCents: 7000,
      barberId: 'lucas-almeida',
      barberName: 'Lucas Almeida',
      anyBarberRequested: false,
      date: todayOpen,
      startTime: '11:15',
      endTime: '12:30',
      paymentMethod: 'pix',
      status: 'Confirmado',
      changeHistory: [],
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      updatedAt: new Date(Date.now() - 172800000).toISOString(),
    },
    {
      id: 'apt-busy-3',
      bookingCode: 'BO-4795',
      shopId: BARBERSHOP_INFO.id,
      clientId: 'other-client-3',
      clientName: 'Caio Martins',
      clientPhone: '(11) 98333-4455',
      serviceId: 'corte-social',
      serviceName: 'Corte Social',
      serviceDurationMinutes: 40,
      priceCents: 4000,
      barberId: 'diego-ferreira',
      barberName: 'Diego Ferreira',
      anyBarberRequested: false,
      date: todayOpen,
      startTime: '09:45',
      endTime: '10:25',
      paymentMethod: 'dinheiro',
      status: 'Confirmado',
      changeHistory: [],
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      updatedAt: new Date(Date.now() - 172800000).toISOString(),
    },
    {
      id: 'apt-seed-past-1',
      bookingCode: 'BO-4510',
      shopId: BARBERSHOP_INFO.id,
      clientId: 'client-demo',
      clientName: 'Lucas Ribeiro',
      clientPhone: '(11) 98765-4321',
      clientEmail: 'lucas.ribeiro@exemplo.com',
      serviceId: 'combo-corte-barba',
      serviceName: 'Combo Corte + Barba',
      serviceDurationMinutes: 75,
      priceCents: 7000,
      barberId: 'lucas-almeida',
      barberName: 'Lucas Almeida',
      anyBarberRequested: false,
      date: pastOpen1,
      startTime: '16:00',
      endTime: '17:15',
      paymentMethod: 'cartao_debito',
      status: 'Concluído',
      changeHistory: [
        {
          id: 'hist-p1',
          timestamp: new Date(Date.now() - 6 * 86400000).toISOString(),
          actor: 'sistema',
          action: 'Atendimento concluído',
          previousStatus: 'Confirmado',
          newStatus: 'Concluído',
        },
      ],
      createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    },
    {
      id: 'apt-seed-past-2',
      bookingCode: 'BO-4288',
      shopId: BARBERSHOP_INFO.id,
      clientId: 'client-demo',
      clientName: 'Lucas Ribeiro',
      clientPhone: '(11) 98765-4321',
      serviceId: 'corte-social',
      serviceName: 'Corte Social',
      serviceDurationMinutes: 40,
      priceCents: 4000,
      barberId: 'diego-ferreira',
      barberName: 'Diego Ferreira',
      anyBarberRequested: false,
      date: pastOpen2,
      startTime: '14:30',
      endTime: '15:10',
      paymentMethod: 'pix',
      status: 'Concluído',
      changeHistory: [],
      createdAt: new Date(Date.now() - 23 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 21 * 86400000).toISOString(),
    },
  ];
}
