import express, { Request, Response } from 'express';
import twilio from 'twilio';
import { processMessage } from './agent.js';
import { enqueue } from './queue.js';

export const whatsappRouter = express.Router();

const QUERY_KEYWORDS = ['cuánto', 'cuanto', 'cuántos', 'cuantos', 'qué', 'que gasté', 'dame', 'mostrar', 'listar', 'ver', 'total', 'resumen', 'reporte'];

function isQuery(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (lower.endsWith('?')) return true;
  return QUERY_KEYWORDS.some(k => lower.includes(k));
}

whatsappRouter.post('/whatsapp', async (req: Request, res: Response) => {
  const MY_NUMBER = process.env.MY_WHATSAPP_NUMBER;
  const from: string = req.body.From;
  const texto: string = req.body.Body?.trim();

  if (from !== MY_NUMBER) {
    res.sendStatus(403);
    return;
  }

  if (!texto) {
    res.sendStatus(200);
    return;
  }

  res.sendStatus(200);

  if (isQuery(texto)) {
    // Queries: process immediately so the user gets a real-time answer
    try {
      const reply = await processMessage(texto);
      await sendWhatsApp(from, reply);
    } catch (err) {
      console.error('Error procesando consulta:', err);
      await sendWhatsApp(from, 'Ocurrió un error procesando tu consulta. Intentá de nuevo.');
    }
  } else {
    // Registrations: queue and confirm receipt
    enqueue(from, texto);
    await sendWhatsApp(from, '📥 Recibido. Lo registro cuando procese la queue.');
  }
});

export async function sendWhatsApp(to: string, message: string): Promise<void> {
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to,
    body: message,
  });
}
