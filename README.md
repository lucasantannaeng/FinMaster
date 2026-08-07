# 💎 FinMaster — Plataforma Inteligente de Gestão Financeira Pessoal

[![React](https://img.shields.io/badge/React-18.3-blue.svg?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-purple.svg?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Auth-green.svg?logo=supabase)](https://supabase.com/)
[![DevSecOps](https://img.shields.io/badge/DevSecOps-Audited%20%26%20Sanitized-brightgreen.svg)]()

**FinMaster** é uma solução moderna e completa para Gestão Financeira Pessoal e Planejamento Orçamentário com suporte a Inteligência Artificial. A aplicação centraliza o controle de receitas, despesas, cartões de crédito, cotação e controle de ativos cripto, cálculo da taxa/hora de trabalho e preparação de relatórios para a declaração de Imposto de Renda.

---

## 🚀 Principais Funcionalidades

- 📊 **Dashboard Financeiro Consolidado**: Visualização clara de saldos, entradas, saídas, receitas recorrentes, metas de economia e evolução temporal via gráficos interativos (`Recharts`).
- 🤖 **Lançamento Inteligente de Transações (Smart Transaction Input)**: Entrada rápida de receitas e despesas por linguagem natural (texto livre ou voz), com auto-categorização por IA.
- 💳 **Gestão de Cartões & Limites de Crédito**: Acompanhamento de faturas, limites disponíveis, datas de fechamento e vencimento de múltiplos cartões.
- 🪙 **Integração Crypto & Multi-Ativos**: Acompanhamento e gestão de carteiras de criptoativos e investimentos integrados.
- ⏱️ **Calculadora de Valor/Hora de Trabalho**: Algoritmo para cálculo do valor real da hora trabalhada do usuário com base no seu custo de vida e jornada de trabalho.
- 📑 **Relatório de Imposto de Renda / Fiscal**: Agrupamento automatizado de rendimentos e despesas dedutíveis para apoio na declaração anual de IR.
- 🛡️ **Segurança & Privacidade (Trust Engine)**: Criptografia de dados sensíveis e autenticação segura via Supabase Auth com Row Level Security (RLS).
- 📱 **Suporte PWA Instalável**: Instalação nativa em dispositivos móveis e desktops com suporte a cache e uso offline.

---

## 🛠️ Stack Tecnológica

### **Frontend & Interface**
- **Core:** React 18 + TypeScript
- **Bundler:** Vite
- **Estilização:** Tailwind CSS + Radix UI (shadcn/ui) + Lucide Icons
- **Gráficos & Métricas:** Recharts
- **SEO & Meta Tags:** React Helmet Async

### **Inteligência & IA**
- **Processamento de Linguagem Natural / IA:** Lançamento inteligente com parsers de texto e integrações de linguagem.

### **Backend & Infraestrutura**
- **Banco de Dados & Autenticação:** Supabase PostgreSQL + Supabase Auth
- **PWA:** `vite-plugin-pwa`

---

## ⚙️ Configuração de Variáveis de Ambiente (`.env`)

Crie um arquivo `.env` na raiz do projeto com base no modelo fornecido no `.env.example`:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://sua-instancia.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua_chave_publica_anonima_aqui
VITE_SUPABASE_PROJECT_ID=seu_project_id_aqui

# Integrações Opcionais de IA e Cripto (opcional)
APP_ORIGIN=https://seu-dominio-app.com
LOVABLE_API_KEY=sua_chave_lovable_opcional
OKX_API_KEY=sua_chave_okx_opcional
OKX_SECRET_KEY=seu_segredo_okx_opcional
OKX_PASSPHRASE=sua_passphrase_okx_opcional
OPENROUTER_API_KEY=sua_chave_openrouter_opcional
GROQ_API_KEY=sua_chave_groq_opcional
```

> 🛡️ **DevSecOps Note:** Nenhuma chave real ou segredo deve ser commitado no repositório. O arquivo `.env` está devidamente bloqueado no `.gitignore`.

---

## 💻 Guia de Execução Local

### Pré-requisitos
- **Node.js** v18+
- Gerenciador de pacotes: **npm**, **bun** ou **pnpm**

### Passo a Passo

1. **Clonar o Repositório:**
   ```bash
   git clone https://github.com/lucasantannaeng/FinMaster.git
   cd FinMaster
   ```

2. **Instalar Dependências:**
   ```bash
   npm install
   # ou
   bun install
   ```

3. **Configurar o Ambiente Local:**
   ```bash
   cp .env.example .env
   # Edite o arquivo .env preenchendo as variáveis correspondentes ao Supabase
   ```

4. **Executar a Aplicação:**
   ```bash
   npm run dev
   # ou
   bun dev
   ```
   Acesse a aplicação no navegador em `http://localhost:8080`.

---

## 📜 Scripts Disponíveis

- `npm run dev`: Inicia o servidor de desenvolvimento Vite.
- `npm run build`: Compila e gera o build de produção na pasta `dist/`.
- `npm run preview`: Executa a visualização do build compilado.
- `npm run lint`: Executa a verificação estática do código com ESLint.
- `npm run test`: Executa os testes automatizados com Vitest.

---

## 🔒 Conformidade DevSecOps

Este projeto é mantido sob práticas rigorosas de DevSecOps:
- Nenhuma chave de API, credencial ou segredo em hardcode.
- Bloqueio integral de arquivos `.env` e diretório `node_modules/` no `.gitignore`.
- Arquitetura de permissões baseada em RLS (Row Level Security) no Supabase.
