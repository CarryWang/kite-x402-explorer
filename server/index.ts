import { MAX_PAYMENT_SIGNATURE_BYTES, MAX_REQUEST_BODY_BYTES, requestPublic } from './outbound.js';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { INITIAL_SERVICES } from '../src/services/sample-services.js';
import { parseAndValidateManifest } from '../src/services/manifest-loader.js';
import { buildMockSettlement } from './mock-settlement.js';
import { OfficialRegistry } from './official-registry.js';
import { FACILITATOR_URL, parseServerConfig } from './config.js';
import type { ObservedProbeResult, UnavailableProbeResult } from '../src/types/probe.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const facilitator = FACILITATOR_URL;
const { registrySource, registryCommit, allowedOrigins } = parseServerConfig(process.env);

app.use(cors({
  exposedHeaders: ['PAYMENT-REQUIRED', 'PAYMENT-RESPONSE', 'payment-required', 'payment-response'],
}));
app.use('/api/proxy', (req: Request, res: Response, next: NextFunction) => {
  if (!['GET', 'HEAD', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD, POST');
    res.status(405).json({error: 'Unsupported proxy method'});
    return;
  }
  if (req.method === 'POST' && !req.is('application/json')) {
    res.status(415).json({error: 'Proxy POST requires JSON'});
    return;
  }
  if (req.method !== 'POST' && (req.headers['transfer-encoding'] || Number(req.headers['content-length'] ?? 0) > 0)) {
    res.status(400).json({error: 'Proxy GET and HEAD cannot have a body'});
    return;
  }
  next();
});
app.use(express.json({limit: MAX_REQUEST_BODY_BYTES}));
app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (typeof error === 'object' && error !== null && 'status' in error && error.status === 413) {
    res.status(413).json({error: 'Request body too large'});
    return;
  }
  next(error);
});

const officialRegistry = new OfficialRegistry({commit: registryCommit});
app.use('/api/mock-x402', (_req, res, next) => {
  if (registrySource === 'official') {res.status(409).json({error:'The demo payment simulator is disabled for the official directory'});return;}
  next();
});

// Health status
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'online',
    service: 'kite-x402-explorer-proxy',
    version: '0.2.0',
    timestamp: new Date().toISOString(),
  });
});

// List all registered services
app.get('/api/services', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (registrySource === 'official') {
    const snapshot = await officialRegistry.get();
    res.status(snapshot.registry.commit ? 200 : 503).json({count:snapshot.services.length,...snapshot});
    return;
  }
  res.json({
    count: INITIAL_SERVICES.length,
    services: INITIAL_SERVICES,
    registry: {source: 'demo', commit: null, fetchedAt: null, stale: false},
  });
});

// Validate manifest endpoint
app.post('/api/validate-manifest', (req, res) => {
  const { yaml: rawYaml } = req.body;
  if (!rawYaml || typeof rawYaml !== 'string') {
    res.status(400).json({ valid: false, error: 'Missing "yaml" field in request body' });
    return;
  }
  const result = parseAndValidateManifest(rawYaml);
  res.json(result);
});

// Dedicated health probe endpoint for service monitoring
app.get('/api/probe/:serviceName', async (req: Request, res: Response) => {
  const serviceName = Array.isArray(req.params.serviceName)
    ? req.params.serviceName[0] ?? '' : req.params.serviceName;
  const unavailable = (reason: UnavailableProbeResult['reason']): UnavailableProbeResult => ({
    kind: 'unavailable', source: 'none', serviceName,
    checkedAt: new Date().toISOString(), reason,
  });
  if (registrySource === 'official') {
    res.status(503).json(unavailable('official_disabled')); return;
  }
  const srv = INITIAL_SERVICES.find(service => service.name === serviceName);
  if (!srv?.base_url) { res.status(404).json(unavailable('target_missing')); return; }
  try {
    const [health, supported] = await Promise.all([
      requestPublic(new URL('/healthz', srv.base_url).href, {allowedOrigins}),
      requestPublic(facilitator + '/supported', {allowedOrigins}),
    ]);
    const data = JSON.parse(health.body.toString());
    const capabilities = JSON.parse(supported.body.toString());
    const expectedAsset = srv.network === 'eip155:2368'
      ? '0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A' : '0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e';
    const networkMatched = data.network === srv.network;
    const assetMatched = typeof data.asset === 'string' && data.asset.toLowerCase() === expectedAsset.toLowerCase();
    const facilitatorReachable = supported.status === 200 && Array.isArray(capabilities.kinds) && capabilities.kinds.some(
      (kind: {network?:string; scheme?:string; x402Version?:number}) => kind.network === srv.network && kind.scheme === 'exact' && kind.x402Version === 2);
    const result: ObservedProbeResult = {
      kind:'observed', source:'live', serviceName:srv.name, checkedAt:new Date().toISOString(),
      endpoint:new URL('/healthz',srv.base_url).href, httpStatus:health.status,
      network:typeof data.network === 'string' ? data.network : null,
      asset:typeof data.asset === 'string' ? data.asset : null,
      networkMatched, assetMatched, facilitatorReachable,
    };
    res.status(health.status >= 200 && health.status < 300 ? 200 : 502).json(result);
  } catch {
    res.status(502).json(unavailable('upstream_error'));
  }
});

// Local mock x402 simulator endpoint for end-to-end sandbox testing
app.all(['/api/mock-x402/:serviceName', '/api/mock-x402/:serviceName/*'], (req: Request, res: Response) => {
  const { serviceName } = req.params;
  const srv = INITIAL_SERVICES.find((s) => s.name === serviceName) || INITIAL_SERVICES[0];
  const isTestnet = srv.network === 'eip155:2368';

  // Health checks (/healthz) on x402 services are free and not monetized
  const pathParam = req.params[0] || '';
  if (pathParam === 'healthz' || req.path.endsWith('/healthz')) {
    res.json({
      status: 'ok',
      service: srv.name,
      network: srv.network,
      asset: isTestnet
        ? '0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A'
        : '0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e',
      facilitator: 'https://facilitator.pieverse.io/v2',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const paymentSignature = req.headers['payment-signature'];

  // If no payment signature is supplied, answer with HTTP 402 + PAYMENT-REQUIRED header
  if (!paymentSignature) {
    const challenge = {
      x402Version: 2,
      accepts: [
        {
          scheme: 'exact',
          network: srv.network,
          asset: isTestnet
            ? '0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A'
            : '0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e',
          amount: isTestnet ? '1000000000000000' : '1000',
          payTo: srv.pay_to,
          maxTimeoutSeconds: 60,
          extra: {
            name: isTestnet ? 'pieUSD' : 'Bridged USDC (Kite AI)',
            version: isTestnet ? '1' : '2',
          },
        },
      ],
    };

    const base64Challenge = Buffer.from(JSON.stringify(challenge)).toString('base64');
    res.setHeader('PAYMENT-REQUIRED', base64Challenge);
    res.setHeader('payment-required', base64Challenge);
    res.status(402).json({
      error: 'Payment Required',
      message: `Simulated authorization required for ${srv.display_name}. No on-chain settlement occurs.`,
    });
    return;
  }

  // Local simulator: accept the demo signature without claiming a chain settlement.
  res.status(200).json({
    success: true,
    data: {
      message: `Request fulfilled successfully for ${srv.display_name}!`,
      service: srv.name,
      network: srv.network,
      timestamp: new Date().toISOString(),
      upstream: srv.upstream.name,
    },
    settlement: buildMockSettlement(),
  });
});

// Full CORS Proxy Relay endpoint for real external targets
app.all('/api/proxy', async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    res.status(400).json({ error: 'Missing ?url query parameter' });
    return;
  }

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    const sig = req.headers['payment-signature'];
    if (sig) {
      if (Array.isArray(sig) || Buffer.byteLength(sig, 'utf8') > MAX_PAYMENT_SIGNATURE_BYTES) {
        res.status(400).json({error: 'Invalid payment signature header'});
        return;
      }
      headers['PAYMENT-SIGNATURE'] = sig;
    }

    const hasBody = !['GET', 'HEAD'].includes(req.method);
    const upstream = await requestPublic(targetUrl, {allowedOrigins, method:req.method,
      headers:{...headers, ...(hasBody ? {'Content-Type':'application/json'} : {})},
      ...(hasBody ? {body:JSON.stringify(req.body)} : {})});
    for (const [name,value] of Object.entries(upstream.headers)) res.setHeader(name,value);
    res.status(upstream.status).send(upstream.body);
  } catch (err) {
    res.status(502).json({ error: 'Failed to proxy request', details: err instanceof Error ? err.message : 'Outbound request failed' });
  }
});

// Production static file serving
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../dist');

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req: Request, res: Response, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(port, () => {
  console.log(`[Kite x402 Proxy & Simulator] Listening on http://localhost:${port}`);
});
