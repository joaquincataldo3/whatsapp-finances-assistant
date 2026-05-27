import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { CATEGORIES } from './utils.js';
import { whatsappRouter } from './whatsapp.js';
import { startScheduler } from './scheduler.js';
import { startTunnel } from './tunnel.js';
import type { Movimiento } from './agent.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const DATA_DIR = './data';
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

function readMonthFile(monthStr: string, tipo: 'ingreso' | 'egreso'): Movimiento[] {
  const prefix = tipo === 'ingreso' ? 'ingresos' : 'gastos';
  const filePath = path.join(DATA_DIR, `${prefix}-${monthStr}.json`);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeMonthFile(monthStr: string, tipo: 'ingreso' | 'egreso', data: Movimiento[]): void {
  const prefix = tipo === 'ingreso' ? 'ingresos' : 'gastos';
  const filePath = path.join(DATA_DIR, `${prefix}-${monthStr}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Rolls over installment expenses from the previous month into the new one

export function rolloverToNewMonth(): void {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();

  const rolloverFile = (type: string) => {
    const currentFile = path.join(DATA_DIR, `${type}-${year}-${month}.json`);
    if (fs.existsSync(currentFile)) return;

    const prevMonth = month === '01' ? '12' : String(Number(month) - 1).padStart(2, '0');
    const prevYear = month === '01' ? year - 1 : year;
    const prevFile = path.join(DATA_DIR, `${type}-${prevYear}-${prevMonth}.json`);

    if (!fs.existsSync(prevFile)) {
      fs.writeFileSync(currentFile, JSON.stringify([]));
      return;
    }

    const prevData: Movimiento[] = JSON.parse(fs.readFileSync(prevFile, 'utf8'));
    const newData = prevData
      .filter(g => g.totalCuotas > 0 && g.numCuota < g.totalCuotas)
      .map(g => ({ ...g, numCuota: g.numCuota + 1, fecha: now.toISOString().slice(0, 10) }));

    fs.writeFileSync(currentFile, JSON.stringify(newData, null, 2));
  };

  rolloverFile('gastos');
  rolloverFile('ingresos');
}

app.post('/api/:tipo', (req: Request, res: Response) => {
  const mov: Movimiento = req.body;
  if (!mov.fecha) { res.status(400).json({ error: 'falta fecha' }); return; }
  const tipo = mov.tipo === 'ingreso' ? 'ingreso' : 'egreso';
  const [year, month] = mov.fecha.split('-');
  const data = readMonthFile(`${year}-${month}`, tipo);
  data.push({ ...mov, id: Date.now().toString() });
  writeMonthFile(`${year}-${month}`, tipo, data);
  res.json({ ok: true });
});

app.get('/api/:tipo', (req: Request, res: Response) => {
  const { month } = req.query;
  if (!month) { res.status(400).json({ error: 'falta month' }); return; }
  const tipo = req.params.tipo === 'ingresos' ? 'ingreso' : 'egreso';
  res.json(readMonthFile(month as string, tipo));
});

app.delete('/api/:tipo/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { month } = req.query;
  if (!month) { res.status(400).json({ error: 'falta month' }); return; }
  const tipo = req.params.tipo === 'ingresos' ? 'ingreso' : 'egreso';
  const data = readMonthFile(month as string, tipo);
  writeMonthFile(month as string, tipo, data.filter(g => g.id !== id));
  res.json({ ok: true });
});

app.use('/webhook', whatsappRouter);

rolloverToNewMonth();
startScheduler();
if (process.env.TUNNEL === 'true') startTunnel();
app.listen(3000, () => console.log('✅ Backend listo en http://localhost:3000'));
