import cron from 'node-cron';
import { getPendingMessages, updateMessage } from './queue.js';
import { processMessage } from './agent.js';
import { sendWhatsApp } from './whatsapp.js';

export async function processQueue(): Promise<void> {
  const pending = getPendingMessages();

  if (pending.length === 0) {
    console.log('[Scheduler] No hay mensajes pendientes.');
    return;
  }

  console.log(`[Scheduler] Procesando ${pending.length} mensaje(s) pendiente(s)...`);

  const results: { body: string; response: string; ok: boolean }[] = [];

  for (const msg of pending) {
    try {
      const response = await processMessage(msg.body);
      updateMessage(msg.id, {
        status: 'processed',
        processedAt: new Date().toISOString(),
        response,
      });
      results.push({ body: msg.body, response, ok: true });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`[Scheduler] Error procesando mensaje ${msg.id}:`, error);
      updateMessage(msg.id, {
        status: 'failed',
        error,
      });
      results.push({ body: msg.body, response: error, ok: false });
    }
  }

  // Build a single summary message instead of N individual messages
  const lines: string[] = [`🤖 Procesé ${results.length} movimiento(s):\n`];
  for (const r of results) {
    if (r.ok) {
      lines.push(r.response);
    } else {
      lines.push(`❌ No pude procesar: "${r.body}"\n   Error: ${r.response}`);
    }
  }
  const summary = lines.join('\n');

  // All messages came from the same number (single-user app), grab it from pending
  const from = pending[0].from;
  await sendWhatsApp(from, summary);

  console.log(`[Scheduler] Listo. Procesados: ${results.filter(r => r.ok).length}, fallidos: ${results.filter(r => !r.ok).length}`);
}

export function startScheduler(): void {
  // Startup flush: process any messages that were pending while the app was off
  processQueue().catch(err => console.error('[Scheduler] Error en startup flush:', err));

  // Nightly cron at 23:00 for when the app runs all day
  cron.schedule('0 23 * * *', () => {
    console.log('[Scheduler] Cron 23:00 — procesando queue...');
    processQueue().catch(err => console.error('[Scheduler] Error en cron:', err));
  });

  console.log('[Scheduler] Iniciado. Cron configurado para las 23:00.');
}
