import { spawn } from 'child_process';
import { writeFileSync, truncateSync, existsSync } from 'fs';
import { resolve } from 'path';

let tray: any = null;
const logPath = resolve(process.cwd(), 'spotify-rp.log');

function createIconBase64(): string {
  const w = 16, h = 16;
  const andRowPadded = 4;
  const xorSize = w * 4 * h;
  const andSize = andRowPadded * h;
  const maskSize = xorSize + andSize;
  const bmiSize = 40;
  const dataSize = bmiSize + maskSize;

  const buf = Buffer.alloc(6 + 16 + dataSize);
  let off = 0;

  buf.writeUInt16LE(0, off); off += 2;
  buf.writeUInt16LE(1, off); off += 2;
  buf.writeUInt16LE(1, off); off += 2;

  buf.writeUInt8(w, off); off += 1;
  buf.writeUInt8(h, off); off += 1;
  buf[off++] = 0;
  buf[off++] = 0;
  buf.writeUInt16LE(1, off); off += 2;
  buf.writeUInt16LE(32, off); off += 2;
  buf.writeUInt32LE(dataSize, off); off += 4;
  buf.writeUInt32LE(22, off); off += 4;

  buf.writeUInt32LE(bmiSize, off); off += 4;
  buf.writeInt32LE(w, off); off += 4;
  buf.writeInt32LE(h * 2, off); off += 4;
  buf.writeUInt16LE(1, off); off += 2;
  buf.writeUInt16LE(32, off); off += 2;
  buf.writeUInt32LE(0, off); off += 4;
  buf.writeUInt32LE(maskSize, off); off += 4;
  off += 16;

  const cx = w / 2, cy = h / 2, r = 6;
  for (let y = h - 1; y >= 0; y--) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx + 0.5, dy = y - cy + 0.5;
      if (dx * dx + dy * dy <= r * r) {
        buf[off] = 0x54; buf[off + 1] = 0xB9; buf[off + 2] = 0x1D; buf[off + 3] = 0xFF;
      }
      off += 4;
    }
  }

  off += andSize;

  return buf.toString('base64');
}

export async function initTray(onExit: () => void): Promise<void> {
  try {
    const SysTray = (await import('systray')).default;
    const icon = createIconBase64();

    tray = new SysTray({
      menu: {
        icon,
        title: '',
        tooltip: 'Spotify Local Files RP',
        items: [
          { title: 'Show Log', tooltip: 'Open live log', checked: false, enabled: true },
          { title: 'Exit', tooltip: 'Quit the application', checked: false, enabled: true },
        ],
      },
      debug: false,
    });

    tray.onClick((action: any) => {
      if (action.item.title === 'Show Log') {
        spawn('cmd.exe', [
          '/c', 'start', 'powershell.exe',
          '-ExecutionPolicy', 'Bypass',
          '-NoProfile',
          '-Command',
          `Get-Content -LiteralPath '${logPath}' -Wait`,
        ]).unref();
      } else if (action.item.title === 'Exit') {
        tray.kill(false);
        onExit();
      }
    });
  } catch (err) {
    console.error('Tray init failed (non-fatal):', (err as Error).message);
  }
}

const origLog = console.log;
const origError = console.error;
const origWarn = console.warn;

function appendLog(level: string, ...args: any[]) {
  const ts = new Date().toISOString().substring(11, 19);
  const line = `[${ts}] ${level} ${args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')}\n`;
  try { writeFileSync(logPath, line, { flag: 'a' }); } catch {}
}

export function setupLogging(): void {
  try {
    if (existsSync(logPath)) truncateSync(logPath);
    else writeFileSync(logPath, '');
  } catch {}
  console.log = (...args: any[]) => { origLog(...args); appendLog('INFO', ...args); };
  console.warn = (...args: any[]) => { origWarn(...args); appendLog('WARN', ...args); };
  console.error = (...args: any[]) => { origError(...args); appendLog('ERROR', ...args); };
}

export function killTray(): void {
  if (tray) { tray.kill(false); tray = null; }
}
