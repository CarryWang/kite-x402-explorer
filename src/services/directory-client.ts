import {validateServiceManifest} from './schema-validator.js';
import type {ServiceManifest} from '../types/service.js';

export async function loadDirectory(fetcher:typeof fetch=fetch):Promise<{services:ServiceManifest[];note:string;source:'demo'|'official'}> {
  const response=await fetcher('/api/services',{signal:AbortSignal.timeout(15000),cache:'no-store'});
  if(!response.ok) throw new Error('Service directory unavailable (HTTP '+response.status+')');
  const data=await response.json();
  if(!Array.isArray(data.services) || data.services.some((service:unknown)=>!validateServiceManifest(service).valid))
    throw new Error('Service directory returned invalid manifests');
  if(!['demo','official'].includes(data.registry?.source)) throw new Error('Service directory is missing source metadata');
  const registry=data.registry;
  const note=registry.source==='demo' ? 'Bundled demo directory; addresses and availability are not verified.'
    : 'Official directory · '+(registry.commit?.slice(0,12) ?? 'no successful snapshot')+' · '+
      (registry.fetchedAt ?? 'not fetched')+(registry.stale?' · stale: '+registry.error:'')+
      (registry.errors?.length?' · '+registry.errors.length+' invalid manifests excluded':'');
  return {services:data.services,note,source:registry.source};
}
