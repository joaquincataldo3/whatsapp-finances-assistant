# gastos-app

Personal finance tracker with an Angular frontend, Express backend, and an AI agent accessible via WhatsApp.

## Project structure

```
gastos-app/
├── backend/              ← Express + Node.js (TypeScript, ES modules)
│   ├── server.ts         ← entry point — REST API + monthly rollover
│   ├── agent.ts          ← Claude AI agent with tool use (core of the bot)
│   ├── whatsapp.ts       ← Twilio webhook router (/webhook/whatsapp)
│   ├── utils.ts          ← CATEGORIES (single source of truth)
│   ├── .env              ← environment variables (not in repo)
│   └── data/             ← JSON files per month (not in repo)
└── frontend/             ← Angular (TypeScript)
    └── src/app/
        ├── components/
        │   ├── gastos-form/       ← form to register movements
        │   ├── gastos-list/       ← monthly movement list
        │   ├── month-selector/    ← month picker
        │   ├── total-balance/     ← total income/expense balance
        │   └── categoria-balance/ ← balance by category
        ├── services/
        │   ├── gastos.service.ts
        │   └── ingresos.service.ts
        └── pipes/
            └── fecha-corta.pipe.ts
```

## Running the project

```bash
# Backend (port 3000)
cd backend
npm start          # tsx server.ts
npm run dev        # tsx watch server.ts (hot reload)

# Frontend (port 4200)
cd frontend
ng serve
```

## Backend REST API

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/gastos` | Register expense |
| `POST` | `/api/ingresos` | Register income |
| `GET` | `/api/gastos?month=YYYY-MM` | Get expenses for a month |
| `GET` | `/api/ingresos?month=YYYY-MM` | Get income for a month |
| `DELETE` | `/api/gastos/:id?month=YYYY-MM` | Delete expense |
| `DELETE` | `/api/ingresos/:id?month=YYYY-MM` | Delete income |
| `POST` | `/webhook/whatsapp` | Twilio webhook (WhatsApp bot) |

## Movement structure (JSON)

```json
{
  "id": "nanoid",
  "fecha": "YYYY-MM-DD",
  "motivo": "expense description",
  "categoriaId": 3,
  "medio": "efectivo | tarjeta",
  "numCuota": 1,
  "totalCuotas": 0,
  "monto": 150,
  "tipo": "egreso | ingreso",
  "moneda": "ARS | USD"
}
```

## Storage

Data is stored as JSON files in `backend/data/`:
- `gastos-YYYY-MM.json`
- `ingresos-YYYY-MM.json`

On server start, `rolloverToNewMonth()` automatically copies pending installment expenses into the new month.

## Categories (`backend/utils.ts`)

```
1. Salir a bailar
2. Salir a comer
3. Supermercado
4. Salud
5. Deporte
6. Auto
7. Otros
8. Ropa
```

To add or modify categories, edit **only `utils.ts`** — all other files import from there.

## WhatsApp bot (`agent.ts`)

Claude AI agent with tool use. Receives natural language messages via WhatsApp and can:

- Register expenses/income (`guardar_movimiento`)
- Query movements for a month (`leer_movimientos`)

**Model:** `claude-haiku-4-5` (fast and cheap for conversational use)

**Flow:**
```
WhatsApp → Twilio Sandbox → POST /webhook/whatsapp → agent.ts → tools → JSON files
                                                           ↓
                                                  reply via Twilio → WhatsApp
```

**Adding new tools:** add the tool definition to the `tools` array in `agent.ts` and handle it in `executeTool()`.

## Environment variables (`backend/.env`)

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
MY_WHATSAPP_NUMBER=whatsapp:+YOUR_NUMBER
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx
```

## Activating the bot

1. Add `ANTHROPIC_API_KEY` to `.env` (get it at console.anthropic.com)
2. Start the backend: `npm start`
3. Expose localhost: `cloudflared tunnel --url http://localhost:3000`
4. Set the webhook in Twilio Console > WhatsApp Sandbox Settings > "When a message comes in": `https://YOUR-URL/webhook/whatsapp` (POST)
5. Send a message from WhatsApp to the sandbox number

## Architecture decisions

- **No database:** JSON files in `/data` are sufficient for single-user personal use
- **No auth:** personal use app
- **Cloudflare Tunnel** for local development; Railway ($5/mo) if 24/7 uptime is needed
- **Code in English, domain content in Spanish** — variable/function names are English; system prompt, WhatsApp responses, and category names stay in Spanish
- Frontend and bot are independent layers sharing the same JSON files
