import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { CATEGORIES } from './utils.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DATA_DIR = './data';

export interface Movimiento {
  id: string;
  fecha: string;
  motivo: string;
  description?: string;
  categoriaId: number;
  medio: 'efectivo' | 'tarjeta' | 'mercado pago';
  numCuota: number;
  totalCuotas: number;
  monto: number;
  tipo: 'egreso' | 'ingreso';
  moneda: 'ARS' | 'USD';
}

interface SaveMovementInput {
  tipo: 'egreso' | 'ingreso';
  monto: number;
  categoriaId: number;
  categoria: string;
  motivo: string;
  description?: string;
  fecha: string;
  medio: 'efectivo' | 'tarjeta' | 'mercado pago';
  moneda: 'ARS' | 'USD';
  totalCuotas: number;
}

interface ReadMovementsInput {
  tipo: 'egreso' | 'ingreso';
  mes: string;
}

const SYSTEM_PROMPT = `Sos un asistente financiero personal amigable que opera por WhatsApp.
El usuario te manda mensajes en español rioplatense para registrar gastos, ingresos o hacer consultas.

Categorías de gastos disponibles:
${CATEGORIES.map(c => `  ${c.id}. ${c.cat}`).join('\n')}

Reglas:
- Si el mensaje registra un gasto o ingreso, usá la tool guardar_movimiento
- Si el mensaje es una consulta o pide un reporte, usá leer_movimientos para obtener los datos y respondé con un análisis
- Siempre respondé en español, de forma concisa y amigable
- Para reportes en WhatsApp, usá emojis para que sea más legible
- La fecha de hoy es ${new Date().toISOString().slice(0, 10)}
- Si no queda claro si es ingreso o egreso, preguntá
- Los montos pueden venir con o sin signo de pesos, con puntos o comas
- En motivo poné el lugar o concepto (ej: "verdulería", "shopping", "farmacia")
- En description poné el detalle de lo comprado solo si el usuario lo menciona (ej: "2 zapallos, 1 pantalón"). Si no hay detalle, omitir`;

const tools: Anthropic.Tool[] = [
  {
    name: 'guardar_movimiento',
    description: 'Guarda un gasto o ingreso en el registro del mes correspondiente',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: ['egreso', 'ingreso'], description: 'Tipo de movimiento' },
        monto: { type: 'number', description: 'Monto numérico sin símbolo de moneda' },
        categoriaId: { type: 'number', description: 'ID de la categoría (1-8)' },
        categoria: { type: 'string', description: 'Nombre de la categoría' },
        motivo: { type: 'string', description: 'Lugar o concepto del gasto (ej: "verdulería", "shopping", "YPF"). Siempre requerido.' },
        description: { type: 'string', description: 'Detalle opcional de lo comprado (ej: "2 zapallos, 2 batatas"). Solo incluir si el usuario lo menciona.' },
        fecha: { type: 'string', description: 'Fecha en formato YYYY-MM-DD' },
        medio: { type: 'string', enum: ['efectivo', 'tarjeta', 'mercado pago'], description: 'Medio de pago. Si no se menciona, usar "mercado pago" por defecto' },
        moneda: { type: 'string', enum: ['ARS', 'USD'], description: 'Moneda. ARS por defecto salvo que se mencione dólares' },
        totalCuotas: { type: 'number', description: 'Total de cuotas. 0 si es pago único, o el número de cuotas si se menciona' },
      },
      required: ['tipo', 'monto', 'categoriaId', 'categoria', 'motivo', 'fecha', 'medio', 'moneda', 'totalCuotas'],
    },
  },
  {
    name: 'leer_movimientos',
    description: 'Lee los gastos o ingresos de un mes específico',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: ['egreso', 'ingreso'], description: 'Tipo de movimiento a leer' },
        mes: { type: 'string', description: 'Mes en formato YYYY-MM, ej: 2026-05' },
      },
      required: ['tipo', 'mes'],
    },
  },
];

function saveMovement(input: SaveMovementInput): object {
  const { tipo, monto, categoriaId, categoria, motivo, description, fecha, medio, moneda, totalCuotas } = input;
  const [year, month] = fecha.split('-');
  const monthStr = `${year}-${month}`;
  const prefix = tipo === 'ingreso' ? 'ingresos' : 'gastos';
  const filePath = path.join(DATA_DIR, `${prefix}-${monthStr}.json`);

  let data: Movimiento[] = [];
  if (fs.existsSync(filePath)) {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  const entry: Movimiento = { id: nanoid(), fecha, motivo, categoriaId, medio, numCuota: 1, totalCuotas, monto, tipo, moneda };
  if (description) entry.description = description;
  data.push(entry);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

  return { ok: true, movimiento: { tipo, monto, categoria, motivo, description, fecha, medio, moneda, totalCuotas } };
}

function readMovements({ tipo, mes }: ReadMovementsInput): Movimiento[] {
  const prefix = tipo === 'ingreso' ? 'ingresos' : 'gastos';
  const filePath = path.join(DATA_DIR, `${prefix}-${mes}.json`);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function executeTool(name: string, input: unknown): unknown {
  if (name === 'guardar_movimiento') return saveMovement(input as SaveMovementInput);
  if (name === 'leer_movimientos') return readMovements(input as ReadMovementsInput);
  throw new Error(`Unknown tool: ${name}`);
}

export async function processMessage(text: string): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: text }];

  while (true) {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find(b => b.type === 'text');
      return textBlock?.type === 'text' ? textBlock.text : 'No pude procesar tu mensaje.';
    }

    if (response.stop_reason === 'tool_use') {
      const toolResults: Anthropic.ToolResultBlockParam[] = response.content
        .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
        .map(toolUse => ({
          type: 'tool_result' as const,
          tool_use_id: toolUse.id,
          content: JSON.stringify(executeTool(toolUse.name, toolUse.input)),
        }));

      messages.push({ role: 'user', content: toolResults });
    }
  }
}
