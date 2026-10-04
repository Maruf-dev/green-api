/**
 * Запускает одновременно прокси Telegram Bot API (server.mjs) и Vite-дев-сервер.
 * Оба процесса пишут вывод в общий терминал; при остановке одного завершается второй.
 *
 * Запуск: npm run dev:all
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const children = [];
let shuttingDown = false;

function run(label, args) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  children.push(child);

  child.on('exit', (code) => {
    if (shuttingDown) return;
    shuttingDown = true;
    shutdown();
    process.exit(code ?? 0);
  });

  child.on('error', (err) => {
    console.error(`[${label}] не удалось запустить процесс:`, err.message);
  });
}

function shutdown() {
  for (const child of children) {
    try {
      if (!child.killed) child.kill();
    } catch {
      /* ignore */
    }
  }
}

process.on('SIGINT', () => {
  shuttingDown = true;
  shutdown();
  process.exit(0);
});
process.on('SIGTERM', () => {
  shuttingDown = true;
  shutdown();
  process.exit(0);
});

console.log('Запуск прокси Telegram API и Vite...');
run('server', [path.join(root, 'server.mjs')]);
run('vite', [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')]);
