/**
local server for telegram bot api
 */
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const DIST_DIR = path.join(__dirname, 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function sendJson(res, status, payload) {
  if (res.writableEnded) return;
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...corsHeaders(),
  });
  res.end(body);
}

/** Читает и разбирает JSON-тело запроса. */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1000000) {
        reject(new Error('Тело запроса слишком большое'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Некорректный JSON в запросе'));
      }
    });
    req.on('error', reject);
  });
}

/** Выполняет POST-запрос к методу Telegram Bot API и возвращает разобранный ответ. */
function telegramRequest(token, method, params, signal) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(params || {});
    const request = https.request(
      {
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${token}/${method}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (response) => {
        let raw = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          raw += chunk;
        });
        response.on('end', () => {
          try {
            resolve({ status: response.statusCode, data: raw ? JSON.parse(raw) : {} });
          } catch {
            resolve({
              status: response.statusCode,
              data: { ok: false, description: raw || 'Некорректный ответ Telegram' },
            });
          }
        });
      },
    );

    request.on('error', (err) => reject(err));

    if (signal) {
      const onAbort = () => request.destroy(new Error('aborted'));
      signal.addEventListener('abort', onAbort, { once: true });
      request.on('close', () => signal.removeEventListener('abort', onAbort));
    }

    request.write(body);
    request.end();
  });
}

/** Соответствие HTTP-эндпоинтов прокси и методов Telegram Bot API. */
const ROUTES = {
  '/api/me': () => ({ method: 'getMe', params: {} }),
  '/api/updates': (p) => ({
    method: 'getUpdates',
    params: { offset: p.offset, timeout: p.timeout, allowed_updates: ['message'] },
  }),
  '/api/send': (p) => ({ method: 'sendMessage', params: { chat_id: p.chatId, text: p.text } }),
  '/api/chat': (p) => ({ method: 'getChat', params: { chat_id: p.chatId } }),
};

async function handleApi(req, res, pathname) {
  const route = ROUTES[pathname];
  if (!route) {
    sendJson(res, 404, { ok: false, description: `Неизвестный метод API: ${pathname}` });
    return;
  }

  let payload;
  try {
    payload = await readBody(req);
  } catch (err) {
    sendJson(res, 400, { ok: false, description: err.message });
    return;
  }

  const token = typeof payload.token === 'string' ? payload.token.trim() : '';
  if (!token) {
    sendJson(res, 400, { ok: false, description: 'Не указан токен бота' });
    return;
  }

  const { method, params } = route(payload);
  Object.keys(params).forEach((key) => {
    if (params[key] === undefined) delete params[key];
  });

  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    const { data } = await telegramRequest(token, method, params, controller.signal);
    sendJson(res, 200, data ?? { ok: false, description: 'Пустой ответ Telegram' });
  } catch (err) {
    if (res.writableEnded) return; // клиент уже закрыл соединение
    sendJson(res, 502, {
      ok: false,
      description: `Не удалось обратиться к Telegram: ${err.message}`,
    });
  }
}

function sendFile(res, filePath) {
  const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Не удалось прочитать файл сборки');
      return;
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': data.length });
    res.end(data);
  });
}

/** Отдаёт собранный фронтенд из dist/ с SPA-фолбэком на index.html. */
function serveStatic(res, pathname) {
  const rel = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);
  const filePath = path.normalize(path.join(DIST_DIR, rel));
  const inDist = filePath === DIST_DIR || filePath.startsWith(DIST_DIR + path.sep);

  if (!inDist) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      sendFile(res, filePath);
      return;
    }
    const indexFile = path.join(DIST_DIR, 'index.html');
    fs.stat(indexFile, (err2, stats2) => {
      if (err2 || !stats2.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders() });
        res.end('Сборка не найдена. Сначала выполните `npm run build`.');
        return;
      }
      sendFile(res, indexFile);
    });
  });
}

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  if (pathname === '/api/health') {
    sendJson(res, 200, { ok: true, service: 'telegram-bot-api-proxy' });
    return;
  }

  if (pathname.startsWith('/api/')) {
    handleApi(req, res, pathname);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { ok: false, description: 'Метод не поддерживается' });
    return;
  }

  serveStatic(res, pathname);
});

server.listen(PORT, () => {
  console.log(`Telegram Bot API proxy: http://127.0.0.1:${PORT}/api`);
});
