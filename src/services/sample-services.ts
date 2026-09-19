import type { ServiceManifest } from '../types/service.js';

export const INITIAL_SERVICES: ServiceManifest[] = [
  {
    schema: 1,
    name: 'open-meteo-weather',
    display_name: 'Open-Meteo Weather Forecast',
    description: 'High-resolution global weather forecasts and historical observations tailored for autonomous agent decision-making.',
    maintainer: {
      github: 'gokite-ai',
      contact: 'dev@gokite.ai',
    },
    status: 'testnet',
    base_url: 'https://weather.sandbox.gokite.ai',
    network: 'eip155:2368',
    pay_to: '0x1111111111111111111111111111111111111111',
    upstream: {
      name: 'Open-Meteo API',
      url: 'https://api.open-meteo.com',
      requires_api_key: false,
      terms_url: 'https://open-meteo.com/en/terms',
    },
    categories: ['weather', 'data'],
    tags: ['weather', 'forecast', 'climate', 'agent-travel'],
    source: 'typescript-express',
    endpoints: [
      {
        method: 'GET',
        path: '/v1/forecast',
        summary: 'Query current temperature, precipitation, and multi-day hourly forecast by latitude/longitude coordinates.',
        price_usd: '0.001',
        example_request: {
          query: {
            latitude: '52.52',
            longitude: '13.41',
            current: 'temperature_2m,weather_code',
          },
        },
        pitfalls: ['Coordinates must be decimal degrees between -90 and 90 / -180 and 180.'],
      },
      {
        method: 'GET',
        path: '/v1/elevation',
        summary: 'Retrieve terrain elevation in meters for geographic coordinates.',
        price_usd: '0.0005',
        example_request: {
          query: {
            latitude: '37.7749',
            longitude: '-122.4194',
          },
        },
      },
    ],
  },
  {
    schema: 1,
    name: 'kite-agent-websearch',
    display_name: 'Agent Web Search & Scrape Engine',
    description: 'Real-time clean Markdown web scraping, SERP queries, and semantic text extraction for LLM RAG pipelines.',
    maintainer: {
      github: 'agent-matrix',
      contact: 'hello@agentmatrix.xyz',
    },
    status: 'testnet',
    base_url: 'https://search.sandbox.gokite.ai',
    network: 'eip155:2368',
    pay_to: '0x2222222222222222222222222222222222222222',
    upstream: {
      name: 'Tavily Agent API',
      url: 'https://api.tavily.com',
      requires_api_key: true,
    },
    categories: ['search', 'ai', 'web'],
    tags: ['search', 'crawler', 'rag', 'llm-tool'],
    source: 'custom',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/search',
        summary: 'Conduct autonomous web search and return structured snippets and citation URLs for agent synthesis.',
        price_usd: '0.003',
        example_request: {
          body: {
            query: 'Latest developments in ERC-4337 and agent account abstraction',
            max_results: 5,
          },
        },
      },
    ],
  },
  {
    schema: 1,
    name: 'evm-security-scan',
    display_name: 'EVM Contract Security & Threat Oracle',
    description: 'Instant bytecode vulnerability detection, reentrancy scanning, and phishing token analysis for DeFi safety.',
    maintainer: {
      github: 'cyber-sentinel',
    },
    status: 'live',
    base_url: 'https://security.gokite.ai',
    network: 'eip155:2366',
    pay_to: '0x3333333333333333333333333333333333333333',
    upstream: {
      name: 'Sentinel Bytecode Scanner',
      url: 'https://api.sentinel-audit.internal',
    },
    categories: ['finance', 'ai'],
    tags: ['security', 'audit', 'evm', 'defi'],
    source: 'go-gin',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/audit/contract',
        summary: 'Scan an EVM contract address or raw bytecode for known exploits and high-risk honeypot traits.',
        price_usd: '0.01',
        example_request: {
          body: {
            chain_id: 2366,
            address: '0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e',
          },
        },
      },
    ],
  },
];
