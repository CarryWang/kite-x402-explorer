import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'online',
    service: 'kite-x402-explorer-proxy',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

// Relay endpoint for testing paid x402 endpoints from browser without CORS restrictions
app.all('/api/proxy', async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    res.status(400).json({ error: 'Missing ?url query parameter' });
    return;
  }

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (req.headers['payment-signature']) {
      headers['PAYMENT-SIGNATURE'] = req.headers['payment-signature'] as string;
    }

    const upstreamRes = await fetch(targetUrl, {
      method: req.method === 'POST' ? 'POST' : 'GET',
      headers,
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined,
    });

    // Mirror payment headers
    const paymentRequiredHeader = upstreamRes.headers.get('payment-required');
    if (paymentRequiredHeader) {
      res.setHeader('payment-required', paymentRequiredHeader);
    }
    const paymentResponseHeader = upstreamRes.headers.get('payment-response');
    if (paymentResponseHeader) {
      res.setHeader('payment-response', paymentResponseHeader);
    }

    const data = await upstreamRes.text();
    res.status(upstreamRes.status).send(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to proxy request', details: String(err) });
  }
});

app.listen(port, () => {
  console.log(`[Kite x402 Proxy] Listening on http://localhost:${port}`);
});
