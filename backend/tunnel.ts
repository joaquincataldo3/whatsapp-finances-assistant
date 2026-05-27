import { spawn } from 'child_process';

function printWebhookReminder(tunnelUrl: string): void {
  const webhookUrl = `${tunnelUrl}/webhook/whatsapp`;
  console.log('');
  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log('│  ⚠️  Actualizá el webhook en Twilio si la URL cambió    │');
  console.log('│                                                         │');
  console.log(`│  URL: ${webhookUrl}`);
  console.log('│                                                         │');
  console.log('│  https://console.twilio.com → WhatsApp Sandbox Settings │');
  console.log('└─────────────────────────────────────────────────────────┘');
  console.log('');
}

export function startTunnel(): void {
  console.log('[Tunnel] Iniciando cloudflared...');

  const tunnel = spawn('cloudflared', ['tunnel', '--url', 'http://localhost:3000'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let urlFound = false;

  const parseOutput = (data: Buffer) => {
    if (urlFound) return;
    const text = data.toString();
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match) {
      urlFound = true;
      const url = match[0];
      printWebhookReminder(url);
    }
  };

  tunnel.stdout.on('data', parseOutput);
  tunnel.stderr.on('data', parseOutput);

  tunnel.on('error', err => {
    console.error('[Tunnel] No se pudo iniciar cloudflared:', err.message);
    console.error('[Tunnel] Verificá que cloudflared esté instalado (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)');
  });

  tunnel.on('close', code => {
    console.log(`[Tunnel] Proceso terminado (código ${code})`);
  });
}
