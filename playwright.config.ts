import { createServer } from 'node:net';
import { defineConfig } from '@playwright/test';

/**
 * Tests de bout en bout (`npm run e2e`) : Playwright sert le build (`vite preview`) sur un port libre
 * choisi au lancement (jamais 5199, réservé au serveur de dev), puis l'arrête à la fin.
 */
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

// La config est relue par chaque worker : le port choisi par le processus principal leur est transmis
// par l'environnement.
let port = Number(process.env.E2E_PORT);
if (!port || port === 5199) {
  do port = await freePort();
  while (port === 5199);
  process.env.E2E_PORT = String(port);
}
const baseURL = `http://127.0.0.1:${port}/`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    browserName: 'chromium',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1,
    locale: 'fr-FR',
  },
  webServer: {
    command: `npx vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
