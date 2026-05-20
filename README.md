# gastos-app

Personal finance tracker with an AI-powered WhatsApp assistant. Register expenses and income by sending natural language messages — no need to open the app.

## Features

- **WhatsApp AI Agent** — Claude AI interprets messages in natural language, registers movements, and answers financial queries
- **Web Dashboard** — Angular frontend to view and manage expenses by month
- **Installment tracking** — expenses in installments automatically roll over each month
- **Multi-currency** — ARS and USD support

## Architecture

```
WhatsApp
   │  natural language message
   ▼
Twilio Sandbox
   │  webhook POST
   ▼
Express Backend (Node.js + TypeScript)
   │
   ├── Claude AI Agent (claude-haiku-4-5)
   │     detects intent → selects tools → generates response
   │     tools: guardar_movimiento · leer_movimientos
   │
   └── REST API ←─── Angular Frontend
         reads/writes JSON files per month
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 18, TypeScript, SCSS |
| Backend | Node.js, Express 5, TypeScript |
| AI Agent | Anthropic Claude (claude-haiku-4-5), tool use |
| WhatsApp | Twilio WhatsApp Sandbox |
| Storage | JSON files (one per month) |
| Tunnel | Cloudflare Tunnel |

## Project structure

```
gastos-app/
├── backend/
│   ├── server.ts       # Entry point — REST API + monthly rollover
│   ├── agent.ts        # Claude AI agent with tool use
│   ├── whatsapp.ts     # Twilio webhook router
│   ├── utils.ts        # Shared types and categories
│   └── data/           # JSON files per month (gitignored)
└── frontend/
    └── src/app/
        ├── components/ # gastos-form, gastos-list, month-selector, balances
        └── services/   # gastos.service, ingresos.service
```

