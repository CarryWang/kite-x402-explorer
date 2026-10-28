import {hashDomain, recoverTypedDataAddress} from 'viem';
import {generatePrivateKey, privateKeyToAccount} from 'viem/accounts';
import {KITE_TESTNET} from '../types/kite.js';
import {EIP3009_TYPES} from '../lib/eip3009.js';

export interface CheckEvidence {
  status: 'passed' | 'blocked';
  scope: 'live-readonly' | 'offline' | 'not-run';
  output: string;
}

async function json(url: string, init: RequestInit, fetcher: typeof fetch): Promise<unknown> {
  const response = await fetcher(url,{...init,signal:AbortSignal.timeout(6000)});
  if (!response.ok) throw new Error('HTTP ' + response.status);
  const text = await response.text();
  if (text.length > 65536) throw new Error('Diagnostic response too large');
  return JSON.parse(text);
}
async function rpc(requests: unknown[], fetcher: typeof fetch): Promise<Map<number,string>> {
  const data = await json(KITE_TESTNET.rpcUrl,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(requests)},fetcher);
  if (!Array.isArray(data)) throw new Error('Expected JSON-RPC batch');
  const answers = new Map<number,string>();
  for(const reply of data) {
    if (reply?.jsonrpc !== '2.0' || !Number.isInteger(reply.id) || reply.error ||
      typeof reply.result !== 'string' || answers.has(reply.id)) throw new Error('Invalid JSON-RPC result');
    answers.set(reply.id,reply.result);
  }
  return answers;
}
function quantity(value: string | undefined): bigint {
  if (!value || !/^0x[\da-f]+$/i.test(value)) throw new Error('Missing or invalid RPC quantity');
  return BigInt(value);
}
export async function checkRpc(fetcher: typeof fetch = fetch): Promise<CheckEvidence> {
  const result = await rpc([
    {jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]},
    {jsonrpc:'2.0',id:2,method:'eth_blockNumber',params:[]},
  ],fetcher);
  if (quantity(result.get(1)) !== BigInt(KITE_TESTNET.chainId)) throw new Error('RPC chain ID does not match Kite testnet');
  const block = quantity(result.get(2));
  if (block <= 0n) throw new Error('RPC returned no positive block height');
  return {status:'passed',scope:'live-readonly',output:'Observed chain 2368, block ' + block.toString()};
}
export async function checkDomain(fetcher: typeof fetch = fetch): Promise<CheckEvidence> {
  await checkRpc(fetcher);
  const result = await rpc([{jsonrpc:'2.0',id:3,method:'eth_call',params:[
    {to:KITE_TESTNET.assetAddress,data:'0x3644e515'},'latest']}],fetcher);
  const expected = hashDomain({domain:{...KITE_TESTNET.eip712Domain,chainId:BigInt(KITE_TESTNET.chainId)},types:{EIP712Domain:[
    {name:'name',type:'string'},{name:'version',type:'string'},
    {name:'chainId',type:'uint256'},{name:'verifyingContract',type:'address'},
  ]}});
  if (result.get(3)?.toLowerCase() !== expected.toLowerCase()) throw new Error('On-chain DOMAIN_SEPARATOR differs from configured domain');
  return {status:'passed',scope:'live-readonly',output:'Token DOMAIN_SEPARATOR matches ' + expected};
}
export async function checkFacilitator(fetcher: typeof fetch = fetch): Promise<CheckEvidence> {
  const supported = await json(KITE_TESTNET.facilitatorUrl + '/supported',{},fetcher) as {kinds?:unknown[]};
  if (!Array.isArray(supported?.kinds) || !supported.kinds.some((value) => {
    const kind=value as {x402Version?:number;scheme?:string;network?:string};
    return kind?.x402Version === 2 && kind.scheme === 'exact' && kind.network === KITE_TESTNET.network;
  })) throw new Error('Facilitator does not advertise x402 v2 exact on Kite testnet');
  return {status:'passed',scope:'live-readonly',output:'Observed x402 v2 exact / eip155:2368; settlement not tested'};
}
export async function checkOfflineSignature(): Promise<CheckEvidence> {
  const account = privateKeyToAccount(generatePrivateKey());
  const typedData = {domain:KITE_TESTNET.eip712Domain,types:EIP3009_TYPES,
    primaryType:'TransferWithAuthorization' as const,message:{from:account.address,
      to:'0x2222222222222222222222222222222222222222' as const,value:1000000000000000n,
      validAfter:0n,validBefore:BigInt(Math.floor(Date.now()/1000)+60),
      nonce:('0x'+'00'.repeat(32)) as `0x${string}`}};
  const signature = await account.signTypedData(typedData);
  const recovered = await recoverTypedDataAddress({...typedData,signature});
  if (recovered.toLowerCase() !== account.address.toLowerCase()) throw new Error('Signature recovery mismatch');
  return {status:'passed',scope:'offline',output:'Ephemeral EIP-3009 signature recovered locally; no submission or settlement'};
}
export function checkZeroDeduction(): CheckEvidence {
  return {status:'blocked',scope:'not-run',output:'Requires an instrumented seller/facilitator and balance evidence. No payment or zero-deduction result was verified.'};
}
