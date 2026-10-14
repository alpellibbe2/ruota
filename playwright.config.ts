import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  workers: 1,
  use: {
    baseURL: 'http://localhost:4173/',
    viewport: { width: 1920, height: 1080 },
    launchOptions: { args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] },
  },
  webServer: [
    { command: 'npm run build && npm run preview', url: 'http://localhost:4173/', reuseExistingServer: true, timeout: 120_000 },
    // local PeerJS signalling server so the tests do not depend on the public one
    { command: 'npx peerjs --port 9000 --path /', url: 'http://localhost:9000/', reuseExistingServer: true, timeout: 30_000 },
  ],
});
