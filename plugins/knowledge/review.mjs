// KBV2-06 #109: fragment review, versioned entry assembly and review targets.
import {randomUUID,createHash} from 'node:crypto';
import {requireThat} from '../../apps/control-api/src/errors.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const norm=value=>Array.isArray(value)?value.map(norm):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,norm(value[k])])):value;
const c14n=value=>JSON.stringify(norm(value));
const hashObj=value=>sha(Buffer.from(c14n(value),'utf8'));
const codePoints=value=>[...value];
const fragmentDTO=f=>({fragmentId:f.id,spaceId:f.space_id,sourceRevisionId:f.source_id,locator:f.locator,excerpt:f.excerpt,textHash:f.text_hash,revision:f.revision,status:f.status});
const lineLocator=l=>({type:'line',lineStart:l.lineStart,lineEnd:l.lineEnd});
const sourceRefsDTO=async(db,rows)=>{const refs=[];for(const id of [...new Set(rows.map(r=>r.source_id))].sort()){const s=(await db.query('SELECT s.id,s.ordinal,s.object_hash,d.current_source_id,s.status,s.valid_from,s.valid_until FROM knowledge_sources s JOIN knowledge_documents d ON d.id=s.document_id WHERE s.id=$1',[id])).rows[0];requireThat(s,404,'NOT_FOUND');refs.push({sourceRevisionId:s.id,ordinal:s.ordinal,objectHash:s.object_hash,current:s.current_source_id===s.id,status:s.status});}return refs;};

export class ReviewService {
 constructor(kernel,knowledge){this.kernel=kernel;this.knowledge=knowledge;this.pool=kernel.pool;}
 async currentSource(db,spaceId,sourceId){
  const s=(await db.query('SELECT s.*,d.current_source_id,d.policy_code FROM knowledge_sources s JOIN knowledge_documents d ON d.id=s.document_id WHERE s.space_id=$1 AND s.id=$2',[spaceId,sourceId])).rows[0];
  requireThat(s,404,'NOT_FOUND');return s;
 }
 async validateSource(db,spaceId,sourceId){
  const s=await this.currentSource(db,spaceId,sourceId);requireThat(s.status==='active'&&s.valid_from<=new Date()&&(!s.valid_until||s.valid_until>new Date()),409,'EVIDENCE_CHANGED');requireThat(s.current_source_id===s.id,409,'EVIDENCE_CHANGED');return s;
 }
 async fragment(db,spaceId,id,{lock=false}={}){
  const f=(await db.query(`SELECT * FROM knowledge_fragments WHERE id=$1 AND space_id=$2${lock?' FOR UPDATE':''}`,[id,spaceId])).rows[0];requireThat(f,404,'NOT_FOUND');return f;
 }
 async fragments(db,spaceId,ids,{accepted=true,lock=false}={}){
  const rows=[];for(const id of ids){const f=await this.fragment(db,spaceId,id,{lock});if(accepted)requireThat(f.status==='accepted',409,'EVIDENCE_CHANGED');rows.push(f);}return rows;
 }
 async lineageHash(db,fragmentId){
  const rows=(await db.query('SELECT parent_fragment_id,ordinal,action,anchor_start,anchor_end FROM knowledge_fragment_lineage WHERE child_fragment_id=$1 ORDER BY ordinal,id',[fragmentId])).rows;
  return hashObj(rows.map(r=>({parent:r.parent_fragment_id,ordinal:r.ordinal,action:r.action,start:r.anchor_start,end:r.anchor_end})));
 }
 async splitRangesOf(db,fragmentId){return (await db.query("SELECT parent_fragment_id,anchor_start,anchor_end FROM knowledge_fragment_lineage WHERE child_fragment_id=$1 AND action='split' ORDER BY ordinal",[fragmentId])).rows;}
 async reconstructedExcerpt(db,fragment,seen=new Set()){
  if(seen.has(fragment.id))throw Object.assign(new Error('LINEAGE_CYCLE'),{code:'EVIDENCE_CHANGED'});seen.add(fragment.id);
  const rows=(await db.query('SELECT parent_fragment_id,action,ordinal,anchor_start,anchor_end FROM knowledge_fragment_lineage WHERE child_fragment_id=$1 ORDER BY ordinal,id',[fragment.id])).rows;
  if(!rows.length)return fragment.excerpt;
  let out='',previous=null;
  for(const row of rows){const parent=(await db.query('SELECT * FROM knowledge_fragments WHERE id=$1',[row.parent_fragment_id])).rows[0];requireThat(parent,409,'EVIDENCE_CHANGED');let text=await this.reconstructedExcerpt(db,parent,new Set(seen));if(row.action==='split')text=codePoints(text).slice(row.anchor_start,row.anchor_end).join('');if(previous){const joins=previous.action==='split'&&row.action==='split'&&previous.parent_fragment_id===row.parent_fragment_id&&previous.anchor_end===row.anchor_start;out+=joins?'':'\n';}out+=text;previous=row;}
  return out;
 }
 async evidence(db,spaceId,fragmentIds,{lock=false}={}){
  requireThat(Array.isArray(fragmentIds)&&fragmentIds.length>0&&fragmentIds.length<=500,400,'INVALID_CITATION');
  requireThat(new Set(fragmentIds).size===fragmentIds.length,400,'INVALID_CITATION');
  const fragments=[];const citationRefs=[];
  for(const id of fragmentIds){const f=await this.fragment(db,spaceId,id,{lock});requireThat(f.status==='accepted',409,'EVIDENCE_CHANGED');const s=await this.validateSource(db,spaceId,f.source_id);requireThat(s.ordinal===f.source_revision,409,'EVIDENCE_CHANGED');const rebuilt=await this.reconstructedExcerpt(db,f);requireThat(rebuilt===f.excerpt&&sha(rebuilt)===f.text_hash,409,'EVIDENCE_CHANGED');const lineage=await this.lineageHash(db,f.id);fragments.push({...f,lineage_hash:lineage});citationRefs.push({fragmentId:f.id,sourceRevisionId:f.source_id,locator:f.locator,textHash:f.text_hash,lineageHash:lineage,excerpt:f.excerpt});}
  return {fragments,citationRefs,sources:await sourceRefsDTO(db,fragments)};
 }
 async graph(db,spaceId,revisionId,conceptRevisionIds=[],relationRevisionIds=[]){
  const conceptRevisions=[];for(const id of [...new Set(conceptRevisionIds)].sort()){const r=(await db.query('SELECT id,content_hash FROM knowledge_concept_revisions WHERE id=$1 AND space_id=$2',[id,spaceId])).rows[0];requireThat(r,404,'NOT_FOUND');conceptRevisions.push({id:r.id,contentHash:r.content_hash});}
  const relationRevisions=[];for(const id of [...new Set(relationRevisionIds)].sort()){const r=(await db.query('SELECT id,content_hash FROM knowledge_relation_revisions WHERE id=$1 AND space_id=$2',[id,spaceId])).rows[0];requireThat(r,404,'NOT_FOUND');relationRevisions.push({id:r.id,contentHash:r.content_hash});}
  const pageId=(await db.query('SELECT page_id FROM knowledge_revisions WHERE id=$1',[revisionId])).rows[0]?.page_id;
  const assignments=pageId?(await db.query('SELECT id,concept_revision_id,content_hash FROM knowledge_entry_concept_assignments WHERE entry_id=$1 AND space_id=$2 ORDER BY id',[pageId,spaceId])).rows.map(r=>({id:r.id,conceptRevisionId:r.concept_revision_id,contentHash:r.content_hash})):[];
  const supersessions=pageId?(await db.query('SELECT id,from_revision_id,to_revision_id FROM knowledge_entry_supersessions WHERE entry_id=$1 AND space_id=$2 ORDER BY id',[pageId,spaceId])).rows.map(r=>({id:r.id,from:r.from_revision_id,to:r.to_revision_id})):[];
  return {conceptRevisions,relationRevisions,assignments,supersessions};
 }

 async aclRevision(db){return Number((await db.query('SELECT revision FROM knowledge_acl_revision WHERE id=1')).rows[0].revision);}
 async target(db,spaceId,revisionId,bodyHash,fragmentIds,conceptRevisionIds,relationRevisionIds){
  const evidence=await this.evidence(db,spaceId,fragmentIds);const graph=await this.graph(db,spaceId,revisionId,conceptRevisionIds,relationRevisionIds);const space=(await db.query('SELECT publication_policy_revision FROM knowledge_spaces WHERE id=$1',[spaceId])).rows[0];requireThat(space,404,'NOT_FOUND');const snapshot=(await db.query('SELECT id FROM knowledge_publication_snapshots WHERE space_id=$1 AND current ORDER BY effective_at DESC LIMIT 1',[spaceId])).rows[0];
  const targetInput={version:1,spaceId,entryRevisionId:revisionId,bodyHash,citationRefs:evidence.citationRefs,sourceRevisionRefs:evidence.sources.map(r=>({sourceRevisionId:r.sourceRevisionId,ordinal:r.ordinal,objectHash:r.objectHash})),aclRevision:await this.aclRevision(db),policyRevision:space.publication_policy_revision,graphHash:hashObj(graph),baseSnapshotId:snapshot?.id??''};
  return {targetInput,targetHash:hashObj(targetInput),evidence};
 }
 async revisionFragments(db,revisionId){return (await db.query('SELECT * FROM knowledge_revision_fragments WHERE revision_id=$1 ORDER BY ordinal',[revisionId])).rows;}
 async revisionGraph(db,revisionId){return {conceptRevisionIds:(await db.query('SELECT concept_revision_id FROM knowledge_revision_concepts WHERE revision_id=$1 ORDER BY concept_revision_id',[revisionId])).rows.map(r=>r.concept_revision_id),relationRevisionIds:(await db.query('SELECT relation_revision_id FROM knowledge_revision_relations WHERE revision_id=$1 ORDER BY relation_revision_id',[revisionId])).rows.map(r=>r.relation_revision_id)};}
 async latestRevision(db,pageId){const r=(await db.query('SELECT * FROM knowledge_revisions WHERE page_id=$1 ORDER BY page_revision DESC LIMIT 1',[pageId])).rows[0];requireThat(r,404,'NOT_FOUND');return r;}
 async pageRow(db,spaceId,pageId,{lock=false}={}){const p=(await db.query(`SELECT * FROM knowledge_pages WHERE id=$1 AND space_id=$2${lock?' FOR UPDATE':''}`,[pageId,spaceId])).rows[0];requireThat(p,404,'NOT_FOUND');return p;}
 async meta(db,revisionId){return (await db.query('SELECT * FROM knowledge_entry_review_meta WHERE revision_id=$1',[revisionId])).rows[0];}
 async revisionStatus(db,spaceId,page,revision){
  const meta=await this.meta(db,revision.id);
  if(page.published_revision_id===revision.id)return 'published';
  if(!meta)return revision.state==='published'?'published':revision.state==='reviewed'?'reviewed':'draft';
  if(meta.status==='draft')return 'draft';
  try{const rf=await this.revisionFragments(db,revision.id),g=await this.revisionGraph(db,revision.id);const current=await this.target(db,spaceId,revision.id,revision.body_hash,rf.map(r=>r.fragment_id),g.conceptRevisionIds,g.relationRevisionIds);if(meta.target_hash&&meta.target_hash!==current.targetHash)return 'stale';}catch{return 'stale';}
  return meta.status;
 }
 async entryDTO(db,spaceId,page,revision,{body=false}={}){
  const rf=await this.revisionFragments(db,revision.id);const meta=await this.meta(db,revision.id);const status=await this.revisionStatus(db,spaceId,page,revision);
  const dto={entryId:page.id,spaceId,revisionId:revision.id,revision:page.revision,entryType:page.entry_type,title:revision.title,body:body?await this.knowledge.objects.read(db,revision.body_hash):'',status,fragmentIds:rf.map(r=>r.fragment_id)};
  return {dto,meta,rf};
 }
 async fragmentsList(db,ctx,i){
  if(i.view!=='manage')return {items:[]};
  const limit=Math.min(i.limit??100,200);const params=[i.spaceId];let where='space_id=$1';if(i.sourceId){params.push(i.sourceId);where+=` AND source_id=$${params.length}`;}if(i.status){params.push(i.status);where+=` AND status=$${params.length}`;}if(i.after){params.push(i.after);where+=` AND id>$${params.length}`;}params.push(limit+1);
  const rows=(await db.query(`SELECT * FROM knowledge_fragments WHERE ${where} ORDER BY id LIMIT $${params.length}`,params)).rows;
  requireThat(this.knowledge.steward(ctx,i.spaceId),403,'FORBIDDEN');
  return {items:rows.slice(0,limit).map(fragmentDTO),...(rows.length>limit&&{nextCursor:rows[limit-1].id})};
 }
 async fragmentsReview(db,ctx,i){
  requireThat(Array.isArray(i.relatedFragmentIds)&&Array.isArray(i.splitRanges),400,'INVALID_INPUT');
  const anchor=await this.fragment(db,i.spaceId,i.fragmentId,{lock:true});requireThat(anchor.revision===i.expectedRevision,409,'VERSION_CONFLICT');requireThat(['pending','accepted'].includes(anchor.status),409,'VERSION_CONFLICT');
  const reason=i.reason.trim();requireThat(reason.length>=3,400,'INVALID_INPUT');
  if(i.decision==='accept'||i.decision==='reject'){
   requireThat(i.relatedFragmentIds.length===0&&i.splitRanges.length===0,400,'INVALID_INPUT');const status=i.decision==='accept'?'accepted':'rejected';
   const row=(await db.query('UPDATE knowledge_fragments SET status=$2,revision=revision+1 WHERE id=$1 RETURNING *',[anchor.id,status])).rows[0];await this.kernel.event(db,'knowledge.fragment.reviewed.v1',row.id);return {fragments:[fragmentDTO(row)],requestId:randomUUID()};
  }
  if(i.decision==='split'){
   requireThat(i.relatedFragmentIds.length===0,400,'INVALID_INPUT');const chars=codePoints(anchor.excerpt);requireThat(i.splitRanges.length>=2&&i.splitRanges.length<=50,400,'INVALID_INPUT');let cursor=0;for(const range of i.splitRanges){requireThat(range.start===cursor&&range.end>range.start&&range.end<=chars.length,400,'INVALID_INPUT');const part=chars.slice(range.start,range.end).join('');requireThat(part.trim().length>0,400,'INVALID_INPUT');cursor=range.end;}requireThat(cursor===chars.length,400,'INVALID_INPUT');
   const rows=[];for(let index=0;index<i.splitRanges.length;index+=1){const range=i.splitRanges[index];const excerpt=chars.slice(range.start,range.end).join('');const locator=anchor.locator;const locatorKey=anchor.locator_key+'#split:'+(index+1)+':'+range.start+'-'+range.end;const row=(await db.query(`INSERT INTO knowledge_fragments(id,space_id,source_id,source_revision,locator,locator_key,excerpt,text_hash,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'pending') RETURNING *`,[randomUUID(),anchor.space_id,anchor.source_id,anchor.source_revision,JSON.stringify(locator),locatorKey,excerpt,sha(excerpt)])).rows[0];await db.query('INSERT INTO knowledge_fragment_lineage(id,space_id,parent_fragment_id,child_fragment_id,action,ordinal,source_revision_id,anchor_start,anchor_end,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[randomUUID(),anchor.space_id,anchor.id,row.id,'split',index+1,anchor.source_id,range.start,range.end,ctx.actor.id]);rows.push(row);}await db.query("UPDATE knowledge_fragments SET status='superseded',revision=revision+1 WHERE id=$1",[anchor.id]);await this.kernel.event(db,'knowledge.fragment.split.v1',anchor.id);return {fragments:rows.map(fragmentDTO),requestId:randomUUID()};
  }
  requireThat(i.decision==='merge',400,'INVALID_INPUT');requireThat(i.splitRanges.length===0,400,'INVALID_INPUT');const ids=[anchor.id,...i.relatedFragmentIds];requireThat(ids.length>=2,400,'INVALID_INPUT');requireThat(new Set(ids).size===ids.length,400,'INVALID_INPUT');const inputs=[];for(const id of [...ids].sort())inputs.push(await this.fragment(db,i.spaceId,id,{lock:true}));
  requireThat(inputs.every(f=>f.status==='pending'||f.status==='accepted'),409,'VERSION_CONFLICT');requireThat(inputs.every(f=>f.source_id===anchor.source_id&&f.source_revision===anchor.source_revision),400,'INVALID_INPUT');
  const withLineage=[];for(const f of inputs)withLineage.push({f,split:(await this.splitRangesOf(db,f.id))[0]});
  const sorted=withLineage.sort((a,b)=>{const al=a.split?.anchor_start??a.f.locator.lineStart??a.f.locator.paragraph??0,bl=b.split?.anchor_start??b.f.locator.lineStart??b.f.locator.paragraph??0;return al-bl;});requireThat(sorted.every(x=>x.f.locator.type===anchor.locator.type),400,'INVALID_INPUT');
  const separators=[];for(let n=1;n<sorted.length;n+=1){const prev=sorted[n-1],cur=sorted[n];const joins=prev.split&&cur.split&&prev.split.parent_fragment_id===cur.split.parent_fragment_id&&prev.split.anchor_end===cur.split.anchor_start;if(joins){separators.push('');continue;}separators.push('\n');if(prev.f.locator.type==='line')requireThat(cur.f.locator.lineStart===prev.f.locator.lineEnd+1,400,'INVALID_INPUT');else requireThat(prev.f.locator.type==='page'?cur.f.locator.page===prev.f.locator.page&&cur.f.locator.lineStart===prev.f.locator.lineEnd+1:cur.f.locator.paragraph===prev.f.locator.paragraph+1,400,'INVALID_INPUT');}
  let excerpt=sorted[0].f.excerpt;for(let n=1;n<sorted.length;n+=1)excerpt+=separators[n-1]+sorted[n].f.excerpt;const first=sorted[0].f.locator,last=sorted[sorted.length-1].f.locator;const locator=first.type==='line'?lineLocator({lineStart:first.lineStart,lineEnd:last.lineEnd}):first.type==='page'?{type:'page',page:first.page,paragraph:first.paragraph}:{type:'paragraph',paragraph:first.paragraph,...(first.heading?{heading:first.heading}:{})};const locatorKey=sha(c14n({merge:ids.sort(),locator}));const row=(await db.query(`INSERT INTO knowledge_fragments(id,space_id,source_id,source_revision,locator,locator_key,excerpt,text_hash,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'pending') RETURNING *`,[randomUUID(),anchor.space_id,anchor.source_id,anchor.source_revision,JSON.stringify(locator),locatorKey,excerpt,sha(excerpt)])).rows[0];
  let offset=0;for(let index=0;index<sorted.length;index+=1){const f=sorted[index].f;if(index>0)offset+=codePoints(separators[index-1]).length;const end=offset+codePoints(f.excerpt).length;await db.query('INSERT INTO knowledge_fragment_lineage(id,space_id,parent_fragment_id,child_fragment_id,action,ordinal,source_revision_id,anchor_start,anchor_end,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[randomUUID(),anchor.space_id,f.id,row.id,'merge',index+1,anchor.source_id,offset,end,ctx.actor.id]);offset=end;}for(const f of inputs)await db.query("UPDATE knowledge_fragments SET status='merged',revision=revision+1 WHERE id=$1",[f.id]);await this.kernel.event(db,'knowledge.fragment.merged.v1',row.id);return {fragments:[fragmentDTO(row)],requestId:randomUUID()};
 }
 async entryList(db,ctx,i){
  const view=i.view;if(view==='manage')requireThat(this.knowledge.steward(ctx,i.spaceId),403,'FORBIDDEN');const limit=Math.min(i.limit??100,200);const params=[i.spaceId];let where='space_id=$1';if(i.after){params.push(i.after);where+=` AND id>$${params.length}`;}params.push(limit+1);const pages=(await db.query(`SELECT * FROM knowledge_pages WHERE ${where} ORDER BY id LIMIT $${params.length}`,params)).rows;const items=[];
  for(const page of pages.slice(0,limit)){if(view==='published'&&!page.published_revision_id)continue;let revision;try{revision=view==='published'?await this.knowledge.revision(db,i.spaceId,page.published_revision_id):await this.latestRevision(db,page.id);}catch{continue;}const {dto}=await this.entryDTO(db,i.spaceId,page,revision,{body:true});if(view==='published'&&!await this.knowledge.currentValid(db,revision))continue;if(i.status&&dto.status!==i.status)continue;items.push(dto);}
  return {items,...(pages.length>limit&&{nextCursor:pages[limit-1].id})};
 }
 async entryGet(db,ctx,i){
  const page=await this.pageRow(db,i.spaceId,i.entryId);if(i.view==='published')requireThat(page.published_revision_id,404,'NOT_FOUND');requireThat(page.managed_v2||i.view==='published',409,'CONTRACT_VERSION_REQUIRED');const revision=i.view==='published'?await this.knowledge.revision(db,i.spaceId,page.published_revision_id):await this.latestRevision(db,page.id);const {dto,rf}=await this.entryDTO(db,i.spaceId,page,revision,{body:true});const fragments=rf.map(r=>({fragmentId:r.fragment_id,spaceId:i.spaceId,sourceRevisionId:r.source_revision_id,locator:r.locator,excerpt:r.excerpt,textHash:r.text_hash,revision:1,status:'accepted'}));const relationRevisionIds=(await db.query('SELECT relation_revision_id FROM knowledge_revision_relations WHERE revision_id=$1 ORDER BY relation_revision_id',[revision.id])).rows.map(r=>r.relation_revision_id);const relations=[];for(const id of relationRevisionIds){const r=(await db.query('SELECT * FROM knowledge_relation_revisions WHERE id=$1',[id])).rows[0];if(r)relations.push({relationId:r.relation_id,relationRevisionId:r.id,fromEntryRevisionId:r.from_entry_revision_id,toEntryRevisionId:r.to_entry_revision_id,type:r.type,reason:r.reason,weight:r.weight,revision:r.revision});}return {entry:dto,fragments,relations,requestId:randomUUID()};
 }
 async entryDraft(db,ctx,i){
  requireThat(i.entryType&&i.body.length>0&&i.title.length>0,400,'INVALID_INPUT');const evidence=await this.evidence(db,i.spaceId,i.fragmentIds);const markers=[...i.body.matchAll(/\[(\d+)\]/g)];requireThat(markers.length>0&&markers.every(m=>Number(m[1])>=1&&Number(m[1])<=i.fragmentIds.length),400,'CITATION_MARKER_REQUIRED');
  let page;if(i.entryId){page=await this.pageRow(db,i.spaceId,i.entryId,{lock:true});if(page.managed_v2===false&&await this.meta(db,(await this.latestRevision(db,page.id)).id))requireThat(false,409,'CONTRACT_VERSION_REQUIRED');requireThat(page.revision===i.expectedRevision,409,'VERSION_CONFLICT');}
  else{requireThat(i.expectedRevision===0,409,'VERSION_CONFLICT');page=(await db.query('INSERT INTO knowledge_pages(id,space_id,revision,entry_type,managed_v2) VALUES($1,$2,0,$3,true) RETURNING *',[randomUUID(),i.spaceId,i.entryType])).rows[0];}
  const updated=(await db.query('UPDATE knowledge_pages SET revision=revision+1,entry_type=$2,managed_v2=true WHERE id=$1 RETURNING *',[page.id,i.entryType])).rows[0];const bodyHash=await this.knowledge.objects.put(db,i.body);const revisionId=randomUUID();
  const citations=evidence.citationRefs.map(r=>({sourceId:r.sourceRevisionId,lineStart:r.locator.lineStart??1,lineEnd:r.locator.lineEnd??1,quote:r.excerpt}));const sourceIds=evidence.sources.map(r=>r.sourceRevisionId);
  await db.query('INSERT INTO knowledge_revisions(id,page_id,page_revision,title,body_hash,source_ids,citations,state) VALUES($1,$2,$3,$4,$5,$6,$7,\'draft\')',[revisionId,page.id,updated.revision,i.title,bodyHash,sourceIds,JSON.stringify(citations)]);
  for(let n=0;n<evidence.fragments.length;n+=1){const f=evidence.fragments[n],ref=evidence.citationRefs[n];await db.query('INSERT INTO knowledge_revision_fragments(revision_id,fragment_id,space_id,ordinal,role,source_revision_id,locator,text_hash,lineage_hash,excerpt) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[revisionId,f.id,i.spaceId,n+1,'evidence',f.source_id,JSON.stringify(ref.locator),ref.textHash,ref.lineageHash,ref.excerpt]);}
  for(const id of i.conceptRevisionIds??[])await db.query('INSERT INTO knowledge_revision_concepts(revision_id,concept_revision_id,space_id) VALUES($1,$2,$3)',[revisionId,id,i.spaceId]);
  for(const id of i.relationRevisionIds??[])await db.query('INSERT INTO knowledge_revision_relations(revision_id,relation_revision_id,space_id) VALUES($1,$2,$3)',[revisionId,id,i.spaceId]);
  await db.query("INSERT INTO knowledge_entry_review_meta(revision_id,status) VALUES($1,'draft')",[revisionId]);await this.kernel.event(db,'knowledge.entry.drafted.v1',revisionId);
  const latest=await this.latestRevision(db,page.id);const out=await this.entryDTO(db,i.spaceId,updated,latest,{body:true});return {entry:out.dto,requestId:randomUUID()};
 }
 async entrySubmit(db,ctx,i){
  const page=await this.pageRow(db,i.spaceId,i.entryId,{lock:true});requireThat(page.managed_v2,409,'CONTRACT_VERSION_REQUIRED');requireThat(page.revision===i.expectedRevision,409,'VERSION_CONFLICT');const revision=await this.latestRevision(db,page.id);const meta=await this.meta(db,revision.id);requireThat(meta,409,'CONTRACT_VERSION_REQUIRED');const rf=await this.revisionFragments(db,revision.id);const graph=await this.revisionGraph(db,revision.id);const target=await this.target(db,i.spaceId,revision.id,revision.body_hash,rf.map(r=>r.fragment_id),graph.conceptRevisionIds,graph.relationRevisionIds);
  if(meta.status==='pending_review'&&meta.target_hash===target.targetHash)return {entry:(await this.entryDTO(db,i.spaceId,page,revision,{body:true})).dto,reviewTargetHash:target.targetHash,requestId:randomUUID()};
  requireThat(meta.status==='draft',409,'VERSION_CONFLICT');await db.query("UPDATE knowledge_entry_review_meta SET status='pending_review',target_hash=$2,target_input=$3,submitted_at=clock_timestamp() WHERE revision_id=$1",[revision.id,target.targetHash,JSON.stringify(target.targetInput)]);await this.kernel.event(db,'knowledge.entry.submitted.v1',revision.id);return {entry:(await this.entryDTO(db,i.spaceId,page,revision,{body:true})).dto,reviewTargetHash:target.targetHash,requestId:randomUUID()};
 }
 async reviewTargetGet(db,ctx,i){try{
  requireThat(this.knowledge.steward(ctx,i.spaceId),403,'FORBIDDEN');const revision=(await db.query('SELECT r.*,p.revision AS page_revision,p.id AS page_id FROM knowledge_revisions r JOIN knowledge_pages p ON p.id=r.page_id WHERE r.id=$1 AND p.space_id=$2',[i.entryRevisionId,i.spaceId])).rows[0];requireThat(revision,404,'NOT_FOUND');const meta=await this.meta(db,revision.id);requireThat(meta&&meta.target_hash,409,'REVIEW_REQUIRED');return {entryId:revision.page_id,entryRevisionId:revision.id,expectedRevision:revision.page_revision,reviewTargetHash:meta.target_hash,targetInput:meta.target_input,requestId:randomUUID()};
 }catch(error){console.error('REVIEW_TARGET_GET_ERROR',error);throw error;}
 }
 async entryReview(db,ctx,i){
  const revision=(await db.query('SELECT r.*,p.space_id,p.revision AS current_revision,p.published_revision_id FROM knowledge_revisions r JOIN knowledge_pages p ON p.id=r.page_id WHERE r.id=$1 AND p.space_id=$2',[i.entryRevisionId,i.spaceId])).rows[0];requireThat(revision,404,'NOT_FOUND');const page=await this.pageRow(db,i.spaceId,revision.page_id,{lock:true});requireThat(page.managed_v2,409,'CONTRACT_VERSION_REQUIRED');requireThat(page.revision===i.expectedRevision,409,'VERSION_CONFLICT');const meta=await this.meta(db,revision.id);requireThat(meta&&meta.status==='pending_review',409,'REVIEW_REQUIRED');const rf=await this.revisionFragments(db,revision.id);const graph=await this.revisionGraph(db,revision.id);const target=await this.target(db,i.spaceId,revision.id,revision.body_hash,rf.map(r=>r.fragment_id),graph.conceptRevisionIds,graph.relationRevisionIds);requireThat(target.targetHash===meta.target_hash&&target.targetHash===i.reviewTargetHash,409,'EVIDENCE_CHANGED');const reviewId=randomUUID();const status=i.decision==='approve'?'reviewed':'draft';
  await db.query("UPDATE knowledge_entry_review_meta SET status=$2,reviewed_at=clock_timestamp(),reviewed_by=$3,reviewer_credential_id=$4,reviewer_epoch=$5,review_reason=$6,review_id=$7 WHERE revision_id=$1",[revision.id,status,ctx.actor.id,ctx.actor.credential_id,ctx.actor.epoch,i.reason,reviewId]);await db.query('INSERT INTO knowledge_entry_reviews(id,revision_id,reviewer_id,decision,reason,target_hash) VALUES($1,$2,$3,$4,$5,$6)',[reviewId,revision.id,ctx.actor.id,i.decision,i.reason,target.targetHash]);await this.kernel.event(db,'knowledge.entry.reviewed.v1',reviewId);return {entry:(await this.entryDTO(db,i.spaceId,page,revision,{body:true})).dto,reviewId,requestId:randomUUID()};
 }
 async conceptsList(db,ctx,i){const rows=(await db.query('SELECT c.id,c.space_id,c.revision,c.current_revision_id,r.label,r.parent_id,r.revision AS rv FROM knowledge_concepts c LEFT JOIN knowledge_concept_revisions r ON r.id=c.current_revision_id WHERE c.space_id=$1 AND c.id>$2 ORDER BY c.id LIMIT 101',[i.spaceId,i.after??''])).rows;return {items:rows.slice(0,100).map(r=>({conceptId:r.id,spaceId:r.space_id,label:r.label??'',parentId:r.parent_id??'',revisionId:r.current_revision_id,revision:r.rv??1})),...(rows.length>100&&{nextCursor:rows[99].id})};}
 async conceptUpsert(db,ctx,i){
  let concept;if(i.conceptId){concept=(await db.query('SELECT * FROM knowledge_concepts WHERE id=$1 AND space_id=$2 FOR UPDATE',[i.conceptId,i.spaceId])).rows[0];requireThat(concept,404,'NOT_FOUND');requireThat(concept.revision===i.expectedRevision,409,'VERSION_CONFLICT');}else{requireThat(i.expectedRevision===0,409,'VERSION_CONFLICT');concept=(await db.query('INSERT INTO knowledge_concepts(id,space_id,revision) VALUES($1,$2,0) RETURNING *',[randomUUID(),i.spaceId])).rows[0];}
  if(i.parentId){const p=(await db.query('SELECT * FROM knowledge_concepts WHERE id=$1 AND space_id=$2',[i.parentId,i.spaceId])).rows[0];requireThat(p,404,'NOT_FOUND');requireThat(i.parentId!==concept.id,409,'CONCEPT_CYCLE');let cur=p;const seen=new Set();while(cur?.current_revision_id){const rev=(await db.query('SELECT parent_id FROM knowledge_concept_revisions WHERE id=$1',[cur.current_revision_id])).rows[0];if(!rev?.parent_id)break;if(seen.has(rev.parent_id))break;seen.add(rev.parent_id);if(rev.parent_id===concept.id)requireThat(false,409,'CONCEPT_CYCLE');cur=(await db.query('SELECT * FROM knowledge_concepts WHERE id=$1',[rev.parent_id])).rows[0];}}
  const revision=concept.revision+1,revisionId=randomUUID(),contentHash=hashObj({label:i.label,parentId:i.parentId||'',spaceId:i.spaceId});await db.query('INSERT INTO knowledge_concept_revisions(id,concept_id,space_id,revision,label,parent_id,content_hash) VALUES($1,$2,$3,$4,$5,$6,$7)',[revisionId,concept.id,i.spaceId,revision,i.label,i.parentId||null,contentHash]);await db.query('UPDATE knowledge_concepts SET revision=$2,current_revision_id=$3 WHERE id=$1',[concept.id,revision,revisionId]);return {concept:{conceptId:concept.id,spaceId:i.spaceId,label:i.label,parentId:i.parentId||'',revisionId,revision},requestId:randomUUID()};
 }
 async relationUpsert(db,ctx,i){
  const from=(await db.query('SELECT * FROM knowledge_pages WHERE id=$1 AND space_id=$2',[i.fromEntryId,i.spaceId])).rows[0],to=(await db.query('SELECT * FROM knowledge_pages WHERE id=$1 AND space_id=$2',[i.toEntryId,i.spaceId])).rows[0];requireThat(from&&to&&from.id!==to.id,404,'NOT_FOUND');const fromRev=await this.latestRevision(db,from.id),toRev=await this.latestRevision(db,to.id);for(const id of i.evidenceFragmentIds){const f=await this.fragment(db,i.spaceId,id);requireThat(f.status==='accepted',409,'EVIDENCE_CHANGED');await this.validateSource(db,i.spaceId,f.source_id);}
  let relation;if(i.relationId){relation=(await db.query('SELECT * FROM knowledge_relations WHERE id=$1 AND space_id=$2 FOR UPDATE',[i.relationId,i.spaceId])).rows[0];requireThat(relation,404,'NOT_FOUND');requireThat(relation.revision===i.expectedRevision,409,'VERSION_CONFLICT');}else{requireThat(i.expectedRevision===0,409,'VERSION_CONFLICT');relation=(await db.query('INSERT INTO knowledge_relations(id,space_id,from_entry_id,to_entry_id,type,revision) VALUES($1,$2,$3,$4,$5,0) RETURNING *',[randomUUID(),i.spaceId,from.id,to.id,i.type])).rows[0];}
  const revision=relation.revision+1,revisionId=randomUUID(),contentHash=hashObj({from:fromRev.id,to:toRev.id,type:i.type,reason:i.reason,weight:i.weight,evidence:[...i.evidenceFragmentIds].sort()});await db.query('INSERT INTO knowledge_relation_revisions(id,relation_id,space_id,revision,from_entry_id,to_entry_id,from_entry_revision_id,to_entry_revision_id,type,reason,weight,content_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[revisionId,relation.id,i.spaceId,revision,from.id,to.id,fromRev.id,toRev.id,i.type,i.reason,i.weight,contentHash]);for(const id of i.evidenceFragmentIds)await db.query('INSERT INTO knowledge_relation_evidence(relation_revision_id,fragment_id,space_id) VALUES($1,$2,$3)',[revisionId,id,i.spaceId]);await db.query('UPDATE knowledge_relations SET revision=$2,current_revision_id=$3 WHERE id=$1',[relation.id,revision,revisionId]);return {relation:{relationId:relation.id,relationRevisionId:revisionId,fromEntryRevisionId:fromRev.id,toEntryRevisionId:toRev.id,type:i.type,reason:i.reason,weight:i.weight,revision},requestId:randomUUID()};
 }
 async dispatch(db,ctx,id,i){
  if(id==='knowledge.fragments.list.v1')return this.fragmentsList(db,ctx,i);
  if(id==='knowledge.fragments.review.v1')return this.fragmentsReview(db,ctx,i);
  if(id==='knowledge.entries.list.v1')return this.entryList(db,ctx,i);
  if(id==='knowledge.entries.get.v1')return this.entryGet(db,ctx,i);
  if(id==='knowledge.entries.draft.v1')return this.entryDraft(db,ctx,i);
  if(id==='knowledge.entries.submit.v1')return this.entrySubmit(db,ctx,i);
  if(id==='knowledge.entries.review.v1')return this.entryReview(db,ctx,i);
  if(id==='knowledge.entries.review-target.get.v1')return this.reviewTargetGet(db,ctx,i);
  if(id==='knowledge.concepts.list.v1')return this.conceptsList(db,ctx,i);
  if(id==='knowledge.concepts.upsert.v1')return this.conceptUpsert(db,ctx,i);
  if(id==='knowledge.relations.upsert.v1')return this.relationUpsert(db,ctx,i);
  requireThat(false,404,'NOT_FOUND');
 }
}
