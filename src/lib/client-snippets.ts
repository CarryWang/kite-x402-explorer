import type { ServiceManifest, ServiceEndpoint } from '../types/service.js';
import { KITE_CHAINS } from '../types/kite.js';

interface SnippetContext {
  fullUrl: string;
  queryParams: string;
  isTestnet: boolean;
  tokenSymbol: string;
  chainId: number;
}

/** Values shared by every generated client snippet for one service endpoint. */
export function snippetContext(service: ServiceManifest, endpoint: ServiceEndpoint): SnippetContext {
  const fullUrl = `${service.base_url || 'https://your-host'}${endpoint.path}`;
  const query = new URLSearchParams(endpoint.example_request?.query).toString();
  const queryParams = query ? '?' + query : '';
  const isTestnet = service.network === 'eip155:2368';
  return {
    fullUrl,
    queryParams,
    isTestnet,
    tokenSymbol: isTestnet ? 'pieUSD' : 'USDC.e',
    chainId: isTestnet ? 2368 : 2366,
  };
}

export function buildTsSnippet(service: ServiceManifest, endpoint: ServiceEndpoint): string {
  const { fullUrl, queryParams, chainId } = snippetContext(service, endpoint);
  const { assetAddress, eip712Domain } = KITE_CHAINS[service.network];
  return `import { isAddress, type Address, type LocalAccount } from 'viem';

// Inspect the PAYMENT-REQUIRED header separately from signing.
export function probeService() {
  return fetch(${JSON.stringify(fullUrl + queryParams)}, { method: "${endpoint.method}", redirect: 'error' });
}

// Pass independently approved terms. This helper signs locally and returns the signature.
export async function signAuthorization(
  account: LocalAccount,
  approved: { asset: Address; payTo: Address; amount: bigint },
) {
  if (approved.asset.toLowerCase() !== "${assetAddress.toLowerCase()}" ||
      !isAddress(approved.payTo, { strict: false }) ||
      approved.amount <= 0n || approved.amount >= 2n ** 256n) {
    throw new Error('Invalid approved payment terms');
  }

  const domain = {
    name: "${eip712Domain.name}",
    version: "${eip712Domain.version}",
    chainId: ${chainId},
    verifyingContract: approved.asset,
  };
  const message = {
    from: account.address,
    to: approved.payTo,
    value: approved.amount,
    validAfter: 0n,
    validBefore: BigInt(Math.floor(Date.now() / 1000) + 60),
    nonce: ("0x" + Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, "0")).join("")) as \`0x\${string}\`,
  };
  const signature = await account.signTypedData({
    domain,
    types: {
        TransferWithAuthorization: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' }
        ],
    },
    primaryType: 'TransferWithAuthorization',
    message,
  });
  return { domain, message, signature };
}`;
}

export function buildPythonSnippet(service: ServiceManifest, endpoint: ServiceEndpoint): string {
  const { fullUrl, queryParams, isTestnet, tokenSymbol, chainId } = snippetContext(service, endpoint);
  const { assetAddress, eip712Domain } = KITE_CHAINS[service.network];
  return `import re, time, secrets, requests
from eth_account.messages import encode_typed_data

# Kite ${isTestnet ? 'Testnet' : 'Mainnet'} ${tokenSymbol} Configuration
CHAIN_ID = ${chainId}
URL = ${JSON.stringify(fullUrl + queryParams)}

# Inspect the PAYMENT-REQUIRED header separately from signing.
def probe_service():
    return requests.${endpoint.method.toLowerCase()}(URL, timeout=10, allow_redirects=False)

# Pass independently approved terms. This helper signs locally and returns the signature.
def sign_authorization(account, asset, pay_to, amount):
    if (asset.lower() != "${assetAddress.toLowerCase()}"
            or not re.fullmatch(r"0x[0-9a-fA-F]{40}", pay_to)
            or type(amount) is not int or not 0 < amount < 2**256):
        raise ValueError("Invalid approved payment terms")
    typed_data = {
        "types": {
            "EIP712Domain": [
                {"name": "name", "type": "string"},
                {"name": "version", "type": "string"},
                {"name": "chainId", "type": "uint256"},
                {"name": "verifyingContract", "type": "address"}
            ],
            "TransferWithAuthorization": [
                {"name": "from", "type": "address"},
                {"name": "to", "type": "address"},
                {"name": "value", "type": "uint256"},
                {"name": "validAfter", "type": "uint256"},
                {"name": "validBefore", "type": "uint256"},
                {"name": "nonce", "type": "bytes32"}
            ]
        },
        "primaryType": "TransferWithAuthorization",
        "domain": {
            "name": "${eip712Domain.name}",
            "version": "${eip712Domain.version}",
            "chainId": CHAIN_ID,
            "verifyingContract": asset
        },
        "message": {
            "from": account.address,
            "to": pay_to,
            "value": amount,
            "validAfter": 0,
            "validBefore": int(time.time()) + 60,
            "nonce": "0x" + secrets.token_hex(32)
        }
    }
    return typed_data, account.sign_message(encode_typed_data(full_message=typed_data))`;
}

export function buildGoSnippet(service: ServiceManifest, endpoint: ServiceEndpoint): string {
  const { fullUrl, queryParams, chainId } = snippetContext(service, endpoint);
  return `package main

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"time"
)

// Kite Chain (${chainId}) x402 Micropayment Client in Go
func main() {
	targetURL := ${JSON.stringify(fullUrl + queryParams)}
	client := &http.Client{
		Timeout: 10 * time.Second,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	// 1. Probe endpoint to trigger HTTP 402 challenge
	req, err := http.NewRequest("${endpoint.method}", targetURL, nil)
	if err != nil {
		panic(err)
	}
	req.Header.Set("Accept", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusPaymentRequired {
		rawChallenge := resp.Header.Get("PAYMENT-REQUIRED")
		decoded, err := base64.StdEncoding.DecodeString(rawChallenge)
		if err != nil {
			panic(err)
		}
		fmt.Printf("Received 402 Challenge: %s\\n", string(decoded))
	}
}`;
}

export function buildRustSnippet(service: ServiceManifest, endpoint: ServiceEndpoint): string {
  const { fullUrl, queryParams, chainId } = snippetContext(service, endpoint);
  return `// Kite Chain (${chainId}) x402 challenge discovery in Rust (reqwest)
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use std::time::Duration;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .redirect(reqwest::redirect::Policy::none())
        .build()?;
    let target = ${JSON.stringify(fullUrl + queryParams)};

    // 1. Probe endpoint to discover 402 Payment Required
    let res = client
        .${endpoint.method.toLowerCase()}(target)
        .header(reqwest::header::ACCEPT, "application/json")
        .send()
        .await?;

    if res.status() == reqwest::StatusCode::PAYMENT_REQUIRED {
        if let Some(challenge_header) = res.headers().get("PAYMENT-REQUIRED") {
            let decoded = BASE64.decode(challenge_header.as_bytes())?;
            println!("Challenge parsed: {}", String::from_utf8_lossy(&decoded));
        }
    }

    Ok(())
}`;
}
