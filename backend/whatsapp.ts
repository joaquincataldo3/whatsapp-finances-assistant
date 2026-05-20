import express, { Request, Response } from 'express';
import twilio from 'twilio';
import { processMessage } from './agent.js';

export const whatsappRouter = express.Router();

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

  try {
    const reply = await processMessage(texto);
    await sendWhatsApp(from, reply);
  } catch (err) {
    console.error('Error processing message:', err);
    await sendWhatsApp(from, 'Ocurrió un error procesando tu mensaje. Intentá de nuevo.');
  }
});

async function sendWhatsApp(to: string, message: string): Promise<void> {
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM,
    to,
    body: message,
  });
}
