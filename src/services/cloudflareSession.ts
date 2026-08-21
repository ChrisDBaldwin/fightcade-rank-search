/**
 * Cloudflare session management.
 *
 * Fightcade's API sits behind a Cloudflare managed challenge. A plain HTTP
 * request gets a 403 "Just a moment..." interstitial, but a request carrying a
 * `cf_clearance` cookie plus the exact User-Agent that earned it is let
 * straight through — no TLS impersonation needed.
 *
 * Earning that cookie requires a *headed* browser. Headless Chrome is detected
 * and re-challenged even when a valid cookie is already in its profile, so the
 * mint step runs real Chrome against a virtual display (Xvfb in the container).
 * The cookie is nominally valid for a year, so this runs rarely.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface Clearance {
  cookie: string;
  userAgent: string;
  mintedAt: string;
}

const CHALLENGE_TITLE = /just a moment/i;
const PROBE_BODY = {
  req: 'searchrankings',
  gameid: 'sfiii3nr1',
  byElo: true,
  recent: false,
  limit: 1,
  offset: 0,
};

export class CloudflareSession {
  private static cached: Clearance | null = null;
  private static mintInFlight: Promise<Clearance> | null = null;

  private static get dataDir(): string {
    return process.env.FC_DATA_DIR || path.join(process.cwd(), 'data');
  }

  private static get clearancePath(): string {
    return path.join(this.dataDir, '.clearance.json');
  }

  private static get profileDir(): string {
    return process.env.FC_BROWSER_PROFILE || path.join(this.dataDir, '.browser-profile');
  }

  /**
   * Headers that get a request past Cloudflare. Only the cookie and a matching
   * User-Agent are actually required — everything else just looks more normal.
   */
  static async headers(): Promise<Record<string, string>> {
    const { cookie, userAgent } = await this.get();
    return {
      'Content-Type': 'application/json',
      'User-Agent': userAgent,
      'Cookie': `cf_clearance=${cookie}`,
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': 'https://www.fightcade.com',
      'Referer': 'https://www.fightcade.com/',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'cors',
      'sec-fetch-dest': 'empty',
    };
  }

  /** Load the stored clearance, minting one if we don't have it yet. */
  static async get(): Promise<Clearance> {
    if (this.cached) return this.cached;

    const stored = this.load();
    if (stored) {
      this.cached = stored;
      return stored;
    }

    return this.mint();
  }

  /**
   * Discard the current clearance and earn a new one. Called when the API
   * starts returning challenges again.
   */
  static async refresh(): Promise<Clearance> {
    this.cached = null;
    try {
      fs.rmSync(this.clearancePath, { force: true });
    } catch {
      /* nothing stored yet */
    }
    return this.mint();
  }

  private static load(): Clearance | null {
    try {
      const raw = fs.readFileSync(this.clearancePath, 'utf-8');
      const parsed = JSON.parse(raw) as Clearance;
      if (parsed.cookie && parsed.userAgent) return parsed;
      return null;
    } catch {
      return null;
    }
  }

  private static save(clearance: Clearance): void {
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.writeFileSync(this.clearancePath, JSON.stringify(clearance, null, 2), { mode: 0o600 });
  }

  /** Drive a real browser through the challenge and keep the cookie it earns. */
  private static async mint(): Promise<Clearance> {
    // Concurrent callers should share one browser launch, not race for it.
    if (this.mintInFlight) return this.mintInFlight;

    this.mintInFlight = this.doMint().finally(() => {
      this.mintInFlight = null;
    });
    return this.mintInFlight;
  }

  private static async doMint(): Promise<Clearance> {
    console.log('🔐 Earning a fresh Cloudflare clearance (launching Chrome)...');

    if (process.platform === 'linux' && !process.env.DISPLAY) {
      throw new Error(
        'No DISPLAY set. Minting needs a headed browser — run this under Xvfb, ' +
        'e.g. `xvfb-run -a npm run refresh-clearance`.'
      );
    }

    // Imported lazily so the web server can run without Playwright resolving.
    const { chromium } = await import('playwright');

    const launchOptions: Record<string, unknown> = {
      headless: false,
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
      args: [
        '--disable-blink-features=AutomationControlled',
        '--window-size=1280,800',
        '--lang=en-US',
        ...(process.platform === 'linux'
          ? [
              '--no-sandbox',
              '--disable-dev-shm-usage',
              // A container has no GPU, and a browser reporting *no* WebGL at
              // all is a strong bot signal. SwiftShader gives a plausible one.
              '--use-gl=angle',
              '--use-angle=swiftshader',
              '--enable-unsafe-swiftshader',
            ]
          : []),
      ],
    };

    // Real Chrome passes the challenge most reliably; the container sets
    // CHROME_PATH because Google ships no Chrome build for Linux/arm64.
    if (process.env.CHROME_PATH) {
      launchOptions.executablePath = process.env.CHROME_PATH;
    } else {
      launchOptions.channel = 'chrome';
    }

    fs.mkdirSync(this.profileDir, { recursive: true });
    const context = await chromium.launchPersistentContext(this.profileDir, launchOptions as never);

    try {
      const page = context.pages()[0] ?? (await context.newPage());

      // The challenge sometimes clears the page but not yet the API path, so
      // the probe below — not the page title — is what we trust.
      for (let attempt = 1; attempt <= 4; attempt++) {
        // Hit /id/ rather than /: the root is edge-cached and sails through
        // without ever issuing a cookie, so it never earns us a clearance.
        await page.goto('https://www.fightcade.com/id/', { waitUntil: 'domcontentloaded' });

        for (let i = 0; i < 30; i++) {
          const title = await page.title().catch(() => '');
          if (title && !CHALLENGE_TITLE.test(title)) break;
          await page.waitForTimeout(1000);
        }

        const passed = await page.evaluate(async (body) => {
          const r = await fetch('/api/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          return r.status === 200;
        }, PROBE_BODY);

        if (passed) {
          const cookies = await context.cookies('https://www.fightcade.com');
          const clearance = cookies.find((c) => c.name === 'cf_clearance');
          if (!clearance?.value) {
            throw new Error('Challenge passed but no cf_clearance cookie was issued.');
          }

          // String form: `navigator` is a page global, not a Node one.
          const userAgent = (await page.evaluate('navigator.userAgent')) as string;
          const result: Clearance = {
            cookie: clearance.value,
            userAgent,
            mintedAt: new Date().toISOString(),
          };

          this.save(result);
          this.cached = result;
          console.log('✅ Cloudflare clearance earned and stored.');
          return result;
        }

        console.log(`⏳ Still challenged (attempt ${attempt}/4), retrying...`);
        await page.waitForTimeout(3000);
      }

      throw new Error('Could not get past the Cloudflare challenge after 4 attempts.');
    } finally {
      await context.close();
    }
  }
}
