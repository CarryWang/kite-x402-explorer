import type { ServiceManifest, ServiceEndpoint } from '../types/service.js';

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
  const queryParams = endpoint.example_request?.query
    ? '?' + new URLSearchParams(endpoint.example_request.query).toString()
    : '';
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
  const { fullUrl, queryParams, isTestnet, chainId } = snippetContext(service, endpoint);
  return `import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// 1. Configure the Kite account
const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as \`0x\${string}\`);

// 2. Fetch with automatic x402 payment retry
async function callKiteService() {
  const target = "${fullUrl}${queryParams}";

  // Probe initial 402
  const probe = await fetch(target, { method: "${endpoint.method}" });
  if (probe.status === 402) {
    const challenge = JSON.parse(atob(probe.headers.get("PAYMENT-REQUIRED")!));
    const accept = challenge.accepts[0];

    // EIP-712 domain of the payment token (accept.asset), not of the merchant (accept.payTo)
    const domain = {
      name: "${isTestnet ? 'pieUSD' : 'Bridged USDC (Kite AI)'}",
      version: "${isTestnet ? '1' : '2'}",
      chainId: ${chainId},
      verifyingContract: accept.asset as \`0x\${string}\`,
    };

    // Sign EIP-3009 TransferWithAuthorization
    const sig = await account.signTypedData({
      domain,
      types: {
        TransferWithAuthorization: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' }
        ]
      },
      primaryType: 'TransferWithAuthorization',
      message: {
        from: account.address,
        to: accept.payTo,
        value: BigInt(accept.amount),
        validAfter: 0n,
        validBefore: BigInt(Math.floor(Date.now() / 1000) + 3600),
        nonce: ("0x" + Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, "0")).join("")) as \`0x\${string}\`,
      }
    });

    // Re-dispatch with payment header
    const paidRes = await fetch(target, {
      method: "${endpoint.method}",
      headers: {
        "Accept": "application/json",
        "PAYMENT-SIGNATURE": btoa(JSON.stringify({ x402Version: 2, scheme: "exact", network: "${service.network}", sig }))
      }
    });
    return await paidRes.json();
  }
  return await probe.json();
}`;
}

export function buildPythonSnippet(service: ServiceManifest, endpoint: ServiceEndpoint): string {
  const { fullUrl, queryParams, isTestnet, tokenSymbol, chainId } = snippetContext(service, endpoint);
  return `import os, time, secrets, base64, json, requests
from eth_account import Account
from eth_account.messages import encode_typed_data

# Kite ${isTestnet ? 'Testnet' : 'Mainnet'} ${tokenSymbol} Configuration
CHAIN_ID = ${chainId}
ACCOUNT = Account.from_key(os.getenv("AGENT_PRIVATE_KEY"))

url = "${fullUrl}${queryParams}"

# 1. Trigger initial 402
res = requests.${endpoint.method.toLowerCase()}(url, headers={"Accept": "application/json"})
if res.status_code == 402:
    challenge = json.loads(base64.b64decode(res.headers.get("PAYMENT-REQUIRED")))
    accept = challenge["accepts"][0]

    # 2. Sign EIP-3009 TransferWithAuthorization
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
            "name": "${isTestnet ? 'pieUSD' : 'Bridged USDC (Kite AI)'}",
            "version": "${isTestnet ? '1' : '2'}",
            "chainId": CHAIN_ID,
            "verifyingContract": accept["asset"]
        },
        "message": {
            "from": ACCOUNT.address,
            "to": accept["payTo"],
            "value": int(accept["amount"]),
            "validAfter": 0,
            "validBefore": int(time.time()) + 3600,
            "nonce": "0x" + secrets.token_hex(32)
        }
    }
    signed = ACCOUNT.sign_message(encode_typed_data(full_message=typed_data))

    # 3. Re-dispatch paid request
    pay_header = base64.b64encode(json.dumps({"x402Version": 2, "signature": signed.signature.hex()}).encode()).decode()
    paid_res = requests.${endpoint.method.toLowerCase()}(url, headers={"Accept": "application/json", "PAYMENT-SIGNATURE": pay_header})
    print("Settled! Status:", paid_res.status_code, paid_res.json())`;
}

export function buildGoSnippet(service: ServiceManifest, endpoint: ServiceEndpoint): string {
  const { fullUrl, queryParams, chainId } = snippetContext(service, endpoint);
  return `package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

// Kite Chain (${chainId}) x402 Micropayment Client in Go
func main() {
	targetURL := "${fullUrl}${queryParams}"
	client := &http.Client{}

	// 1. Probe endpoint to trigger HTTP 402 challenge
	req, _ := http.NewRequest("${endpoint.method}", targetURL, nil)
	req.Header.Set("Accept", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusPaymentRequired {
		rawChallenge := resp.Header.Get("PAYMENT-REQUIRED")
		decoded, _ := base64.StdEncoding.DecodeString(rawChallenge)
		fmt.Printf("Received 402 Challenge: %s\\n", string(decoded))

		// 2. Sign EIP-3009 TransferWithAuthorization using go-ethereum / crypto
		// and encode into PAYMENT-SIGNATURE base64 header
		paymentSigPayload := map[string]interface{}{
			"x402Version": 2,
			"scheme":      "exact",
			"network":     "${service.network}",
			"signer":      os.Getenv("AGENT_ADDRESS"),
		}
		sigBytes, _ := json.Marshal(paymentSigPayload)
		authHeader := base64.StdEncoding.EncodeToString(sigBytes)

		// 3. Re-dispatch request with PAYMENT-SIGNATURE
		paidReq, _ := http.NewRequest("${endpoint.method}", targetURL, nil)
		paidReq.Header.Set("Accept", "application/json")
		paidReq.Header.Set("PAYMENT-SIGNATURE", authHeader)

		paidResp, err := client.Do(paidReq)
		if err != nil {
			panic(err)
		}
		defer paidResp.Body.Close()

		body, _ := io.ReadAll(paidResp.Body)
		fmt.Printf("Settled! Status: %d, Response: %s\\n", paidResp.StatusCode, string(body))
	}
}`;
}

export function buildRustSnippet(service: ServiceManifest, endpoint: ServiceEndpoint): string {
  const { fullUrl, queryParams, chainId } = snippetContext(service, endpoint);
  return `// Kite Chain (${chainId}) x402 Micropayment Client in Rust (reqwest + alloy)
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT};
use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let target = "${fullUrl}${queryParams}";

    // 1. Probe endpoint to discover 402 Payment Required
    let mut headers = HeaderMap::new();
    headers.insert(ACCEPT, HeaderValue::from_static("application/json"));

    let res = client
        .${endpoint.method.toLowerCase()}(target)
        .headers(headers.clone())
        .send()
        .await?;

    if res.status() == reqwest::StatusCode::PAYMENT_REQUIRED {
        if let Some(challenge_header) = res.headers().get("PAYMENT-REQUIRED") {
            let decoded = BASE64.decode(challenge_header.as_bytes())?;
            println!("Challenge parsed: {}", String::from_utf8_lossy(&decoded));
        }

        // 2. Sign EIP-3009 with Alloy / Ethers wallet and encode PAYMENT-SIGNATURE
        let auth_payload = json!({
            "x402Version": 2,
            "scheme": "exact",
            "network": "${service.network}",
        });
        let sig_b64 = BASE64.encode(auth_payload.to_string());

        headers.insert("PAYMENT-SIGNATURE", HeaderValue::from_str(&sig_b64)?);

        // 3. Dispatch paid request to Facilitator & upstream
        let paid_res = client
            .${endpoint.method.toLowerCase()}(target)
            .headers(headers)
            .send()
            .await?;

        println!("Settled with status: {}", paid_res.status());
        let body = paid_res.text().await?;
        println!("Response: {}", body);
    }

    Ok(())
}`;
}
