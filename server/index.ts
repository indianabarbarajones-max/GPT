import { createApp } from './app.ts';

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT deve ser uma porta válida.');
const { app, close } = createApp();
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Studio Flow: servidor local ativo na porta ${port}.`);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { server.close(() => { close(); process.exit(0); }); });
}
