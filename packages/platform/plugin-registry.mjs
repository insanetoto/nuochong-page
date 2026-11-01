// First-party plugin composition only. This registry never imports client-selected code.
const namespaces = new Map([['identity-company','identity'],['organization','organization'],['access-management','access'],['knowledge','knowledge'],['enterprise-tools','enterprise-tools'],['learning','learning']]);
export class PluginRegistry {
  constructor(manifests, platformMajor=1) {
    this.entries = new Map(); this.commandOwners = new Map();
    for (const manifest of manifests) {
      if (!namespaces.has(manifest.id) || manifest.apiMajor !== platformMajor || !/^1\.\d+\.\d+$/.test(manifest.version) || this.entries.has(manifest.id)) throw new Error('INCOMPATIBLE_PLUGIN');
      const state=manifest.state??'enabled';
      if (!['registered','enabled','draining','disabled'].includes(state)) throw new Error('INVALID_PLUGIN_STATE');
      const entry=Object.freeze({...manifest,requires:Object.freeze([...(manifest.requires??[])]),commands:Object.freeze([...(manifest.commands??[])]),state});
      for(const id of entry.commands){
        if(!id.startsWith(namespaces.get(entry.id)+'.') || !/\.v1$/.test(id) || this.commandOwners.has(id))throw new Error('COMMAND_NAMESPACE_CONFLICT');
        this.commandOwners.set(id,entry.id);
      }
      this.entries.set(entry.id,entry);
    }
    const visited=new Set();
    const visit=(id,path=new Set())=>{
      if(path.has(id))throw new Error('DEPENDENCY_CYCLE');
      if(visited.has(id))return;
      const entry=this.entries.get(id);if(!entry)throw new Error('DEPENDENCY_UNAVAILABLE');
      for(const dependency of entry.requires)visit(dependency,new Set([...path,id]));
      visited.add(id);
    };
    for(const id of this.entries.keys())visit(id);
    for(const entry of this.entries.values()) if(entry.state==='enabled')for(const id of entry.requires)if(this.entries.get(id)?.state!=='enabled')throw new Error('DEPENDENCY_UNAVAILABLE');
  }
  list(){return [...this.entries.values()].map(e=>({id:e.id,version:e.version,state:e.state,requires:[...e.requires]}));}
  assertEnabled(id,write=false){
    const entry=this.entries.get(id);
    if(!entry || !['enabled',...(write?[]:['draining'])].includes(entry.state))throw new Error('DEPENDENCY_UNAVAILABLE');
    for(const dependency of entry.requires)this.assertEnabled(dependency,write);
    return entry;
  }
  transition(id,state){
    if(!this.entries.has(id))throw new Error('PLUGIN_NOT_FOUND');
    const next=[...this.entries.values()].map(e=>e.id===id?{...e,state}:e);
    // A required dependency cannot be disabled while its consumer accepts work.
    return new PluginRegistry(next);
  }
}
export const foundationManifests = [
  {id:'identity-company',version:'1.0.0',apiMajor:1,requires:[],commands:[]},
  {id:'organization',version:'1.0.0',apiMajor:1,requires:['identity-company'],commands:[]},
  {id:'access-management',version:'1.0.0',apiMajor:1,requires:['identity-company','organization'],commands:[]},
  {id:'knowledge',version:'1.0.0',apiMajor:1,requires:['identity-company','organization','access-management'],commands:[]},
  {id:'enterprise-tools',version:'1.0.0',apiMajor:1,requires:[],commands:[],state:'registered'},
  {id:'learning',version:'1.0.0',apiMajor:1,requires:[],commands:[],state:'registered'},
];
