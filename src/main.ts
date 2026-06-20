import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app.module';
import { setupSwagger } from './config/swagger.config';
import { execSync, exec } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SERVICE_NAME = 'products-service';
const LOCK_FILE = path.join(os.tmpdir(), `${SERVICE_NAME}-swagger.lock`);
const HOT_RELOAD_WINDOW_MS = 10_000;

function isBrowserRunning(): boolean {
  try {
    if (process.platform === 'win32') {
      const out = execSync('tasklist /nh', {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      });
      return /chrome\.exe|msedge\.exe|firefox\.exe|brave\.exe|opera\.exe/i.test(out);
    }
    const out = execSync('ps aux', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
    return /Google Chrome|Safari|firefox|Brave Browser|Chromium/i.test(out);
  } catch {
    return false;
  }
}

function openBrowser(url: string): void {
  if (process.platform === 'win32') {
    exec(`start "" "${url}"`, { windowsHide: true });
  } else if (process.platform === 'darwin') {
    exec(`open "${url}"`);
  } else {
    exec(`xdg-open "${url}"`);
  }
}

function openSwaggerIfBrowserOpen(url: string): void {
  if (fs.existsSync(LOCK_FILE)) {
    try {
      const { timestamp } = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf-8')) as {
        timestamp: number;
      };
      if (Date.now() - timestamp < HOT_RELOAD_WINDOW_MS) return;
    } catch {
      // lock file corrupted — proceed
    }
  }
  if (!isBrowserRunning()) return;
  fs.writeFileSync(LOCK_FILE, JSON.stringify({ timestamp: Date.now() }), 'utf-8');
  openBrowser(url);
}

function cleanupLock(): void {
  try {
    fs.unlinkSync(LOCK_FILE);
  } catch {
    // ignore
  }
}

process.on('SIGTERM', () => {
  cleanupLock();
  process.exit(0);
});

process.on('SIGINT', () => {
  cleanupLock();
  process.exit(0);
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use Winston as the NestJS logger
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Los eventos de orders (carrito, checkout, devoluciones) se consumen ahora desde el
  // exchange topic compartido `eciexpress_events` vía @golevelup (CartModule /
  // SharedBusModule), no por el transporte NestJS-RMQ de cola.

  setupSwagger(app);

  const port = process.env.PORT ?? 3002;
  await app.listen(port);

  openSwaggerIfBrowserOpen(`http://localhost:${port}/api`);
}
bootstrap();
