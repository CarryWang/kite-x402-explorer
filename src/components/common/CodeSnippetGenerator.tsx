import React, { useState } from 'react';
import type { ServiceManifest, ServiceEndpoint } from '../../types/service.js';
import { Copy, Check, Terminal, FileCode, Bot } from 'lucide-react';

interface CodeSnippetGeneratorProps {
  service: ServiceManifest;
  endpoint: ServiceEndpoint;
}

type LangTab = 'curl' | 'ts' | 'python' | 'go' | 'rust' | 'agent';

export const CodeSnippetGenerator: React.FC<CodeSnippetGeneratorProps> = ({
  service,
  endpoint,
}) => {
  const [activeTab, setActiveTab] = useState<LangTab>('curl');
  const [copied, setCopied] = useState(false);

  const fullUrl = `${service.base_url || 'https://your-host'}${endpoint.path}`;
  const queryParams = endpoint.example_request?.query
    ? '?' + new URLSearchParams(endpoint.example_request.query).toString()
    : '';
  const isTestnet = service.network === 'eip155:2368';
  const tokenSymbol = isTestnet ? 'pieUSD' : 'USDC.e';
  const chainId = isTestnet ? 2368 : 2366;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getCurlCode = () => {
    const bodyFlag =
      endpoint.method !== 'GET' && endpoint.example_request?.body
        ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(endpoint.example_request.body)}'`
        : '';

    return `# 1. Step 1: Probe endpoint to trigger 402 Challenge
curl -i -X ${endpoint.method} "${fullUrl}${queryParams}" \\
  -H "Accept: application/json"${bodyFlag}

# 2. Step 2: Sign EIP-3009 Authorization and send with PAYMENT-SIGNATURE
curl -i -X ${endpoint.method} "${fullUrl}${queryParams}" \\
  -H "Accept: application/json" \\
  -H "PAYMENT-SIGNATURE: <base64-encoded-eip3009-authorization>"${bodyFlag}`;
  };

  const getTsCode = () => {
    return `import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// 1. Configure Kite Account & EIP-712 Domain
const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as \`0x\${string}\`);
const domain = {
  name: "${isTestnet ? 'pieUSD' : 'Bridged USDC (Kite AI)'}",
  version: "${isTestnet ? '1' : '2'}",
  chainId: ${chainId},
  verifyingContract: "${service.pay_to}" as const,
};

// 2. Fetch with automatic x402 payment retry
async function callKiteService() {
  const target = "${fullUrl}${queryParams}";
  
  // Probe initial 402
  const probe = await fetch(target, { method: "${endpoint.method}" });
  if (probe.status === 402) {
    const challenge = JSON.parse(atob(probe.headers.get("PAYMENT-REQUIRED")!));
    const accept = challenge.accepts[0];
    
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
          { name: 'nonce', type: 'bytes32' },
          { name: 'v', type: 'uint8' },
          { name: 'r', type: 'bytes32' },
          { name: 's', type: 'bytes32' }
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
  };

  const getPythonCode = () => {
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
            "verifyingContract": accept["payTo"]
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
  };

  const getGoCode = () => {
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
  };

  const getRustCode = () => {
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
  };

  const getAgentToolCode = () => {
    return `// LangChain / OpenAI Agent Tool definition for Kite x402 API
export const kite${service.name.replace(/[^a-zA-Z0-9]/g, '')}Tool = {
  name: "${service.name.replace(/-/g, '_')}",
  description: "${service.description.replace(/"/g, "'")}. Costs $${endpoint.price_usd} (${tokenSymbol}) settled on Kite chain.",
  parameters: {
    type: "object",
    properties: {
      ${endpoint.example_request?.query ? Object.keys(endpoint.example_request.query).map(k => `${k}: { type: "string", description: "${k} parameter" }`).join(',\n      ') : 'query: { type: "string" }'}
    }
  },
  execute: async (args: Record<string, string>) => {
    // Passes through autonomous agent wallet with x402 auto-payment
    return await callKiteServiceWithAutoPayment("${fullUrl}", args);
  }
};`;
  };

  const getActiveCode = () => {
    switch (activeTab) {
      case 'curl':
        return getCurlCode();
      case 'ts':
        return getTsCode();
      case 'python':
        return getPythonCode();
      case 'go':
        return getGoCode();
      case 'rust':
        return getRustCode();
      case 'agent':
        return getAgentToolCode();
    }
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      {/* Tab Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button
            onClick={() => setActiveTab('curl')}
            style={{
              padding: '3px 10px',
              fontSize: '0.75rem',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'curl' ? 'var(--bg-tertiary)' : 'transparent',
              color: activeTab === 'curl' ? 'var(--accent-cyan)' : 'var(--text-muted)',
              fontWeight: activeTab === 'curl' ? 600 : 400,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Terminal size={12} /> cURL
          </button>
          <button
            onClick={() => setActiveTab('ts')}
            style={{
              padding: '3px 10px',
              fontSize: '0.75rem',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'ts' ? 'var(--bg-tertiary)' : 'transparent',
              color: activeTab === 'ts' ? 'var(--accent-cyan)' : 'var(--text-muted)',
              fontWeight: activeTab === 'ts' ? 600 : 400,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <FileCode size={12} /> TypeScript
          </button>
          <button
            onClick={() => setActiveTab('python')}
            style={{
              padding: '3px 10px',
              fontSize: '0.75rem',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'python' ? 'var(--bg-tertiary)' : 'transparent',
              color: activeTab === 'python' ? 'var(--accent-cyan)' : 'var(--text-muted)',
              fontWeight: activeTab === 'python' ? 600 : 400,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <FileCode size={12} /> Python
          </button>
          <button
            onClick={() => setActiveTab('go')}
            style={{
              padding: '3px 10px',
              fontSize: '0.75rem',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'go' ? 'var(--bg-tertiary)' : 'transparent',
              color: activeTab === 'go' ? 'var(--accent-cyan)' : 'var(--text-muted)',
              fontWeight: activeTab === 'go' ? 600 : 400,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <FileCode size={12} /> Go
          </button>
          <button
            onClick={() => setActiveTab('rust')}
            style={{
              padding: '3px 10px',
              fontSize: '0.75rem',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'rust' ? 'var(--bg-tertiary)' : 'transparent',
              color: activeTab === 'rust' ? 'var(--accent-cyan)' : 'var(--text-muted)',
              fontWeight: activeTab === 'rust' ? 600 : 400,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <FileCode size={12} /> Rust
          </button>
          <button
            onClick={() => setActiveTab('agent')}
            style={{
              padding: '3px 10px',
              fontSize: '0.75rem',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'agent' ? 'rgba(121, 40, 202, 0.2)' : 'transparent',
              color: activeTab === 'agent' ? '#c084fc' : 'var(--text-muted)',
              fontWeight: activeTab === 'agent' ? 600 : 400,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Bot size={12} /> Agent Tool
          </button>
        </div>

        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Kite {isTestnet ? 'Testnet (pieUSD)' : 'Mainnet (USDC.e)'}
        </span>
      </div>

      {/* Code Area */}
      <div style={{ position: 'relative' }}>
        <pre className="code-block" style={{ margin: 0, fontSize: '0.78rem', maxHeight: '280px', overflowY: 'auto' }}>
          {getActiveCode()}
        </pre>
        <button
          onClick={() => handleCopy(getActiveCode())}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-glass)',
            color: 'var(--text-secondary)',
            borderRadius: '4px',
            padding: '5px 8px',
            cursor: 'pointer',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
          title="Copy snippet"
        >
          {copied ? (
            <>
              <Check size={13} color="var(--accent-emerald)" />
              <span style={{ color: 'var(--accent-emerald)' }}>Copied</span>
            </>
          ) : (
            <>
              <Copy size={13} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
