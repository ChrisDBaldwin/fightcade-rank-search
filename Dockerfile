# ---------------------------------------------------------------------------
# Shared build stage: install deps and compile TypeScript once.
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS build

WORKDIR /app

# We use the system Chrome/Chromium installed below, not Playwright's download.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --production

# ---------------------------------------------------------------------------
# Web stage: serves the site. No browser needed — it only reads cached JSON.
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS web

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/public ./public

RUN useradd -r -u 1001 -m fcuser && mkdir -p /app/data && chown -R fcuser:fcuser /app
USER fcuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["npm", "start"]

# ---------------------------------------------------------------------------
# Updater stage: runs the daily fetch. Needs a real, headed browser to earn the
# Cloudflare clearance, so it ships Chrome plus Xvfb for a virtual display.
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS updater

WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg xvfb fonts-liberation fonts-dejavu-core fonts-noto-color-emoji \
    && apt-get clean \
    && find /var/lib/apt/lists -mindepth 1 -delete

# Google ships Chrome for amd64 only; on arm64 we fall back to Debian's
# chromium, which clears the same challenge. CHROME_PATH points at whichever
# one landed so the app doesn't have to care which it got.
RUN set -eux; \
    arch="$(dpkg --print-architecture)"; \
    if [ "$arch" = "amd64" ]; then \
      curl -fsSL https://dl.google.com/linux/linux_signing_key.pub \
        | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg; \
      echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] https://dl.google.com/linux/chrome/deb/ stable main" \
        > /etc/apt/sources.list.d/google-chrome.list; \
      apt-get update; \
      apt-get install -y --no-install-recommends google-chrome-stable; \
      ln -sf /opt/google/chrome/chrome /usr/local/bin/fc-chrome; \
    else \
      apt-get update; \
      apt-get install -y --no-install-recommends chromium; \
      ln -sf /usr/bin/chromium /usr/local/bin/fc-chrome; \
    fi; \
    apt-get clean; \
    find /var/lib/apt/lists -mindepth 1 -delete

ENV CHROME_PATH=/usr/local/bin/fc-chrome
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && mkdir -p /tmp/.X11-unix && chmod 1777 /tmp/.X11-unix \
    && useradd -r -u 1001 -m fcuser \
    && mkdir -p /app/data && chown -R fcuser:fcuser /app
USER fcuser

# The entrypoint supplies a virtual display: Chrome has to run headed, because
# headless gets detected and re-challenged even with a valid cookie in hand.
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/scripts/scheduler.js"]
