import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';

const DATA_DIR = './data';
const QUEUE_FILE = path.join(DATA_DIR, 'queue.json');

export interface QueuedMessage {
  id: string;
  from: string;
  body: string;
  timestamp: string;
  status: 'pending' | 'processed' | 'failed';
  processedAt?: string;
  response?: string;
  error?: string;
}

function readQueue(): QueuedMessage[] {
  if (!fs.existsSync(QUEUE_FILE)) return [];
  return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
}

function writeQueue(messages: QueuedMessage[]): void {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(messages, null, 2));
}

export function enqueue(from: string, body: string): QueuedMessage {
  const messages = readQueue();
  const msg: QueuedMessage = {
    id: nanoid(),
    from,
    body,
    timestamp: new Date().toISOString(),
    status: 'pending',
  };
  messages.push(msg);
  writeQueue(messages);
  return msg;
}

export function getPendingMessages(): QueuedMessage[] {
  return readQueue().filter(m => m.status === 'pending');
}

export function updateMessage(id: string, update: Partial<QueuedMessage>): void {
  const messages = readQueue();
  const idx = messages.findIndex(m => m.id === id);
  if (idx !== -1) {
    messages[idx] = { ...messages[idx], ...update };
    writeQueue(messages);
  }
}
