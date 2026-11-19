# BarberShop — Plataforma Multiplataforma de Agendamento, Visagismo Digital e Atendimento em Tempo Real

> **Aviso de Ambiente:** Este repositório contém a documentação e a arquitetura da plataforma **BarberShop** (Web e Aplicativos Mobile). Antes de publicar em ambiente de produção, configure corretamente as chaves de API, variáveis de ambiente e permissões de geolocalização.

---

## 1. Visão Geral do Produto

**BarberShop** é um ecossistema digital completo para barbearias e clientes, projetado com foco em experiência visual, agilidade no agendamento e personalização do atendimento:

* **Identidade Visual e Tema:** Interface moderna de alto contraste inspirada na estética clássica e urbana das barbearias, combinando base escura (`#0B0B0D`), superfícies em grafite (`#16161A`) e destaques em laranja vibrante (`#FF6B00` / `#EA580C`).
* **Ecossistema Multiplataforma:**
  1. **Aplicativo Mobile (Android e iOS):** Experiência nativa fluida para clientes e barbeiros, com notificações push, histórico de atendimentos e acesso rápido à agenda.
  2. **Plataforma Web (Next.js + TypeScript):** Painel administrativo e portal web responsivo para gestão completa da barbearia.

---

## 2. Principais Funcionalidades

* **Agendamento Inteligente:** Marcação rápida de horários com escolha de barbeiro, catálogo de serviços, duração estimada, lembretes automáticos e reagendamento em poucos toques.
* **Simulador Visual de Corte (Visagismo Digital):** Pré-visualização interativa de estilos de corte e barba adaptados ao **tipo de cabelo** (liso, ondulado, cacheado, crespo) e ao **formato de cabeça/rosto** do cliente antes mesmo de sentar na cadeira.
* **Localização em Tempo Real do Barbeiro:** Rastreamento ao vivo no mapa para atendimentos a domicílio ou deslocamento até a unidade, exibindo status de trajeto e tempo estimado de chegada.
* **Validação e Segurança:** Regras rígidas de validação no backend e diretrizes estruturadas de proteção de dados (`security_spec.md`).

---

## 3. Stack Tecnológica & Arquitetura

* **Front-end Web:** Next.js, TypeScript (`tsconfig.json`) e PostCSS (`postcss.config.mjs`).
* **Mobile:** Aplicativo multiplataforma compatível com **Android** e **iOS**.
* **Geolocalização & Mapas:** Integração de GPS em tempo real para acompanhamento de rotas e status do profissional.

---

## 4. Como Executar Localmente

1. **Clone o repositório:**
   ```bash
   git clone [https://github.com/seu-usuario/barbershop.git](https://github.com/seu-usuario/barbershop.git)
   cd barbershop
