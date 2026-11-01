import {randomUUID} from 'node:crypto';
import {requireThat} from '../../apps/control-api/src/errors.mjs';
import {digest} from '../access-management/service.mjs';
import {PrivateObjects} from './objects.mjs';
export const sourceDTO=s=>({id:s.id,documentId:s.document_id,spaceId:s.space_id,title:s.title,revision:s.ordinal,policyCode:s.policy_code,version:s.version,filename:s.filename,hash:s.object_hash,status:s.status,validFrom:s.valid_from.toISOString(),validUntil:s.valid_until?.toISOString()??'',createdAt:s.created_at.toISOString()});
const spaceDTO=s=>({id:s.id,title:s.title,departmentIds:s.department_ids,revision:s.revision});
export class KnowledgeService {
 constructor(kernel,objectRoot){this.kernel=kernel;this.objects=new PrivateObjects(objectRoot);}
 steward(ctx,spaceId){return ['knowledge:edit','knowledge:review','knowledge:publish'].some(p=>ctx.has(p,spaceId));}
 visible(ctx,space){return ctx.has('knowledge:read',space.id)&&(this.steward(ctx,space.id)||!space.department_ids.length||space.department_ids.some(id=>ctx.departments.includes(id)));}
 async authorize(db,ctx,command,i){
  if(i.spaceId){const space=(await db.query('SELECT * FROM knowledge_spaces WHERE id=$1',[i.spaceId])).rows[0];requireThat(space&&this.visible(ctx,space),404,'NOT_FOUND');}
  if(command.id==='knowledge.sources.list.v1')requireThat(this.steward(ctx,i.spaceId));
  if(i.view==='manage')requireThat(this.steward(ctx,i.spaceId));
 }
 async source(db,spaceId,id){const row=(await db.query('SELECT s.*,d.current_source_id,d.policy_code FROM knowledge_sources s JOIN knowledge_documents d ON d.id=s.document_id WHERE s.space_id=$1 AND s.id=$2',[spaceId,id])).rows[0];requireThat(row,404,'NOT_FOUND');return row;}
 async validSource(db,spaceId,id,{published=false,effective=true}={}){
  const s=await this.source(db,spaceId,id);requireThat(s.status==='active'&&(!effective||s.valid_from<=new Date())&&(!s.valid_until||s.valid_until>new Date()),409,'EVIDENCE_CHANGED');
  if(published)requireThat(s.current_source_id===s.id,409,'EVIDENCE_CHANGED');
  if(!published&&s.current_source_id&&s.current_source_id!==s.id){const current=await this.source(db,spaceId,s.current_source_id);requireThat(current.ordinal<=s.ordinal,409,'SOURCE_SUPERSEDED');}
  return s;
 }
 async evidence(db,ctx,spaceId,citations){
  requireThat(citations.length>0&&citations.length<=20,400,'INVALID_CITATION');const ids=[];
  for(const c of citations){
   const s=await this.validSource(db,spaceId,c.sourceId,{effective:false});const text=await this.objects.read(db,s.object_hash),lines=text.split('\n');
   requireThat(c.lineEnd>=c.lineStart&&c.lineEnd<=lines.length&&c.lineEnd-c.lineStart<=40,400,'INVALID_CITATION');
   const excerpt=lines.slice(c.lineStart-1,c.lineEnd).join('\n');requireThat(excerpt.includes(c.quote)&&c.quote.trim().length>0,400,'INVALID_CITATION');ids.push(s.id);
  }
  return [...new Set(ids)];
 }
 async revision(db,spaceId,id){const row=(await db.query('SELECT r.*,p.space_id,p.revision AS current_revision,p.published_revision_id FROM knowledge_revisions r JOIN knowledge_pages p ON p.id=r.page_id WHERE r.id=$1 AND p.space_id=$2',[id,spaceId])).rows[0];requireThat(row,404,'NOT_FOUND');return row;}
 async currentValid(db,r){try{for(const id of r.source_ids)await this.validSource(db,r.space_id,id,{published:true});return true;}catch(error){if(error.code==='EVIDENCE_CHANGED'||error.code==='NOT_FOUND')return false;throw error;}}
 async pageDTO(db,r,{body=false,manage=false}={}){
  const valid=manage?true:await this.currentValid(db,r);requireThat(valid,404,'NOT_FOUND');
  const result={pageId:r.page_id,spaceId:r.space_id,revisionId:r.id,title:r.title,revision:manage?r.current_revision:r.page_revision,pageState:manage?r.state:'published',sourceIds:r.source_ids,citations:r.citations};
  if(manage&&r.state==='published'&&!r.published_revision_id)result.pageState='withdrawn';
  else if(manage&&r.state==='published'&&!await this.currentValid(db,r))result.pageState='stale';
  if(body)result.body=await this.objects.read(db,r.body_hash);return result;
 }
 async page(db,spaceId,pageId,view){
  const page=(await db.query('SELECT * FROM knowledge_pages WHERE id=$1 AND space_id=$2',[pageId,spaceId])).rows[0];requireThat(page,404,'NOT_FOUND');
  let r;if(view==='published'){requireThat(page.published_revision_id,404,'NOT_FOUND');r=await this.revision(db,spaceId,page.published_revision_id);}
  else{const latest=(await db.query('SELECT id FROM knowledge_revisions WHERE page_id=$1 ORDER BY page_revision DESC LIMIT 1',[pageId])).rows[0];requireThat(latest,404,'NOT_FOUND');r=await this.revision(db,spaceId,latest.id);}
  return r;
 }
 async createDraft(db,ctx,i){
  const ids=await this.evidence(db,ctx,i.spaceId,i.citations);let page;
  if(i.pageId){page=(await db.query('SELECT * FROM knowledge_pages WHERE id=$1 AND space_id=$2',[i.pageId,i.spaceId])).rows[0];requireThat(page,404,'NOT_FOUND');requireThat(page.revision===i.expectedRevision,409,'VERSION_CONFLICT');}
  else{requireThat(i.expectedRevision===0,409,'VERSION_CONFLICT');page=(await db.query('INSERT INTO knowledge_pages(id,space_id) VALUES($1,$2) RETURNING *',[randomUUID(),i.spaceId])).rows[0];}
  requireThat(i.body.includes('[1]')&&[...i.body.matchAll(/\[(\d+)\]/g)].every(m=>Number(m[1])>=1&&Number(m[1])<=i.citations.length),400,'CITATION_MARKER_REQUIRED');
  const hash=await this.objects.put(db,i.body),id=randomUUID();
  const updated=(await db.query('UPDATE knowledge_pages SET revision=revision+1 WHERE id=$1 RETURNING revision',[page.id])).rows[0];
  await db.query('INSERT INTO knowledge_revisions(id,page_id,page_revision,title,body_hash,source_ids,citations) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,page.id,updated.revision,i.title,hash,ids,JSON.stringify(i.citations)]);
  for(const source of ids)await db.query('INSERT INTO knowledge_evidence(revision_id,source_id) VALUES($1,$2)',[id,source]);
  return this.pageDTO(db,await this.revision(db,i.spaceId,id),{body:true,manage:true});
 }
 async dispatch(db,ctx,id,i){
  if(id==='knowledge.spaces.list.v1'){
   const rows=(await db.query('SELECT * FROM knowledge_spaces WHERE id>$1 ORDER BY id LIMIT 101',[i.after??''])).rows;
   return {items:rows.slice(0,100).filter(s=>this.visible(ctx,s)).map(spaceDTO),...(rows.length>100&&{nextCursor:rows[99].id})};
  }
  if(id==='knowledge.spaces.create.v1'){
   for(const d of i.departmentIds)requireThat((await db.query('SELECT 1 FROM product_departments WHERE id=$1 AND active',[d])).rowCount,404,'NOT_FOUND');
   const row=(await db.query('INSERT INTO knowledge_spaces(id,title,department_ids) VALUES($1,$2,$3) RETURNING *',[randomUUID(),i.title,i.departmentIds])).rows[0];await this.kernel.event(db,'knowledge.space.created.v1',row.id);return spaceDTO(row);
  }
  if(id==='knowledge.sources.import.v1'){
   requireThat(/^[^/\\]{1,200}\.(?:md|txt)$/i.test(i.filename)&&[...i.filename].every(c=>c.codePointAt(0)>=32&&c.codePointAt(0)!==127),422,'FORMAT_NOT_IMPLEMENTED');
   requireThat(i.content.isWellFormed(),400,'INVALID_TEXT');const from=new Date(i.validFrom),until=i.validUntil?new Date(i.validUntil):null;
   requireThat(Number.isFinite(from.getTime())&&(!until||Number.isFinite(until.getTime())&&until>from),400,'INVALID_VALIDITY');
   let document=(await db.query('SELECT * FROM knowledge_documents WHERE space_id=$1 AND policy_code=$2',[i.spaceId,i.policyCode])).rows[0];
   if(!document)document=(await db.query('INSERT INTO knowledge_documents(id,space_id,policy_code) VALUES($1,$2,$3) RETURNING *',[randomUUID(),i.spaceId,i.policyCode])).rows[0];
   requireThat(!(await db.query('SELECT 1 FROM knowledge_sources WHERE document_id=$1 AND version=$2',[document.id,i.version])).rowCount,409,'SOURCE_VERSION_EXISTS');
   const ordinal=(await db.query('UPDATE knowledge_documents SET latest_counter=latest_counter+1 WHERE id=$1 RETURNING latest_counter',[document.id])).rows[0].latest_counter;
   const hash=await this.objects.put(db,i.content);
   const row=(await db.query('INSERT INTO knowledge_sources(id,document_id,space_id,title,ordinal,version,filename,object_hash,valid_from,valid_until) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',[randomUUID(),document.id,i.spaceId,i.title,ordinal,i.version,i.filename,hash,from,until])).rows[0];
   await this.kernel.event(db,'knowledge.source.changed.v1',row.id);return sourceDTO({...row,policy_code:i.policyCode});
  }
  if(id==='knowledge.sources.list.v1'){
   const rows=(await db.query('SELECT s.*,d.policy_code FROM knowledge_sources s JOIN knowledge_documents d ON d.id=s.document_id WHERE s.space_id=$1 AND s.id>$2 ORDER BY s.id LIMIT 101',[i.spaceId,i.after??''])).rows;
   return {items:rows.slice(0,100).map(sourceDTO),...(rows.length>100&&{nextCursor:rows[99].id})};
  }
  if(id==='knowledge.sources.get.v1'){
   const s=await this.source(db,i.spaceId,i.sourceId);
   if(!this.steward(ctx,i.spaceId)){
    try{await this.validSource(db,i.spaceId,s.id,{published:true});}catch{requireThat(false,404,'NOT_FOUND');}
    const links=(await db.query('SELECT p.published_revision_id FROM knowledge_pages p JOIN knowledge_evidence e ON e.revision_id=p.published_revision_id WHERE p.space_id=$1 AND e.source_id=$2',[i.spaceId,s.id])).rows;
    let visible=false;for(const link of links)if(await this.currentValid(db,await this.revision(db,i.spaceId,link.published_revision_id)))visible=true;
    requireThat(visible,404,'NOT_FOUND');
   }
   return {source:sourceDTO(s),content:await this.objects.read(db,s.object_hash)};
  }
  if(id==='knowledge.sources.withdraw.v1'){const s=await this.source(db,i.spaceId,i.sourceId);await db.query("UPDATE knowledge_sources SET status='withdrawn' WHERE id=$1",[s.id]);await this.kernel.event(db,'knowledge.source.withdrawn.v1',s.id);return {withdrawn:true};}
  if(id==='knowledge.changes.create.v1')return this.createDraft(db,ctx,i);
  if(id==='knowledge.changes.review.v1'){
   requireThat(ctx.actor.kind==='user'&&ctx.actor.scopes.includes('product:approve'));
   const r=await this.revision(db,i.spaceId,i.revisionId);requireThat(r.current_revision===i.expectedRevision&&r.page_revision===i.expectedRevision,409,'VERSION_CONFLICT');
   requireThat(r.state!=='published',409,'ALREADY_PUBLISHED');
   await this.evidence(db,ctx,i.spaceId,r.citations);
   const hash=digest({bodyHash:r.body_hash,citations:r.citations,sourceIds:r.source_ids});
   await db.query('UPDATE knowledge_revisions SET state=$2,reviewed_by=$3,reviewer_credential_id=$4,reviewer_epoch=$5,review_hash=$6,reviewed_at=clock_timestamp() WHERE id=$1',[r.id,i.decision==='approve'?'reviewed':'draft',ctx.actor.id,ctx.actor.credential_id,ctx.actor.epoch,hash]);
   await db.query('INSERT INTO knowledge_reviews(id,revision_id,reviewer_id,decision,reason,review_hash) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),r.id,ctx.actor.id,i.decision,i.reason,hash]);
   await db.query('INSERT INTO audit(actor_id,action,resource_id,result) VALUES($1,$2,$3,$4)',[ctx.actor.id,'knowledge.review',r.id,i.decision]);
   return this.pageDTO(db,await this.revision(db,i.spaceId,r.id),{manage:true});
  }
  if(id==='knowledge.publications.publish.v1'){
   const r=await this.revision(db,i.spaceId,i.revisionId);requireThat(r.current_revision===i.expectedRevision&&r.page_revision===i.expectedRevision,409,'VERSION_CONFLICT');
   requireThat(r.state==='reviewed'&&r.review_hash===digest({bodyHash:r.body_hash,citations:r.citations,sourceIds:r.source_ids}),409,'REVIEW_REQUIRED');
   const reviewer=(await db.query('SELECT p.*,c.revoked FROM principals p JOIN credentials c ON c.principal_id=p.id WHERE p.id=$1 AND c.id=$2',[r.reviewed_by,r.reviewer_credential_id])).rows[0];
   requireThat(reviewer?.active&&!reviewer.revoked&&reviewer.epoch===r.reviewer_epoch,409,'REVIEW_REQUIRED');
   const hasReview=(await db.query("SELECT 1 FROM product_bindings b JOIN product_roles role ON role.id=b.role_id WHERE b.principal_id=$1 AND role.permissions @> ARRAY['knowledge:review'] AND (b.scope_id='*' OR b.scope_id=$2)",[r.reviewed_by,i.spaceId])).rowCount;requireThat(hasReview,409,'REVIEW_REQUIRED');
   for(const source of r.source_ids){const s=await this.validSource(db,i.spaceId,source);await db.query('UPDATE knowledge_documents SET current_source_id=$2 WHERE id=$1',[s.document_id,s.id]);}
   await db.query("UPDATE knowledge_revisions SET state='published' WHERE id=$1",[r.id]);
   await db.query('UPDATE knowledge_pages SET published_revision_id=$2 WHERE id=$1',[r.page_id,r.id]);
   await db.query("INSERT INTO knowledge_publications(id,page_id,revision_id,publisher_id,approval_id,state) VALUES($1,$2,$3,$4,$5,'published')",[randomUUID(),r.page_id,r.id,ctx.actor.id,i.approvalId]);
   await this.kernel.event(db,'knowledge.publication.published.v1',r.page_id);return this.pageDTO(db,await this.revision(db,i.spaceId,r.id));
  }
  if(id==='knowledge.publications.withdraw.v1'){
   const p=await this.page(db,i.spaceId,i.pageId,'published');requireThat(p.current_revision===i.expectedRevision,409,'VERSION_CONFLICT');
   await db.query('UPDATE knowledge_pages SET published_revision_id=NULL,revision=revision+1 WHERE id=$1',[p.page_id]);
   await db.query("INSERT INTO knowledge_publications(id,page_id,revision_id,publisher_id,approval_id,state) VALUES($1,$2,$3,$4,$5,'withdrawn')",[randomUUID(),p.page_id,p.id,ctx.actor.id,i.approvalId]);await this.kernel.event(db,'knowledge.publication.withdrawn.v1',p.page_id);return {withdrawn:true};
  }
  if(id==='knowledge.pages.get.v1')return this.pageDTO(db,await this.page(db,i.spaceId,i.pageId,i.view),{body:true,manage:i.view==='manage'});
  if(id==='knowledge.pages.list.v1'){
   const rows=(await db.query("SELECT * FROM knowledge_pages WHERE space_id=$1 AND id>$2 AND ($3='manage' OR published_revision_id IS NOT NULL) ORDER BY id LIMIT 101",[i.spaceId,i.after??'',i.view])).rows;
   const items=[];for(const p of rows.slice(0,100)){const r=await this.page(db,i.spaceId,p.id,i.view);if(i.view==='manage'||await this.currentValid(db,r))items.push(await this.pageDTO(db,r,{manage:i.view==='manage'}));}
   return {items,...(rows.length>100&&{nextCursor:rows[99].id})};
  }
  if(id==='knowledge.search.v1')return {items:await this.search(db,ctx,i.spaceId,i.query),query:i.query};
  if(id==='knowledge.quality.get.v1'){
   const pages=(await db.query('SELECT id FROM knowledge_pages WHERE space_id=$1 AND id>$2 ORDER BY id LIMIT 101',[i.spaceId,i.after??''])).rows,items=[];
   for(const p of pages.slice(0,100)){const r=await this.page(db,i.spaceId,p.id,'manage');let code=r.state==='draft'?'DRAFT_REQUIRES_REVIEW':r.state==='reviewed'?'READY_FOR_PUBLICATION':'CURRENT';try{for(const sid of r.source_ids)await this.validSource(db,i.spaceId,sid,{published:r.state==='published',effective:r.state==='published'});}catch{code='EVIDENCE_CHANGED';}if(code!=='CURRENT')items.push({pageId:p.id,title:r.title,code});}
   return {items,...(pages.length>100&&{nextCursor:pages[99].id})};
  }
  requireThat(false,404,'NOT_FOUND');
 }
 async search(db,ctx,spaceId,query){
  requireThat(query.trim().length>0,400,'INVALID_INPUT');const pages=(await db.query('SELECT id FROM knowledge_pages WHERE space_id=$1 AND published_revision_id IS NOT NULL ORDER BY id LIMIT 501',[spaceId])).rows;requireThat(pages.length<=500,503,'SEARCH_CAPACITY_EXCEEDED');
  const normalized=query.normalize('NFKC').toLocaleLowerCase(),tokens=new Set(normalized.match(/[a-z0-9]+|[\u3400-\u9fff]/g)??[]);const results=[];
  for(const p of pages){const r=await this.page(db,spaceId,p.id,'published');if(!await this.currentValid(db,r))continue;const body=await this.objects.read(db,r.body_hash),text=(r.title+'\n'+body).normalize('NFKC').toLocaleLowerCase();let score=text.includes(normalized)?10:0;for(const token of tokens)if(text.includes(token))score++;
   if(score){const start=Math.max(0,text.indexOf(normalized)-40);results.push({...await this.pageDTO(db,r),excerpt:body.slice(start,start+350),score});}
  }
  return results.sort((a,b)=>b.score-a.score||a.pageId.localeCompare(b.pageId)).slice(0,100).map(item=>{const result={...item};delete result.score;return result;});
 }
}
