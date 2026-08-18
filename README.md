# 💎 FinMaster — Enterprise Personal Wealth & Multi-Asset Intelligence

[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20RLS-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Vitest](https://img.shields.io/badge/Vitest-Passing-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Modern Personal Finance Management and Wealth Intelligence Platform with AI-assisted natural language entry, credit card lifecycle tracking, cryptocurrency portfolio consolidation, and privacy masking.**

---

## 🌟 Overview

**FinMaster** is an open-source, full-stack personal finance and wealth management system engineered to deliver deep financial insights, runway projections, and multi-asset tracking. Designed with a privacy-first architecture, it bridges traditional fiat banking, credit card billing cycles, and decentralized/CEX cryptocurrency holdings into a unified dashboard.

---

## 🚀 Key Features

* 📊 **Executive Wealth Dashboard**: Real-time cashflow visualization, net worth calculations, categorized expenses, and interactive charting powered by **Recharts**.
* 🛡️ **Discrete / Privacy Mask Mode**: Toggleable privacy shield masking monetary balances (`••••`) for safe operation in public or mobile environments.
* 💳 **Smart Credit Card Lifecycle Manager**: Dynamic billing cycle period calculator (`getBillingPeriod`), invoice closing vs. due date projections, available credit limit monitoring, and multi-card consolidation.
* 🪙 **Multi-Asset & Crypto Portfolio**: Consolidated tracking of crypto holdings with live USD/BRL currency conversion and hardened per-user API key isolation.
* 🤖 **Natural Language & Voice Input**: AI-driven transaction entry supporting natural language expressions (text or speech) with automatic categorization and merchant recognition.
* 🎯 **Safe-to-Spend & Burn Rate Intelligence**: Real-time algorithms forecasting daily disposable income, runaway metrics, and retirement accumulation targets.
* 📱 **Progressive Web App (PWA)**: Mobile-optimized responsive interface with offline caching and native app-like installation.

---

## 🏗️ Architecture & Security Model

```
FinMaster/
├── src/
│   ├── components/
│   │   ├── dashboard/            # Executive dashboard widgets (Burn Rate, Asset Allocation)
│   │   ├── ui/                   # Reusable Shadcn UI / Radix primitives
│   │   └── CryptoCard.tsx        # Crypto holdings consolidation widget
│   ├── hooks/
│   │   ├── useCardInvoice.ts     # Credit card invoice calculation & filtering
│   │   ├── useBillingPeriod.ts   # Invoice cycle dates & closing day logic
│   │   └── useAppSettings.ts     # Global theme & privacy mode state
│   ├── pages/
│   │   ├── Dashboard.tsx         # Main executive overview
│   │   ├── Transactions.tsx      # Paginated transaction feed (50 items/batch)
│   │   └── Cards.tsx             # Card management & invoice breakdown
│   ├── test/
│   │   └── invoices.test.ts      # Unit test suite for invoice & currency conversions
│   └── integrations/supabase/    # Supabase type-safe client bindings
├── supabase/
│   ├── functions/
│   │   └── get-okx-balance/      # Hardened Edge Function (per-user credentials)
│   └── migrations/               # PostgreSQL schemas & Row Level Security (RLS)
├── package.json
└── vite.config.ts
```

---

## 🛠️ Tech Stack

| Domain | Technologies |
| :--- | :--- |
| **Frontend** | React 18, TypeScript 5.8, Tailwind CSS, Shadcn UI / Radix |
| **State & Data Fetching** | TanStack React Query v5 |
| **Data Visualization** | Recharts |
| **Backend / Edge** | Supabase (PostgreSQL 15), Supabase Auth, Deno Edge Functions |
| **Testing** | Vitest |

---

## ⚡ Getting Started

### 1. Prerequisites
* Node.js `>= 18.0.0`
* Supabase CLI (optional for local edge functions)

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/lucasantannaeng/FinMaster.git
cd FinMaster

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### 3. Environment Variables (`.env`)

Configure your `.env` file based on `.env.example`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_public_anon_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

### 4. Running Locally

```bash
# Start Vite development server
npm run dev
```

---

## 🧪 Testing

```bash
# Run Vitest test suites
npm test

# Build production bundle
npm run build
```

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
Developed with high standards by **Luca Rodrigues Gomes de Sant'Anna**.
