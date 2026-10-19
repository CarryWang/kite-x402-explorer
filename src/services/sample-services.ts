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
  {
    schema: 1,
    name: 'crypto-whale-alert',
    display_name: 'Real-time Whale Activity & Liquidity Monitor',
    description: 'Track large on-chain token swaps, bridge inflows, and centralized exchange reserve shifts for market prediction.',
    maintainer: {
      github: 'whale-watcher-dao',
      contact: 'alerts@whalewatcher.org',
    },
    status: 'testnet',
    base_url: 'https://whale.sandbox.gokite.ai',
    network: 'eip155:2368',
    pay_to: '0x4444444444444444444444444444444444444444',
    upstream: {
      name: 'Whale Stream Engine',
      url: 'https://api.whalestream.io',
      requires_api_key: false,
    },
    categories: ['finance', 'data'],
    tags: ['whale', 'liquidity', 'dex', 'analytics'],
    source: 'typescript-express',
    endpoints: [
      {
        method: 'GET',
        path: '/v1/transfers/recent',
        summary: 'Query high-value transactions (> $100k) observed in the last 15 minutes across major EVM chains.',
        price_usd: '0.002',
        example_request: {
          query: {
            min_usd: '100000',
            limit: '20',
          },
        },
      },
    ],
  },
  {
    schema: 1,
    name: 'ai-code-auditor',
    display_name: 'Autonomous Code Review & Refactor Agent',
    description: 'Automated static analysis, cyclomatic complexity profiling, and vulnerability patch generator for git diffs.',
    maintainer: {
      github: 'antigravity-labs',
    },
    status: 'live',
    base_url: 'https://codereview.gokite.ai',
    network: 'eip155:2366',
    pay_to: '0x5555555555555555555555555555555555555555',
    upstream: {
      name: 'DeepReview Engine',
      url: 'https://api.deepreview.internal',
      requires_api_key: true,
    },
    categories: ['ai', 'other'],
    tags: ['code-review', 'ast', 'security', 'dev-tool'],
    source: 'custom',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/review/diff',
        summary: 'Submit a unified git diff and receive line-by-line security issues and optimization recommendations.',
        price_usd: '0.005',
        example_request: {
          body: {
            diff: '--- a/contract.sol\n+++ b/contract.sol\n@@ -10,3 +10,4 @@ function transfer() public { ... }',
            language: 'solidity',
          },
        },
      },
    ],
  },
  {
    schema: 1,
    name: 'kite-agent-zk-attestation',
    display_name: 'Agent Zero-Knowledge Attestation & State Proof Relayer',
    description: 'Cryptographic proof verification of off-chain AI reasoning batches, monotonic epoch sequencing, and on-chain state anchoring.',
    maintainer: {
      github: 'Anyi-zheng',
      contact: 'dev@gokite.ai',
    },
    status: 'testnet',
    base_url: 'https://zk-attestation.sandbox.gokite.ai',
    network: 'eip155:2368',
    pay_to: '0x6666666666666666666666666666666666666666',
    upstream: {
      name: 'Snark Recursion Optimizer',
      url: 'https://api.zk-agent.internal',
      requires_api_key: false,
    },
    categories: ['ai', 'data'],
    tags: ['zk-snark', 'groth16', 'attestation', 'agent-state', 'kite-chain'],
    source: 'typescript-express',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/attest/verify',
        summary: 'Submit off-chain batch attestation proof and verify cryptographic Merkle state tree on Kite Testnet.',
        price_usd: '0.002',
        example_request: {
          body: {
            epoch: 128,
            proof_type: 'groth16_bn254',
            public_inputs: ['0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'],
          },
        },
      },
    ],
  },
  {
    schema: 1,
    name: 'kite-agent-telemetry-indexer',
    display_name: 'High-Throughput Telemetry & Multicall Indexer',
    description: 'Autonomous AI agent telemetry indexing and x402 micropayment event streaming with batch Multicall3 aggregation on Kite Chain.',
    maintainer: {
      github: 'untruebattl',
      contact: 'telemetry-indexer@gokite.ai',
    },
    status: 'live',
    base_url: 'https://telemetry.gokite.ai',
    network: 'eip155:2366',
    pay_to: '0x7777777777777777777777777777777777777777',
    upstream: {
      name: 'Kite Telemetry Stream Engine',
      url: 'https://telemetry.internal.gokite.ai',
      requires_api_key: false,
    },
    categories: ['data', 'ai'],
    tags: ['telemetry', 'indexer', 'multicall', 'stream', 'x402'],
    source: 'typescript-express',
    endpoints: [
      {
        method: 'GET',
        path: '/v1/telemetry/stream',
        summary: 'Server-sent event (SSE) stream of verified x402 micropayment settlement events across Kite Chain.',
        price_usd: '0.001',
        example_request: {
          query: {
            filter: 'settled_only',
            limit: '50',
          },
        },
      },
      {
        method: 'POST',
        path: '/v1/telemetry/batch-query',
        summary: 'Multicall batch query payment authorization status, nonce non-replay records, and receipt summaries.',
        price_usd: '0.004',
        example_request: {
          body: {
            chain_id: 2366,
            accounts: [
              '0x2B5AD5c4795c026514f8317c7a215E218DcCD6cF',
              '0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e',
            ],
            include_nonces: true,
          },
        },
      },
    ],
  },
  {
    schema: 1,
    name: 'kite-x402-target-guard',
    display_name: 'Kite x402 Target Guard & Pre-Authorization Auditor',
    description: 'Autonomous pre-signing security gateway, evaluating recipient trust scores, EIP-3009 parameters, and spending caps on Kite chain.',
    maintainer: {
      github: 'tediousnonb',
      contact: 'security@kitedev.org',
    },
    status: 'testnet',
    base_url: 'https://guard.sandbox.gokite.ai',
    network: 'eip155:2368',
    pay_to: '0x8888888888888888888888888888888888888888',
    upstream: {
      name: 'Target Guard Policy Evaluator',
      url: 'https://api.guard-policy.internal',
      requires_api_key: false,
    },
    categories: ['ai', 'finance'],
    tags: ['security', 'guard', 'audit', 'eip-3009', 'x402-firewall'],
    source: 'typescript-express',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/guard/evaluate',
        summary: 'Submit an x402 challenge terms object to get real-time trust scoring and policy pass/fail verdict.',
        price_usd: '0.001',
        example_request: {
          body: {
            payTo: '0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e',
            network: 'eip155:2368',
            amount: '1000000000000000',
          },
        },
      },
      {
        method: 'GET',
        path: '/v1/guard/reputation',
        summary: 'Query on-chain recipient address trust score, dispute history, and risk rating.',
        price_usd: '0.0005',
        example_request: {
          query: {
            address: '0x38129cf4CE5E183eFF248F42A7D345Bb1B47621A',
          },
        },
      },
    ],
  },
  {
    schema: 1,
    name: 'kite-x402-receipt-auditor',
    display_name: 'Kite x402 Receipt Integrity Auditor & Replay Detector',
    description: 'High-assurance cryptographic verification, signature validity auditing, and state invariant validation for Kite agent micropayments.',
    maintainer: {
      github: 'probableacade',
      contact: 'audit@kitedev.org',
    },
    status: 'testnet',
    base_url: 'https://auditor.sandbox.gokite.ai',
    network: 'eip155:2368',
    pay_to: '0x9999999999999999999999999999999999999999',
    upstream: {
      name: 'Receipt Integrity Analyzer Engine',
      url: 'https://api.receipt-auditor.internal',
      requires_api_key: false,
    },
    categories: ['ai', 'data'],
    tags: ['auditor', 'replay-detection', 'receipt-proof', 'kite-chain'],
    source: 'typescript-express',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/receipts/verify',
        summary: 'Cryptographically verify an x402 receipt batch for replay collisions and zero-deduction invariants.',
        price_usd: '0.001',
        example_request: {
          body: {
            receipt_id: 'prf_live_testnet_01',
            network: 'eip155:2368',
          },
        },
      },
    ],
  },
  {
    schema: 1,
    name: 'kite-agent-telemetry-oracle',
    display_name: 'Kite Settlement Latency & Gas Oracle',
    description: 'Real-time sliding-window profiling of EIP-3009 verification latency, Facilitator relay timings, and gas benchmarks across Kite chains.',
    maintainer: {
      github: 'probableacade',
      contact: 'telemetry@kitedev.org',
    },
    status: 'testnet',
    base_url: 'https://telemetry-oracle.sandbox.gokite.ai',
    network: 'eip155:2368',
    pay_to: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    upstream: {
      name: 'Settlement Benchmark Engine',
      url: 'https://api.settlement-bench.internal',
      requires_api_key: false,
    },
    categories: ['data', 'ai'],
    tags: ['telemetry', 'latency-oracle', 'benchmark', 'eip-3009', 'kite-chain'],
    source: 'typescript-express',
    endpoints: [
      {
        method: 'GET',
        path: '/v1/oracle/latencies',
        summary: 'Query median and 95th percentile settlement times for Kite Facilitator endpoints.',
        price_usd: '0.001',
        example_request: {
          query: {
            window: '15m',
            chain_id: '2368',
          },
        },
      },
    ],
  },
  {
    schema: 1,
    name: 'kite-agent-swarm',
    display_name: 'Autonomous Multi-Agent Swarm Orchestrator',
    description: 'Decentralized DAG task orchestrator for multi-agent workflows, state sync, and atomic x402 bounty splits on Kite Chain.',
    maintainer: {
      github: 'aromaticthrif',
      contact: 'swarm-orchestrator@gokite.ai',
    },
    status: 'live',
    base_url: 'https://swarm.gokite.ai',
    network: 'eip155:2366',
    pay_to: '0x6666666666666666666666666666666666666666',
    upstream: {
      name: 'Kite Swarm Engine',
      url: 'https://api.swarm-cluster.internal',
      requires_api_key: false,
    },
    categories: ['ai', 'other'],
    tags: ['swarm', 'dag', 'orchestrator', 'bounty-split', 'x402'],
    source: 'typescript-express',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/swarm/orchestrate',
        summary: 'Decompose and dispatch parallel multi-agent subtasks with dependency graph execution.',
        price_usd: '0.015',
        example_request: {
          body: {
            task_type: 'multi_agent_consensus',
            dag_nodes: 4,
            max_budget_usd: '0.10',
          },
        },
      },
      {
        method: 'POST',
        path: '/v1/swarm/split-bounty',
        summary: 'Compute exact atomic payout splits and receipt hashes for swarm agent participants.',
        price_usd: '0.003',
        example_request: {
          body: {
            total_bounty_wei: '1000000000000000000',
            shares: [
              { agent_id: 'agent_coordinator', basis_points: 4000 },
              { agent_id: 'agent_executor', basis_points: 4000 },
              { agent_id: 'agent_verifier', basis_points: 2000 },
            ],
          },
        },
      },
    ],
  },
  {
    schema: 1,
    name: 'kite-agent-dispute-arbiter',
    display_name: 'Optimistic Dispute Arbiter & Slashing Engine',
    description: 'Decentralized optimistic dispute resolution, challenge window verification, and escrow slashing for autonomous agent payments on Kite Chain.',
    maintainer: {
      github: 'ellipticalisl',
      contact: 'dispute-arbiter@gokite.ai',
    },
    status: 'live',
    base_url: 'https://dispute.gokite.ai',
    network: 'eip155:2366',
    pay_to: '0x8888888888888888888888888888888888888888',
    upstream: {
      name: 'Kite Arbiter Consensus Node',
      url: 'https://arbiter.internal.gokite.ai',
      requires_api_key: false,
    },
    categories: ['finance', 'ai'],
    tags: ['dispute', 'slashing', 'arbiter', 'escrow', 'x402'],
    source: 'typescript-express',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/dispute/challenge',
        summary: 'Submit an optimistic fraud proof challenge against an x402 payment receipt hash with challenge bond.',
        price_usd: '0.02',
        example_request: {
          body: {
            tx_hash: '0x5b38da6a701c568545dcfcb03fcb875f56beddc4',
            reason: 'invalid_output_hash',
            bond_wei: '100000000000000000',
            evidence_uri: 'ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco',
          },
        },
      },
      {
        method: 'GET',
        path: '/v1/dispute/status',
        summary: 'Query active dispute claim status, challenge window countdown, and slash distribution.',
        price_usd: '0.002',
        example_request: {
          query: {
            dispute_id: 'disp_9a4f2e1c',
          },
        },
      },
    ],
  },
  {
    schema: 1,
    name: 'kite-agent-stream-router',
    display_name: 'High-Throughput Stream Router & State Channel Settler',
    description: 'Dynamic low-latency micropayment stream routing and cumulative state channel settlement network for AI agents on Kite Chain.',
    maintainer: {
      github: 'specificpict',
      contact: 'stream-router@gokite.ai',
    },
    status: 'live',
    base_url: 'https://router.gokite.ai',
    network: 'eip155:2366',
    pay_to: '0x9999999999999999999999999999999999999999',
    upstream: {
      name: 'Kite Stream Routing Mesh',
      url: 'https://mesh.internal.gokite.ai',
      requires_api_key: false,
    },
    categories: ['data', 'ai'],
    tags: ['stream', 'router', 'state-channel', 'micropayment', 'x402'],
    source: 'typescript-express',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/router/route-stream',
        summary: 'Dynamically routes continuous agent workloads through the lowest-latency x402 gateway.',
        price_usd: '0.002',
        example_request: {
          body: {
            destination_category: 'ai',
            max_latency_ms: 100,
            stream_protocol: 'sse',
          },
        },
      },
      {
        method: 'POST',
        path: '/v1/router/channel-settle',
        summary: 'Commit cumulative micro-tickets and trigger on-chain EIP-3009 checkpoint settlement.',
        price_usd: '0.005',
        example_request: {
          body: {
            channel_id: 'chan_mesh_99',
            final_nonce: 42,
            total_settled_wei: '50000000000000000',
          },
        },
      },
    ],
  },
  {
    schema: 1,
    name: 'kite-agent-task-escrow',
    display_name: 'Milestone Task Escrow & Release Vault',
    description: 'Autonomous agent task marketplace escrow vault with basis points milestone allocations and verifiable deliverable releases on Kite Chain.',
    maintainer: {
      github: 'cheerfulbay',
      contact: 'task-escrow@gokite.ai',
    },
    status: 'live',
    base_url: 'https://escrow.gokite.ai',
    network: 'eip155:2366',
    pay_to: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    upstream: {
      name: 'Kite Escrow Settlement Engine',
      url: 'https://escrow.internal.gokite.ai',
      requires_api_key: false,
    },
    categories: ['finance', 'ai'],
    tags: ['escrow', 'milestone', 'vault', 'settlement', 'x402'],
    source: 'typescript-express',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/escrow/create-task',
        summary: 'Deposit and initialize a milestone-gated task escrow vault for autonomous agent workers.',
        price_usd: '0.01',
        example_request: {
          body: {
            task_id: 'task_model_tune_88',
            agent_worker: '0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e',
            deposit_wei: '1000000000000000000',
            milestones: [
              { milestone_id: 'm1', percentage_bps: 3000, title: 'Data Extraction' },
              { milestone_id: 'm2', percentage_bps: 4000, title: 'LoRA Fine-tuning' },
              { milestone_id: 'm3', percentage_bps: 3000, title: 'Evaluation Benchmark' },
            ],
          },
        },
      },
      {
        method: 'POST',
        path: '/v1/escrow/release-milestone',
        summary: 'Cryptographically verify deliverable hash and trigger installment release on Kite Chain.',
        price_usd: '0.003',
        example_request: {
          body: {
            task_id: 'task_model_tune_88',
            milestone_id: 'm1',
            deliverable_hash: '0x5b38da6a701c568545dcfcb03fcb875f56beddc4875f56beddc4875f56beddc4',
          },
        },
      },
    ],
  },
  {
    schema: 1,
    name: 'kite-agent-data-escrow',
    display_name: 'AI Dataset Annotation Escrow & Revenue Share',
    description: 'Quality-weighted revenue sharing and milestone escrow verification for crowdsourced AI dataset contributors on Kite Chain.',
    maintainer: {
      github: 'seriousbunch',
      contact: 'data-escrow@gokite.ai',
    },
    status: 'live',
    base_url: 'https://data-escrow.gokite.ai',
    network: 'eip155:2366',
    pay_to: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    upstream: {
      name: 'Kite Dataset Quality Engine',
      url: 'https://quality.internal.gokite.ai',
      requires_api_key: false,
    },
    categories: ['data', 'ai'],
    tags: ['dataset', 'annotation', 'revenue-share', 'escrow', 'x402'],
    source: 'typescript-express',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/dataset/evaluate-batch',
        summary: 'Run automated quality audits and benchmark scores across an AI annotation batch.',
        price_usd: '0.008',
        example_request: {
          body: {
            batch_id: 'batch_synthetic_qa_12',
            sample_size: 500,
            rubric: 'factual_accuracy_v2',
          },
        },
      },
      {
        method: 'POST',
        path: '/v1/dataset/split-revenue',
        summary: 'Compute pro-rata token volume and quality-weighted revenue share matrix for contributors.',
        price_usd: '0.003',
        example_request: {
          body: {
            total_pool_wei: '2000000000000000000',
            contributors: [
              { contributor_address: '0x2B5AD5c4795c026514f8317c7a215E218DcCD6cF', accepted_tokens_count: 15000, quality_score_bps: 9500 },
              { contributor_address: '0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e', accepted_tokens_count: 8000, quality_score_bps: 8200 },
            ],
          },
        },
      },
    ],
  },
  {
    schema: 1,
    name: 'kite-agent-zk-reputation',
    display_name: 'Agent Reputation Credit Prototype',
    description: 'Demonstration credit profile calculator. Requires an external trusted attestation verifier; no ZK proof verification or live settlement is implemented here.',
    maintainer: {
      github: 'dishonesthero',
      contact: 'zk-reputation@gokite.ai',
    },
    status: 'draft',
    base_url: 'https://reputation.gokite.ai',
    network: 'eip155:2366',
    pay_to: '0xcccccccccccccccccccccccccccccccccccccccc',
    upstream: {
      name: 'Kite ZK Attestation Oracle',
      url: 'https://attestation.internal.gokite.ai',
      requires_api_key: false,
    },
    categories: ['ai', 'finance'],
    tags: ['reputation', 'zk-proof', 'credit', 'attestation', 'x402'],
    source: 'typescript-express',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/reputation/verify-proof',
        summary: 'Prototype credit tier calculation after a trusted external verifier accepts an agent attestation.',
        price_usd: '0.005',
        example_request: {
          body: {
            agent_address: '0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e',
            reputation_score: 850,
            nullifier_hash: '0x3a4b5c6d7e8f901234567890abcdef1234567890abcdef1234567890abcdef12',
          },
        },
      },
      {
        method: 'POST',
        path: '/v1/reputation/credit-settle',
        summary: 'Simulate debt repayment in a local credit profile; no on-chain transfer occurs.',
        price_usd: '0.002',
        example_request: {
          body: {
            agent_address: '0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e',
            settled_amount_wei: '1000000000000000000',
          },
        },
      },
    ],
  },
  {
    schema: 1,
    name: 'kite-agent-sla-oracle',
    display_name: 'AI Agent SLA Oracle & Slashing Guard',
    description: 'Decentralized service level agreement monitor tracking agent heartbeats, response latencies, and triggering automated security bond slashing.',
    maintainer: {
      github: 'normalluggage',
      contact: 'sla-oracle@gokite.ai',
    },
    status: 'testnet',
    base_url: 'https://sla.sandbox.gokite.ai',
    network: 'eip155:2368',
    pay_to: '0x8888888888888888888888888888888888888888',
    upstream: {
      name: 'Kite SLA Oracle Consensus Engine',
      url: 'https://sla-engine.internal.gokite.ai',
      requires_api_key: false,
    },
    categories: ['ai', 'data'],
    tags: ['sla', 'oracle', 'slashing', 'uptime', 'x402'],
    source: 'typescript-express',
    endpoints: [
      {
        method: 'POST',
        path: '/v1/sla/heartbeat',
        summary: 'Record cryptographically signed agent telemetry ping including latency, block number, and availability status.',
        price_usd: '0.001',
        example_request: {
          body: {
            agent_address: '0x9999999999999999999999999999999999999999',
            service_id: 'open-meteo-weather',
            latency_ms: 120,
            status_code: 200,
          },
        },
      },
      {
        method: 'POST',
        path: '/v1/sla/claim-slashing',
        summary: 'Claim an automated compensation rebate voucher when an invoked AI service breaches guaranteed SLA targets.',
        price_usd: '0.002',
        example_request: {
          body: {
            caller_address: '0x1234567890123456789012345678901234567890',
            service_id: 'open-meteo-weather',
            breached_metric: 'LATENCY_EXCEEDED',
          },
        },
      },
      {
        method: 'GET',
        path: '/v1/sla/metrics',
        summary: 'Query rolling 24-hour SLA scorecard, uptime percentage, and historical slashing enforcement events.',
        price_usd: '0.0005',
        example_request: {
          query: {
            service_id: 'open-meteo-weather',
            window_hours: '24',
          },
        },
      },
    ],
  },
];

