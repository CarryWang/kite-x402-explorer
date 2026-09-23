import express, { type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { INITIAL_SERVICES } from '../src/services/sample-services.js';
import { parseAndValidateManifest } from '../src/services/manifest-loader.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(cors({
  exposedHeaders: ['PAYMENT-REQUIRED', 'PAYMENT-RESPONSE', 'payment-required', 'payment-response'],
}));
app.use(express.json());

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
app.get('/api/services', (_req, res) => {
  res.json({
    count: INITIAL_SERVICES.length,
    services: INITIAL_SERVICES,
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

// Local mock x402 simulator endpoint for end-to-end sandbox testing
app.all('/api/mock-x402/:serviceName/*path', (req: Request, res: Response) => {
  const { serviceName } = req.params;
  const srv = INITIAL_SERVICES.find((s) => s.name === serviceName) || INITIAL_SERVICES[0];
  const isTestnet = srv.network === 'eip155:2368';

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
      message: `Authorization required for ${srv.display_name}. Settle on Kite chain.`,
    });
    return;
  }

  // Payment signature is present! Simulate Facilitator verification and settlement
  const mockTxHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const paymentResponse = {
    txHash: mockTxHash,
    settled: true,
    blockNumber: Math.floor(Date.now() / 2000),
  };
  const base64Response = Buffer.from(JSON.stringify(paymentResponse)).toString('base64');

  res.setHeader('PAYMENT-RESPONSE', base64Response);
  res.setHeader('payment-response', base64Response);
  res.status(200).json({
    success: true,
    data: {
      message: `Request fulfilled successfully for ${srv.display_name}!`,
      service: srv.name,
      network: srv.network,
      timestamp: new Date().toISOString(),
      upstream: srv.upstream.name,
    },
    settlement: {
      facilitator: 'https://facilitator.pieverse.io/v2',
      txHash: mockTxHash,
      settledOnChain: true,
    },
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
      headers['PAYMENT-SIGNATURE'] = Array.isArray(sig) ? sig[0] : sig;
    }

    const hasBody = !['GET', 'HEAD'].includes(req.method);
    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: hasBody ? JSON.stringify(req.body) : undefined,
    });

    // Mirror payment headers
    const reqHeader = upstreamRes.headers.get('payment-required');
    if (reqHeader) {
      res.setHeader('PAYMENT-REQUIRED', reqHeader);
      res.setHeader('payment-required', reqHeader);
    }
    const resHeader = upstreamRes.headers.get('payment-response');
    if (resHeader) {
      res.setHeader('PAYMENT-RESPONSE', resHeader);
      res.setHeader('payment-response', resHeader);
    }

    const data = await upstreamRes.text();
    res.status(upstreamRes.status);
    res.setHeader('Content-Type', upstreamRes.headers.get('content-type') || 'application/json');
    res.send(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to proxy request', details: String(err) });
  }
});

app.listen(port, () => {
  console.log(`[Kite x402 Proxy & Simulator] Listening on http://localhost:${port}`);
});
