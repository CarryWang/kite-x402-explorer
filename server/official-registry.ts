import {parseAndValidateManifest} from '../src/services/manifest-loader.js';
import type {ServiceManifest} from '../src/types/service.js';

const repository = 'gokite-ai/kite-x402-services';
const api = 'https://api.github.com/repos/' + repository;
export interface RegistrySnapshot {
  services: ServiceManifest[];
  registry: {source:'official';commit:string|null;fetchedAt:string|null;stale:boolean;
    errors:{path:string;error:string}[];sources:{name:string;url:string}[];error?:string};
}

async function read(url:string, fetcher:typeof fetch, maxBytes:number, signal:AbortSignal):Promise<string> {
  const response = await fetcher(url,{headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.any([signal,AbortSignal.timeout(6000)]),redirect:'error'});
  if (!response.ok) throw new Error('Official registry returned HTTP ' + response.status);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Official registry returned an empty response');
  const chunks:Uint8Array[] = [];
  let size=0;
  try {
    while(true) {
      const {done,value}=await reader.read();
      if(done) break;
      size+=value.byteLength;
      if(size>maxBytes) throw new Error('Official registry response too large');
      chunks.push(value);
    }
  } finally {void reader.cancel().catch(()=>{});reader.releaseLock();}
  return Buffer.concat(chunks).toString('utf8');
}

/** Read-only, commit-pinned synchronization with bounded work and stale fallback. */
export class OfficialRegistry {
  private snapshot:RegistrySnapshot = {services:[],registry:{source:'official',commit:null,
    fetchedAt:null,stale:true,errors:[],sources:[]}};
  private nextRefresh=0;
  private pending:Promise<RegistrySnapshot>|undefined;
  constructor(private readonly options:{fetcher?:typeof fetch;now?:()=>number;commit?:string;ttlMs?:number} = {}) {
    if(options.commit && !/^[a-f0-9]{40}$/i.test(options.commit)) throw new Error('REGISTRY_COMMIT must be a full Git commit SHA');
  }
  async get():Promise<RegistrySnapshot> {
    if(this.pending) return this.pending;
    if((this.options.now ?? Date.now)() < this.nextRefresh) return this.snapshot;
    this.pending=this.refresh().finally(()=>{this.pending=undefined;});
    return this.pending;
  }
  private async refresh():Promise<RegistrySnapshot> {
    const now=this.options.now ?? Date.now;
    const fetcher=this.options.fetcher ?? fetch;
    const signal=AbortSignal.timeout(12000);
    this.nextRefresh=now()+30_000;
    try {
      const head=this.options.commit ?? (JSON.parse(await read(api+'/commits/main',fetcher,65536,signal)) as {sha:string}).sha;
      if(!/^[a-f0-9]{40}$/i.test(head)) throw new Error('Invalid official registry commit');
      const tree=JSON.parse(await read(api+'/git/trees/'+head+'?recursive=1',fetcher,2*1024*1024,signal)) as {
        truncated?:boolean;tree?:{path:string;type:string;size?:number}[]};
      if(tree.truncated || !Array.isArray(tree.tree)) throw new Error('Incomplete official registry tree');
      const files=tree.tree.filter(file=>file.type==='blob' && /^services\/[a-z0-9][a-z0-9-]*\/service\.yaml$/.test(file.path));
      if(files.length>200) throw new Error('Official registry exceeds the 200-manifest limit');
      const results:{path:string;manifest?:ServiceManifest;url:string;error?:string}[]=[];
      for(let offset=0;offset<files.length;offset+=4) {
        results.push(...await Promise.all(files.slice(offset,offset+4).map(async file=>{
          const url='https://raw.githubusercontent.com/'+repository+'/'+head+'/'+file.path;
          // A transport failure must not silently remove an existing service.
          const content=(file.size ?? 0)>65536 ? null : await read(url,fetcher,65536,signal);
          try {
            if(content === null) throw new Error('Manifest exceeds 64 KiB');
            const parsed=parseAndValidateManifest(content);
            if(!parsed.success || !parsed.manifest) throw new Error(parsed.error ?? 'Invalid manifest');
            if(parsed.manifest.name !== file.path.split('/')[1]) throw new Error('Manifest name differs from service directory');
            return {path:file.path,url,manifest:parsed.manifest};
          } catch(error) {return {path:file.path,url,error:error instanceof Error?error.message:'Invalid manifest'};}
        })));
      }
      const services=results.flatMap(result=>result.manifest?[result.manifest]:[]);
      if(files.length && !services.length) throw new Error('No official manifests passed validation');
      this.snapshot={services,registry:{source:'official',commit:head,fetchedAt:new Date(now()).toISOString(),stale:false,
        errors:results.flatMap(result=>result.error?[{path:result.path,error:result.error}]:[]),
        sources:results.flatMap(result=>result.manifest?[{name:result.manifest.name,url:result.url}]:[])}};
      this.nextRefresh=now()+(this.options.ttlMs ?? 300_000);
    } catch(error) {
      this.snapshot={...this.snapshot,registry:{...this.snapshot.registry,stale:true,
        error:error instanceof Error?error.message:'Registry synchronization failed'}};
    }
    return this.snapshot;
  }
}
