import express from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Collection, Entity } from '../shared/types.ts';
import { Store, collections } from './store.ts';
import { object, validateEntity, validateSettings, ValidationError } from './validation.ts';
import { assistant } from './assistant.ts';

interface AppOptions { databasePath?: string; aiApiKey?: string; aiModel?: string }
export function createApp(options: AppOptions = {}) {
  const store = new Store(options.databasePath ?? process.env.DATABASE_PATH ?? resolve('.data/studio.sqlite'));
  const apiKey = (options.aiApiKey ?? process.env.AI_API_KEY ?? '').trim();
  const aiModel = (options.aiModel ?? process.env.AI_MODEL ?? '').trim() || 'gpt-4.1-mini';
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
    // A loopback bind alone does not prevent browser DNS-rebinding attacks.
    try {
      const host = new URL(`http://${req.headers.host ?? ''}`);
      if (!['127.0.0.1', 'localhost', '[::1]'].includes(host.hostname) || host.username || host.password) return res.status(403).json({ error: 'Este protótipo aceita apenas acesso local.' });
    } catch { return res.status(403).json({ error: 'Endereço de acesso inválido.' }); }
    // The prototype is local-only: reject writes from unrelated browser origins.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin) {
      try {
        const origin = new URL(req.headers.origin);
        if (!['http:', 'https:'].includes(origin.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)) return res.status(403).json({ error: 'Origem não autorizada para alterações.' });
      } catch { return res.status(403).json({ error: 'Origem inválida.' }); }
    }
    next();
  });
  app.use(express.json({ limit: '64kb' }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/state', (_req, res) => res.json(store.state(Boolean(apiKey))));
  app.patch('/api/settings', (req, res) => res.json(store.setSettings(validateSettings(req.body, store.settings()))));
  app.post('/api/assistant', async (req, res) => {
    const body = object(req.body);
    if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 2000) throw new ValidationError('Escreva uma mensagem entre 1 e 2.000 caracteres.');
    try { res.json(await assistant(body.message.trim(), store.state(Boolean(apiKey)), apiKey, aiModel)); }
    catch {
      res.status(502).json({ error: 'Não foi possível consultar a IA. Verifique a chave AI_API_KEY, o acesso a api.openai.com e o modelo configurado. Nenhuma ação foi executada.' });
    }
  });
  for (const collection of collections) {
    app.post(`/api/${collection}`, (req, res) => res.status(201).json(store.create(collection, validateEntity(collection, req.body, store))));
    app.patch(`/api/${collection}/:id`, (req, res) => {
      const id = req.params.id;
      const entity = store.get(collection, id);
      if (!entity) return res.status(404).json({ error: 'Registro não encontrado.' });
      const data = validateEntity(collection, req.body, store, entity);
      res.json(store.put(collection, { ...data, id } as unknown as Entity));
    });
    app.delete(`/api/${collection}/:id`, (req, res) => {
      const id = req.params.id;
      if (!store.get(collection, id)) return res.status(404).json({ error: 'Registro não encontrado.' });
      store.delete(collection as Collection, id);
      res.status(204).end();
    });
  }
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
  const dist = resolve('dist');
  if (existsSync(resolve(dist, 'index.html'))) {
    app.use(express.static(dist));
    app.get('/{*path}', (_req, res) => res.sendFile(resolve(dist, 'index.html')));
  }
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof ValidationError) return res.status(400).json({ error: error.message });
    if (error instanceof SyntaxError) return res.status(400).json({ error: 'O corpo da solicitação contém JSON inválido.' });
    if (typeof error === 'object' && error && 'type' in error && error.type === 'entity.too.large') return res.status(413).json({ error: 'A solicitação excedeu o tamanho permitido.' });
    console.error('Falha interna na API:', error instanceof Error ? error.name : 'UnknownError');
    return res.status(500).json({ error: 'Não foi possível concluir a operação. Tente novamente.' });
  });
  return { app, close: () => store.close() };
}
