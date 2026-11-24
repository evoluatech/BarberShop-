import {
  CranialShapeCategory,
  FaceShape,
  HairLengthCategory,
  HairType,
  VirtualHairstyleId,
} from '@/lib/types/domain';

export interface FaceShapeReference {
  shape: FaceShape;
  visualMarkers: string;
  proportionRule: string;
  visagismGoal: string;
  favorableStyles: VirtualHairstyleId[];
  avoidCuts: string;
}

export interface CranialShapeReference {
  shape: CranialShapeCategory;
  visualMarkers: string;
  technicalRule: string;
}

export interface HairTypeReference {
  type: HairType;
  visualMarkers: string;
  shrinkageAndVolume: string;
  cuttingRules: string;
}

export interface HairLengthReference {
  length: HairLengthCategory;
  cmEstimate: string;
  feasibilityRule: string;
}

export interface StyleVisagismReference {
  styleId: VirtualHairstyleId;
  name: string;
  technicalArchitecture: string;
  minimumLength: HairLengthCategory;
  idealReferenceProfile: string;
  greenCriteria: string[];
  redContraindications: string[];
  barberExecutionRules: string[];
}

export const FACE_SHAPE_REFERENCES: Record<FaceShape, FaceShapeReference> = {
  Oval: {
    shape: 'Oval',
    visualMarkers:
      'Testa levemente mais larga que o queixo, maçãs suaves e contorno mandibular arredondado sem ângulos rígidos.',
    proportionRule: 'Altura facial cerca de 1,35x a 1,48x maior que a largura das maçãs.',
    visagismGoal: 'Preservar a simetria natural sem exagerar na altura do topo ou no volume lateral.',
    favorableStyles: [
      'corte-degrade',
      'corte-social',
      'corte-tesoura',
      'barba-desenhada',
      'combo-corte-barba',
      'corte-barba-sobrancelha',
    ],
    avoidCuts: 'Franja muito longa cobrindo toda a testa quando o cabelo é liso pesado.',
  },
  Quadrado: {
    shape: 'Quadrado',
    visualMarkers:
      'Maxilar anguloso e largo quase alinhado à largura da testa e das maçãs do rosto.',
    proportionRule: 'Razão altura/largura <= 1,38 com mandíbula e testa próximas de 1:1.',
    visagismGoal: 'Valorizar a linha da mandíbula com laterais bem limpas ou levemente graduadas.',
    favorableStyles: [
      'corte-social',
      'corte-degrade',
      'combo-corte-barba',
      'corte-barba-sobrancelha',
    ],
    avoidCuts: 'Volume lateral excessivo nas têmporas em crânios largos que acentua o bloco quadrado.',
  },
  Redondo: {
    shape: 'Redondo',
    visualMarkers:
      'Bochechas preenchidas, contorno do queixo curto e largura facial próxima à altura vertical.',
    proportionRule: 'Razão altura/largura <= 1,24 e mandíbula mais estreita que as maçãs.',
    visagismGoal:
      'Criar verticalidade no topo e reduzir drasticamente o volume das laterais para alongar e afinar o rosto.',
    favorableStyles: [
      'corte-degrade',
      'barba-desenhada',
      'combo-corte-barba',
      'corte-barba-sobrancelha',
    ],
    avoidCuts:
      'Corte Social tradicional com lateral cheia ou Corte na Tesoura com volume lateral preservado (alargam as bochechas).',
  },
  Diamante: {
    shape: 'Diamante',
    visualMarkers:
      'Maçãs do rosto proeminentes e largas em contraste com testa e queixo visivelmente mais estreitos.',
    proportionRule: 'Largura das maçãs superior à testa e à mandíbula em pelo menos 9–11%.',
    visagismGoal:
      'Suavizar o destaque zigomático adicionando textura frontal e preenchimento controlado nas têmporas.',
    favorableStyles: [
      'corte-tesoura',
      'corte-social',
      'barba-desenhada',
      'combo-corte-barba',
    ],
    avoidCuts:
      'Degradê alto raspado na lateral em fios lisos curtos, que estreita ainda mais a testa em relação às maçãs.',
  },
  Triangular: {
    shape: 'Triangular',
    visualMarkers:
      'Mandíbula e terço inferior visivelmente mais largos que a testa e as têmporas.',
    proportionRule: 'Largura da mandíbula pelo menos 12% maior que a largura da testa.',
    visagismGoal:
      'Ampliar visualmente o terço superior (têmporas e topo) e evitar peso extra na região do queixo.',
    favorableStyles: ['corte-tesoura', 'corte-social'],
    avoidCuts:
      'Barba desenhada muito marcada/larga no maxilar ou degradê alto raspando têmporas em fio liso curto.',
  },
  Alongado: {
    shape: 'Alongado',
    visualMarkers:
      'Terço médio e inferior alongados verticalmente em relação à largura horizontal do rosto.',
    proportionRule: 'Razão altura/largura >= 1,52.',
    visagismGoal:
      'Distribuir volume moderado nas laterais e manter topo controlado/franja leve para equilibrar a altura.',
    favorableStyles: ['corte-social', 'corte-tesoura'],
    avoidCuts:
      'Degradê alto com topete vertical ou barba longa/desenhada que esticam ainda mais o perfil.',
  },
};

export const CRANIAL_SHAPE_REFERENCES: Record<CranialShapeCategory, CranialShapeReference> = {
  Equilibrado: {
    shape: 'Equilibrado',
    visualMarkers: 'Curvatura harmônica entre topo, ossos parietais (laterais) e osso occipital (nuca).',
    technicalRule: 'Permite graduação padrão de máquina ou tesoura acompanhando o contorno natural.',
  },
  'Topo alongado': {
    shape: 'Topo alongado',
    visualMarkers: 'Projeção vertical mais alta na coroa/vértice craniano.',
    technicalRule:
      'Evitar degradês muito altos e fechados que afinem as têmporas e estiquem o topo; Social e Tesoura equilibram melhor.',
  },
  'Laterais largas': {
    shape: 'Laterais largas',
    visualMarkers: 'Ossos parietais amplos projetando volume horizontal acima das orelhas.',
    technicalRule:
      'Exige degradê/taper para afinar as laterais; Corte Social uniforme ou Tesoura com comprimento lateral ampliam a largura da cabeça.',
  },
  'Occipital proeminente': {
    shape: 'Occipital proeminente',
    visualMarkers: 'Saliência óssea perceptível na parte posterior da cabeça / transição da nuca.',
    technicalRule:
      'Não raspar baixo na altura do osso occipital em cabelo curto liso/ondulado; priorizar graduação média na tesoura para sombrear a nuca.',
  },
};

export const HAIR_TYPE_REFERENCES: Record<HairType, HairTypeReference> = {
  Liso: {
    type: 'Liso',
    visualMarkers: 'Fios retilíneos desde a raiz, brilho linear e menor volume lateral espontâneo.',
    shrinkageAndVolume: 'Fator encolhimento mínimo; mostra facilmente degraus de máquina mal disfarçados.',
    cuttingRules:
      'Excelente para Corte Social e Tesoura com texturização; em Degradê curto pede conexão cuidadosa nas arestas.',
  },
  Ondulado: {
    type: 'Ondulado',
    visualMarkers: 'Curvatura em "S" suave, movimento natural e densidade intermediária.',
    shrinkageAndVolume: 'Leve retração ao secar; encaixa com naturalidade na maioria das técnicas.',
    cuttingRules:
      'Responde muito bem a Tesoura em comprimento médio/longo e a Degradês médios mantendo topo conectado.',
  },
  Cacheado: {
    type: 'Cacheado',
    visualMarkers: 'Espirais definidos desde a raiz/meio, volume concentrado e definição em cachos.',
    shrinkageAndVolume: 'Fator encolhimento relevante (30–45%); fios curtos armam lateralmente sem taper.',
    cuttingRules:
      'Brilha no Degradê (laterais limpas valorizam cachos no topo) e na Tesoura média/longa; falha em Social curto uniforme ("efeito capacete").',
  },
  Crespo: {
    type: 'Crespo',
    visualMarkers: 'Curvatura fechada em Z/espiral densa, textura estruturada e volume sustentado.',
    shrinkageAndVolume: 'Alto fator encolhimento (50%+); mantém geometria firme quando finalizado a seco.',
    cuttingRules:
      'Excelente em Degradê e Contorno/Barba; não encaixa em Corte Social tradicional ou Tesoura clássica sem taper/degradê.',
  },
};

export const HAIR_LENGTH_REFERENCES: Record<HairLengthCategory, HairLengthReference> = {
  'Raspado / Muito curto': {
    length: 'Raspado / Muito curto',
    cmEstimate: 'Abaixo de ~1,5 cm (máquina baixa/zero no topo e laterais)',
    feasibilityRule:
      'Sem massa capilar suficiente para estruturar Degradê com topo, Social ou Tesoura; viável apenas para Barba Desenhada.',
  },
  Curto: {
    length: 'Curto',
    cmEstimate: 'Entre ~1,5 cm e 4 cm no topo',
    feasibilityRule:
      'Viável para Degradê curto e Social em fios lisos/ondulados; insuficiente para Corte na Tesoura (exige >= Médio) e problemático para Cacheado no Social.',
  },
  Médio: {
    length: 'Médio',
    cmEstimate: 'Entre ~4 cm e 9 cm no topo',
    feasibilityRule:
      'Faixa mais versátil para construir transição de degradê, camadas na tesoura, topete controlado e conexão com barba.',
  },
  Longo: {
    length: 'Longo',
    cmEstimate: 'Acima de ~9 cm no topo',
    feasibilityRule:
      'Excelente para Corte na Tesoura com caimento natural e Social clássico; no Degradê exige desconexão limpa ou undercut.',
  },
};

export const STYLE_VISAGISM_REFERENCES: Record<VirtualHairstyleId, StyleVisagismReference> = {
  'corte-degrade': {
    styleId: 'corte-degrade',
    name: 'Corte Degradê',
    technicalArchitecture:
      'Laterais em transição gradual (low, mid ou high fade) reduzindo peso parietal e destacando o volume do topo.',
    minimumLength: 'Curto',
    idealReferenceProfile: 'Rostos Oval, Redondo ou Quadrado; crânio Equilibrado ou Laterais largas; fios Ondulados, Cacheados ou Crespos a partir do Curto/Médio.',
    greenCriteria: [
      'Rosto Redondo ou Quadrado com comprimento Curto/Médio/Longo (afina laterais e cria verticalidade).',
      'Crânio com Laterais largas (o degradê reduz o peso dos ossos parietais).',
      'Fios Cacheados ou Crespos médios/longos com laterais limpas.',
    ],
    redContraindications: [
      'Cabelo Raspado / Muito curto (sem massa no topo para construir a transição).',
      'Rosto Alongado + fio Liso ou + crânio Topo alongado (estica ainda mais o perfil vertical).',
      'Crânio Topo alongado com comprimento Curto (afina têmporas e destaca altura da coroa).',
      'Occipital proeminente com fios Curto liso/ondulado (expõe saliência óssea na nuca).',
    ],
    barberExecutionRules: [
      'Ajustar altura do fade (low/mid) para não estreitar rostos triangulares ou alongados.',
      'Conectar arestas preservando peso na região da coroa se houver occipital proeminente.',
    ],
  },
  'corte-social': {
    styleId: 'corte-social',
    name: 'Corte Social',
    technicalArchitecture:
      'Laterais uniformes sem raspagem acentuada, contorno clássico acima da orelha e topo estruturado com penteado lateral.',
    minimumLength: 'Curto',
    idealReferenceProfile: 'Rostos Oval, Quadrado, Alongado ou Diamante; fios Lisos ou Ondulados em comprimento Médio.',
    greenCriteria: [
      'Rosto Oval, Quadrado ou Alongado com fio Liso ou Ondulado em comprimento Médio/Longo.',
      'Crânio Equilibrado ou Topo alongado (laterais uniformes equilibram a proporção).',
    ],
    redContraindications: [
      'Cabelo Raspado / Muito curto.',
      'Cabelo Crespo (lateral uniforme sem taper expande com o encolhimento) ou Cacheado Curto (arma nas têmporas).',
      'Rosto Redondo ou crânio Laterais largas (volume lateral uniforme alarga rosto e cabeça).',
      'Occipital proeminente com comprimento Curto (nuca curta uniforme destaca o osso atrás).',
    ],
    barberExecutionRules: [
      'Manter graduação suave com tesoura/pente corrido nas laterais para alinhamento executivo.',
      'Preservar leve corpo lateral em rostos alongados para compensação horizontal.',
    ],
  },
  'corte-tesoura': {
    styleId: 'corte-tesoura',
    name: 'Corte na Tesoura',
    technicalArchitecture:
      'Construção artesanal fio a fio com camadas, textura e caimento natural respeitando redemoinhos e curvatura.',
    minimumLength: 'Médio',
    idealReferenceProfile: 'Rostos Diamante, Triangular, Alongado ou Oval; fios Ondulados, Lisos ou Cacheados em comprimento Médio ou Longo.',
    greenCriteria: [
      'Comprimento Médio ou Longo (essencial para criar camadas e movimento).',
      'Rostos Diamante, Triangular ou Alongado com fios Lisos, Ondulados ou Cacheados.',
      'Crânio Occipital proeminente ou Topo alongado (a tesoura média/longa camufla a nuca).',
    ],
    redContraindications: [
      'Cabelo Raspado / Muito curto ou Curto (não há comprimento para construir camadas na tesoura).',
      'Cabelo Crespo exclusivamente na tesoura sem taper/degradê lateral.',
      'Crânio Laterais largas ou rosto Redondo (preservar comprimento lateral aumenta a largura visual).',
    ],
    barberExecutionRules: [
      'Desfiar pontas sem tirar massa excessiva em fios ondulados/cacheados.',
      'Manter volume estratégico nas têmporas em rostos triangulares e diamante.',
    ],
  },
  'barba-desenhada': {
    styleId: 'barba-desenhada',
    name: 'Barba Desenhada',
    technicalArchitecture:
      'Alinhamento geométrico de bochecha, costeleta, bigode e linha do pescoço para esculpir ou equilibrar o terço inferior.',
    minimumLength: 'Raspado / Muito curto',
    idealReferenceProfile: 'Rostos Redondo, Oval ou Diamante buscando definição angular no maxilar.',
    greenCriteria: [
      'Rosto Redondo ou Oval com fios Ondulados, Cacheados ou Crespos (cria ângulos que afinam o rosto).',
      'Rosto Diamante precisando dar mais presença e largura ao queixo.',
    ],
    redContraindications: [
      'Rosto Triangular com mandíbula ampla + crânio Laterais largas/Topo alongado ou fio Liso (pesa ainda mais no terço inferior).',
      'Rosto Alongado com crânio Topo alongado ou cabelo Raspado (alonga ainda mais o queixo).',
      'Fio Liso ralo/curto em rosto Quadrado com Laterais largas (dificulta contorno geométrico limpo).',
    ],
    barberExecutionRules: [
      'Definir linha da bochecha levemente diagonal em rostos redondos para afinar.',
      'Manter linha do pescoço dois dedos acima do pomo de Adão sem recuar demais.',
    ],
  },
  'combo-corte-barba': {
    styleId: 'combo-corte-barba',
    name: 'Combo Corte + Barba',
    technicalArchitecture:
      'Integração contínua entre degradê/corte lateral, costeleta e barba alinhada com transição de peso uniforme.',
    minimumLength: 'Curto',
    idealReferenceProfile: 'Rostos Oval, Redondo, Quadrado ou Diamante com cabelo Curto/Médio/Longo e crânio Equilibrado.',
    greenCriteria: [
      'Rostos Oval, Quadrado, Redondo ou Diamante com comprimento Curto/Médio/Longo.',
      'Transição conectada entre têmporas e barba valorizando o maxilar.',
    ],
    redContraindications: [
      'Cabelo Raspado / Muito curto (não permite estruturar o corte do combo).',
      'Rosto Alongado com crânio Topo alongado (degradê + barba esticam verticalmente o rosto).',
      'Rosto Triangular com Laterais largas ou fio Liso Curto (desequilíbrio entre maxilar largo e têmporas limpas).',
      'Occipital proeminente com cabelo Curto liso/ondulado.',
    ],
    barberExecutionRules: [
      'Fazer taper suave na costeleta conectando a altura do corte ao volume da barba.',
      'Evitar alongar excessivamente o cavanhaque em rostos alongados.',
    ],
  },
  'corte-barba-sobrancelha': {
    styleId: 'corte-barba-sobrancelha',
    name: 'Plano Completo (Corte + Barba + Sobrancelha)',
    technicalArchitecture:
      'Harmonização integral dos três terços faciais: corte, barba desenhada e limpeza discreta de sobrancelhas.',
    minimumLength: 'Curto',
    idealReferenceProfile: 'Rostos Oval, Quadrado, Redondo ou Diamante com massa capilar Curto/Médio/Longo.',
    greenCriteria: [
      'Rostos Oval, Quadrado, Redondo ou Diamante com boa massa capilar para corte e acabamento facial completo.',
    ],
    redContraindications: [
      'Cabelo Raspado / Muito curto.',
      'Rosto Alongado com crânio Topo alongado.',
      'Rosto Triangular com Laterais largas ou fio Liso Curto.',
      'Occipital proeminente com cabelo Curto liso/ondulado.',
    ],
    barberExecutionRules: [
      'Limpar apenas excessos da sobrancelha preservando arco masculino natural.',
      'Equilibrar peso entre barba e laterais do corte conforme o formato facial.',
    ],
  },
};
