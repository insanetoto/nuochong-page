import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {cpSync,mkdtempSync,readFileSync,rmSync,unlinkSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {poolFor,migrate} from '../src/db.mjs';
import {PrivateObjects} from '../../../plugins/knowledge/objects.mjs';
import {backfillV0Fragments,legacyCitationFragments,paragraphRanges} from '../../../plugins/knowledge/backfill.mjs';
import {knowledgeFixture} from './knowledge-fixture.mjs';

const databaseURL=process.env.TEST_DATABASE_URL;
assert.ok(databaseURL,'TEST_DATABASE_URL must point to an isolated real PostgreSQL database.');
const sourceFiles={1:'schema.sql',2:'migrations/002-product-access.sql',3:'migrations/003-knowledge.sql',4:'migrations/004-product-jobs.sql'};
const hash=text=>createHash('sha256').update(text,'utf8').digest('hex');
async function assertForeignKeysIntact(pool,schema){
 const foreignKeys=(await pool.query(`SELECT c.conname,t.relname AS child,c.conkey,c.confkey,pt.relname AS parent
  FROM pg_constraint c
  JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
  JOIN pg_class pt ON pt.oid=c.confrelid
  WHERE c.contype='f' AND n.nspname=$1`,[schema])).rows;
 const names=async(relid,keys)=>(await pool.query(`SELECT a.attname FROM unnest($2::smallint[]) WITH ORDINALITY k(attnum,ord)
  JOIN pg_attribute a ON a.attrelid=$1 AND a.attnum=k.attnum ORDER BY k.ord`,[relid,keys])).rows.map(row=>row.attname);
 for(const fk of foreignKeys){
  const childColumns=await names((await pool.query('SELECT $1::regclass::oid AS oid',[`${schema}.${fk.child}`])).rows[0].oid,fk.conkey);
  const parentColumns=await names((await pool.query('SELECT $1::regclass::oid AS oid',[`${schema}.${fk.parent}`])).rows[0].oid,fk.confkey);
  const join=childColumns.map((column,index)=>`c."${column}"=p."${parentColumns[index]}"`).join(' AND ');
  const nonNull=childColumns.map(column=>`c."${column}" IS NOT NULL`).join(' AND ');
  const count=(await pool.query(`SELECT count(*)::int AS n FROM ${schema}.${fk.child} c LEFT JOIN ${schema}.${fk.parent} p ON ${join} WHERE ${nonNull} AND p."${parentColumns[0]}" IS NULL`)).rows[0].n;
  assert.equal(count,0,`FK_VIOLATION ${fk.conname}: ${count} dangling rows`);
 }
}
const tempRoot=()=>mkdtempSync(join(tmpdir(),'knowledge-v2-migration-'));

async function v0Schema(t,{data=true}={}){
 const schema='oa_v0_'+randomUUID().replaceAll('-','').slice(0,28);
 const pool=poolFor(databaseURL,schema);t.after(async()=>{await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await pool.end();});
 await pool.query(`CREATE SCHEMA ${schema}`);
 await pool.query('CREATE TABLE schema_versions(version integer PRIMARY KEY,sha256 text NOT NULL)');
 for(const [version,file] of Object.entries(sourceFiles)){
  const source=readFileSync(new URL('../src/'+file,import.meta.url),'utf8');
  await pool.query(source);
  await pool.query('INSERT INTO schema_versions(version,sha256) VALUES($1,$2)',[Number(version),hash(source)]);
 }
 if(!data)return {pool,schema};
 const root=tempRoot();t.after(()=>rmSync(root,{recursive:true,force:true}));
 const objects=new PrivateObjects(root);const content='# 合成制度\n出差需先审批。\n报销应提交发票。';
 const body='出差应先审批。[1]';const contentHash=await objects.put(pool,content),bodyHash=await objects.put(pool,body);
 const spaceId='space-'+randomUUID(),documentId='doc-'+randomUUID(),sourceId='source-'+randomUUID(),pageId='page-'+randomUUID(),revisionId='revision-'+randomUUID();
 await pool.query('INSERT INTO knowledge_spaces(id,title,department_ids) VALUES($1,$2,$3)',[spaceId,'Synthetic v0 space',[]]);
 await pool.query('INSERT INTO knowledge_documents(id,space_id,policy_code) VALUES($1,$2,$3)',[documentId,spaceId,'DEMO-001']);
 await pool.query(`INSERT INTO knowledge_sources(id,document_id,space_id,title,ordinal,version,filename,object_hash,status,valid_from)
  VALUES($1,$2,$3,$4,1,'1','policy.md',$5,'active','2020-01-01T00:00:00Z')`,[sourceId,documentId,spaceId,'Synthetic travel policy',contentHash]);
 await pool.query('INSERT INTO knowledge_pages(id,space_id,revision,published_revision_id) VALUES($1,$2,1,NULL)',[pageId,spaceId]);
 const citations=[{sourceId,lineStart:2,lineEnd:2,quote:'出差需先审批。'}];
 await pool.query(`INSERT INTO knowledge_revisions(id,page_id,page_revision,title,body_hash,source_ids,citations,state)
  VALUES($1,$2,1,$3,$4,$5,$6,'draft')`,[revisionId,pageId,'出差审批指南',bodyHash,[sourceId],JSON.stringify(citations)]);
 return {pool,schema,root,objects,content,body,contentHash,bodyHash,spaceId,documentId,sourceId,pageId,revisionId,citations};
}

test('paragraph ranges preserve one-based source lines and exact excerpts',()=>{
 assert.deepEqual(paragraphRanges('a\n\nb'),[{lineStart:1,lineEnd:1,excerpt:'a'},{lineStart:3,lineEnd:3,excerpt:'b'}]);
 assert.deepEqual(paragraphRanges('a\nb\n\nc'),[{lineStart:1,lineEnd:2,excerpt:'a\nb'},{lineStart:4,lineEnd:4,excerpt:'c'}]);
 assert.deepEqual(paragraphRanges('a\n\n'),[{lineStart:1,lineEnd:1,excerpt:'a'}]);
 assert.deepEqual(paragraphRanges('   \n\n'),[]);
});

test('005 applies additively to a synthetic v0 schema and backfills paragraphs idempotently',async(t)=>{
 const f=await v0Schema(t);
 await migrate(f.pool,f.schema);
 assert.equal((await f.pool.query('SELECT version FROM schema_versions WHERE version=5')).rowCount,1);
 assert.equal((await f.pool.query("SELECT entry_type FROM knowledge_pages WHERE id=$1",[f.pageId])).rows[0].entry_type,'policy');
 assert.match((await f.pool.query('SELECT code FROM knowledge_spaces WHERE id=$1',[f.spaceId])).rows[0].code,/^SPACE-/);
 assert.equal((await f.pool.query('SELECT allow_self_publish FROM knowledge_spaces WHERE id=$1',[f.spaceId])).rows[0].allow_self_publish,false);
 const newSpace='space-new-'+randomUUID();await f.pool.query('INSERT INTO knowledge_spaces(id,title) VALUES($1,$2)',[newSpace,'New v0 space']);
 assert.match((await f.pool.query('SELECT code FROM knowledge_spaces WHERE id=$1',[newSpace])).rows[0].code,/^SPACE-/);
 assert.equal((await f.pool.query('SELECT count(*)::int n FROM knowledge_space_policy_revisions WHERE space_id=$1',[newSpace])).rows[0].n,1);
 const first=await backfillV0Fragments(f.pool,{objectRoot:f.root,spaceId:f.spaceId});
 assert.equal(first.sources,1);assert.equal(first.fragmentsInserted,1);
 const second=await backfillV0Fragments(f.pool,{objectRoot:f.root,spaceId:f.spaceId});
 assert.equal(second.fragmentsInserted,0);
 assert.equal((await f.pool.query('SELECT count(*)::int n FROM knowledge_fragments WHERE source_id=$1',[f.sourceId])).rows[0].n,1);
 const fragments=await legacyCitationFragments(f.pool,{spaceId:f.spaceId,sourceId:f.sourceId,lineStart:2,lineEnd:2});
 assert.equal(fragments.length,1);assert.match(fragments[0].excerpt,/出差需先审批/);assert.equal(fragments[0].locator.lineStart,1);assert.equal(fragments[0].locator.lineEnd,3);
 const old=await f.pool.query('SELECT body_hash,citations FROM knowledge_revisions WHERE id=$1',[f.revisionId]);
 assert.equal(readFileSync(join(f.root,old.rows[0].body_hash),'utf8'),f.body);
 assert.deepEqual(old.rows[0].citations,f.citations);
});

test('005 failure rolls back atomically and can be retried',async(t)=>{
 const f=await v0Schema(t,{data:false});
 await f.pool.query('CREATE TABLE knowledge_fragments(id text PRIMARY KEY)');
 await assert.rejects(migrate(f.pool,f.schema),/knowledge_fragments/);
 assert.equal((await f.pool.query('SELECT 1 FROM schema_versions WHERE version=5')).rowCount,0);
 assert.equal((await f.pool.query('SELECT to_regclass($1) AS t',[`${f.schema}.knowledge_pages`])).rows[0].t!==null,true);
 await f.pool.query('DROP TABLE knowledge_fragments');
 await migrate(f.pool,f.schema);
 assert.equal((await f.pool.query('SELECT 1 FROM schema_versions WHERE version=5')).rowCount,1);
 assert.equal((await f.pool.query('SELECT to_regclass($1) AS t',[`${f.schema}.knowledge_fragments`])).rows[0].t!==null,true);
});

test('backfill failure leaves completed sources committed and reruns without duplicates',async(t)=>{
 const f=await v0Schema(t);
 await migrate(f.pool,f.schema);
 const secondId='z-source-'+randomUUID(),secondHash=hash('second source');
 await f.pool.query(`INSERT INTO knowledge_objects(hash,size_bytes) VALUES($1,$2)`,[secondHash,13]);
 await f.pool.query(`INSERT INTO knowledge_sources(id,document_id,space_id,title,ordinal,version,filename,object_hash,status,valid_from)
  VALUES($1,$2,$3,'Second source',2,'2','second.md',$4,'active','2020-01-01T00:00:00Z')`,[secondId,f.documentId,f.spaceId,secondHash]);
 await assert.rejects(backfillV0Fragments(f.pool,{objectRoot:f.root}),/OBJECT_MISSING/);
 assert.equal((await f.pool.query('SELECT count(*)::int n FROM knowledge_fragments WHERE source_id=$1',[f.sourceId])).rows[0].n,1);
 assert.equal((await f.pool.query('SELECT count(*)::int n FROM knowledge_fragments WHERE source_id=$1',[secondId])).rows[0].n,0);
 writeFileSync(join(f.root,secondHash),'second source',{mode:0o600});
 const rerun=await backfillV0Fragments(f.pool,{objectRoot:f.root});
 assert.equal(rerun.fragmentsInserted,1);
 assert.equal((await f.pool.query('SELECT count(*)::int n FROM knowledge_fragments WHERE source_id=$1',[f.sourceId])).rows[0].n,1);
 assert.equal((await f.pool.query('SELECT count(*)::int n FROM knowledge_fragments WHERE source_id=$1',[secondId])).rows[0].n,1);
});

test('object copy restores readable bytes without changing fragment references',async(t)=>{
 const f=await v0Schema(t);await migrate(f.pool,f.schema);await backfillV0Fragments(f.pool,{objectRoot:f.root});
 const backup=mkdtempSync(join(tmpdir(),'knowledge-v2-object-backup-'));t.after(()=>rmSync(backup,{recursive:true,force:true}));
 cpSync(f.root,backup,{recursive:true});
 const objects=new PrivateObjects(f.root);unlinkSync(join(f.root,f.contentHash));
 await assert.rejects(objects.read(f.pool,f.contentHash),/OBJECT_MISSING/);
 cpSync(join(backup,f.contentHash),join(f.root,f.contentHash));
 assert.equal(await objects.read(f.pool,f.contentHash),f.content);
 assert.equal((await f.pool.query('SELECT count(*)::int n FROM knowledge_fragments WHERE source_id=$1',[f.sourceId])).rows[0].n,1);
});

test('data constraints reject invalid relations, cross-space evidence and supersession order',async(t)=>{
 const f=await v0Schema(t);await migrate(f.pool,f.schema);
 const pageB='page-'+randomUUID(),revisionB='revision-'+randomUUID(),spaceB='space-'+randomUUID(),sourceB='source-'+randomUUID(),documentB='doc-'+randomUUID(),fragmentB='fragment-'+randomUUID();
 const bodyB=await f.objects.put(f.pool,'第二空间正文');
 const contentB=await f.objects.put(f.pool,'第二空间制度');
 await f.pool.query('INSERT INTO knowledge_spaces(id,title,department_ids) VALUES($1,$2,$3)',[spaceB,'Second space',[]]);
 await f.pool.query('INSERT INTO knowledge_documents(id,space_id,policy_code) VALUES($1,$2,$3)',[documentB,spaceB,'DEMO-B']);
 await f.pool.query(`INSERT INTO knowledge_sources(id,document_id,space_id,title,ordinal,version,filename,object_hash,status,valid_from)
  VALUES($1,$2,$3,'Second source',1,'1','b.md',$4,'active','2020-01-01T00:00:00Z')`,[sourceB,documentB,spaceB,contentB]);
 await f.pool.query('INSERT INTO knowledge_pages(id,space_id,revision) VALUES($1,$2,1)',[pageB,spaceB]);
 await f.pool.query(`INSERT INTO knowledge_revisions(id,page_id,page_revision,title,body_hash,source_ids,citations,state)
  VALUES($1,$2,1,'Second entry',$3,$4,'[]','draft')`,[revisionB,pageB,bodyB,[sourceB]]);
 await f.pool.query(`INSERT INTO knowledge_fragments(id,space_id,source_id,source_revision,locator,locator_key,excerpt,text_hash,status,revision)
  VALUES($1,$2,$3,1,'{"type":"line","lineStart":1,"lineEnd":1}'::jsonb,'line:1:1','second',repeat('b',64),'pending',1)`,[fragmentB,spaceB,sourceB]);

 await assert.rejects(f.pool.query(`INSERT INTO knowledge_relations(id,space_id,from_entry_id,to_entry_id,type,revision)
  VALUES('self-relation',$1,$2,$2,'relatedTo',1)`,[f.spaceId,f.pageId]),/check/i);

 const relationId='relation-'+randomUUID(),relationRevision='relation-revision-'+randomUUID();
 await f.pool.query(`INSERT INTO knowledge_relations(id,space_id,from_entry_id,to_entry_id,type,revision)
  VALUES($1,$2,$3,$4,'relatedTo',1)`,[relationId,f.spaceId,f.pageId,pageB]);
 await f.pool.query(`INSERT INTO knowledge_relation_revisions(id,relation_id,space_id,revision,from_entry_id,to_entry_id,from_entry_revision_id,to_entry_revision_id,type,reason,weight,content_hash)
  VALUES($1,$2,$3,1,$4,$5,$6,$7,'relatedTo','cross-space synthetic',50,repeat('a',64))`,[relationRevision,relationId,f.spaceId,f.pageId,pageB,f.revisionId,revisionB]);
 await assert.rejects(f.pool.query(`INSERT INTO knowledge_relation_evidence(relation_revision_id,fragment_id,space_id)
  VALUES($1,$2,$3)`,[relationRevision,fragmentB,f.spaceId]),/foreign key|violates/i);
 await assert.rejects(f.pool.query(`INSERT INTO knowledge_relation_revisions(id,relation_id,space_id,revision,from_entry_id,to_entry_id,from_entry_revision_id,to_entry_revision_id,type,reason,weight,content_hash)
  VALUES($1,$2,$3,2,$4,$5,$6,$7,'conflictsWith','wrong type',50,repeat('a',64))`,[randomUUID(),relationId,f.spaceId,f.pageId,pageB,f.revisionId,revisionB]),/foreign key|violates/i);
 await assert.rejects(f.pool.query(`INSERT INTO knowledge_relation_revisions(id,relation_id,space_id,revision,from_entry_id,to_entry_id,from_entry_revision_id,to_entry_revision_id,type,reason,weight,content_hash)
  VALUES($1,$2,$3,3,$4,$5,$6,$7,'relatedTo','swapped endpoints',50,repeat('a',64))`,[randomUUID(),relationId,f.spaceId,pageB,f.pageId,revisionB,f.revisionId]),/foreign key|violates/i);
 await assert.rejects(f.pool.query("UPDATE knowledge_relation_revisions SET reason='changed' WHERE id=$1",[relationRevision]),/IMMUTABLE_REVISION|check/i);
 await assert.rejects(f.pool.query('UPDATE knowledge_relations SET from_entry_id=$2 WHERE id=$1',[relationId,pageB]),/IMMUTABLE_RELATION_IDENTITY|check/i);

 const revision2='revision-'+randomUUID();
 await f.pool.query(`INSERT INTO knowledge_revisions(id,page_id,page_revision,title,body_hash,source_ids,citations,state)
  VALUES($1,$2,2,'Second revision',$3,$4,'[]','draft')`,[revision2,f.pageId,f.bodyHash,[f.sourceId]]);
 await f.pool.query(`INSERT INTO knowledge_entry_supersessions(id,space_id,entry_id,from_revision_id,to_revision_id)
  VALUES($1,$2,$3,$4,$5)`,[randomUUID(),f.spaceId,f.pageId,f.revisionId,revision2]);
 await assert.rejects(f.pool.query(`INSERT INTO knowledge_entry_supersessions(id,space_id,entry_id,from_revision_id,to_revision_id)
  VALUES($1,$2,$3,$4,$5)`,[randomUUID(),f.spaceId,f.pageId,revision2,f.revisionId]),/SUPERSESSION_ORDER_INVALID|check/i);
 await assert.rejects(f.pool.query(`INSERT INTO knowledge_entry_supersessions(id,space_id,entry_id,from_revision_id,to_revision_id)
  VALUES($1,$2,$3,$4,$4)`,[randomUUID(),f.spaceId,f.pageId,revision2]),/SUPERSESSION_ORDER_INVALID|check|foreign key/i);
 await assert.rejects(f.pool.query(`INSERT INTO knowledge_entry_supersessions(id,space_id,entry_id,from_revision_id,to_revision_id)
  VALUES($1,$2,$3,$4,$5)`,[randomUUID(),f.spaceId,f.pageId,f.revisionId,revisionB]),/SUPERSESSION_ORDER_INVALID|foreign key|violates/i);
 await assert.rejects(f.pool.query("UPDATE knowledge_entry_supersessions SET to_revision_id=$2 WHERE entry_id=$1",[f.pageId,revisionB]),/IMMUTABLE_REVISION|check/i);
 await assert.rejects(f.pool.query('DELETE FROM knowledge_entry_supersessions WHERE entry_id=$1',[f.pageId]),/IMMUTABLE_REVISION|check/i);
});


test('v0 read paths and reader restrictions survive 005 and backfill',async(t)=>{
 const f=await knowledgeFixture(t);const source=await f.ingest();const page=await f.draft(source);await f.review(page);await f.publish(page);const reader=await f.reader();
 const before=await f.call('knowledge.pages.get.v1',{spaceId:f.spaceId,pageId:page.pageId,view:'published'},reader.token);
 await backfillV0Fragments(f.pool,{objectRoot:f.root,spaceId:f.spaceId});
 const after=await f.call('knowledge.pages.get.v1',{spaceId:f.spaceId,pageId:page.pageId,view:'published'},reader.token);
 assert.deepEqual(after.data,before.data);
 assert.equal((await f.call('knowledge.pages.get.v1',{spaceId:f.spaceId,pageId:page.pageId,view:'manage'},reader.token)).status,403);
 assert.equal((await f.call('knowledge.sources.list.v1',{spaceId:f.spaceId},reader.token)).status,403);
});

test('full knowledge schema restore preserves identity, approvals, snapshots and object references',{timeout:30000},async(t)=>{
 const f=await v0Schema(t);await migrate(f.pool,f.schema);
 const principal='principal-'+randomUUID(),credential='credential-'+randomUUID(),approval='approval-'+randomUUID(),publication='publication-'+randomUUID(),snapshotId='snapshot-'+randomUUID(),conceptId='concept-'+randomUUID(),conceptRevision='concept-revision-'+randomUUID(),assignmentId='assignment-'+randomUUID();
 await f.pool.query("INSERT INTO principals(id,name,kind,role) VALUES($1,'restore-admin','user','admin')",[principal]);
 await f.pool.query(`INSERT INTO credentials(id,principal_id,token_hash,principal_epoch,scopes,expires_at)
  VALUES($1,$2,repeat('a',64),1,$3,clock_timestamp()+interval '1 day')`,[credential,principal,['product:read','product:write','product:approve']]);
 await f.pool.query(`INSERT INTO product_approvals(id,command_id,target_hash,scope_id,approver_id,credential_id,expires_at,used,reason)
  VALUES($1,'knowledge.publications.publish.v1',repeat('b',64),$2,$3,$4,clock_timestamp()+interval '1 day',true,'synthetic restore approval')`,[approval,f.spaceId,principal,credential]);
 await f.pool.query("UPDATE knowledge_revisions SET state='published',reviewed_by=$1,reviewer_credential_id=$2,reviewer_epoch=1,review_hash=repeat('c',64) WHERE id=$3",[principal,credential,f.revisionId]);
 await f.pool.query('UPDATE knowledge_pages SET published_revision_id=$1 WHERE id=$2',[f.revisionId,f.pageId]);
 await f.pool.query(`INSERT INTO knowledge_publications(id,page_id,revision_id,publisher_id,approval_id,state)
  VALUES($1,$2,$3,$4,$5,'published')`,[publication,f.pageId,f.revisionId,principal,approval]);
 await f.pool.query(`INSERT INTO knowledge_publication_snapshots(id,space_id,manifest,graph_hash,policy_revision,approval_id,effective_at,current)
  VALUES($1,$2,$3,repeat('d',64),1,$4,clock_timestamp(),true)`,[snapshotId,f.spaceId,JSON.stringify({version:1,entries:[f.revisionId],sources:[f.sourceId]}),approval]);
 await f.pool.query('UPDATE knowledge_publications SET snapshot_id=$1 WHERE id=$2',[snapshotId,publication]);
 await f.pool.query('INSERT INTO knowledge_concepts(id,space_id) VALUES($1,$2)',[conceptId,f.spaceId]);
 await f.pool.query(`INSERT INTO knowledge_concept_revisions(id,concept_id,space_id,revision,label,content_hash)
  VALUES($1,$2,$3,1,'Synthetic concept',repeat('e',64))`,[conceptRevision,conceptId,f.spaceId]);
 await f.pool.query(`INSERT INTO knowledge_entry_concept_assignments(id,space_id,entry_id,concept_id,concept_revision_id,revision,status,content_hash)
  VALUES($1,$2,$3,$4,$5,1,'confirmed',repeat('f',64))`,[assignmentId,f.spaceId,f.pageId,conceptId,conceptRevision]);
 await f.pool.query(`INSERT INTO knowledge_capabilities(capability_id,version,status,contract_ref) VALUES('knowledge.search@1',1,'active','synthetic://knowledge.search@1')`);
 await f.pool.query(`INSERT INTO knowledge_publication_capabilities(snapshot_id,capability_id,capability_version,status)
  VALUES($1,'knowledge.search@1',1,'active')`,[snapshotId]);
 await backfillV0Fragments(f.pool,{objectRoot:f.root,spaceId:f.spaceId});
 const tables=['principals','credentials','product_approvals','knowledge_objects','knowledge_spaces','knowledge_space_policy_revisions','knowledge_documents','knowledge_sources','knowledge_pages','knowledge_revisions','knowledge_evidence','knowledge_publications','knowledge_reviews','knowledge_fragments','knowledge_entry_fragments','knowledge_concepts','knowledge_concept_revisions','knowledge_entry_concept_assignments','knowledge_relations','knowledge_relation_revisions','knowledge_relation_evidence','knowledge_entry_supersessions','knowledge_import_batches','knowledge_import_files','knowledge_publication_snapshots','knowledge_capabilities','knowledge_publication_capabilities'];
 const backup={};for(const table of tables)backup[table]=(await f.pool.query(`SELECT * FROM ${table}`)).rows;
 const objectBackup=mkdtempSync(join(tmpdir(),'knowledge-v2-db-backup-'));t.after(()=>rmSync(objectBackup,{recursive:true,force:true}));cpSync(f.root,objectBackup,{recursive:true});
 const superuser=(await f.pool.query("SELECT rolsuper FROM pg_roles WHERE rolname=current_user")).rows[0].rolsuper;
 if(!superuser){t.skip('logical restore requires an isolated superuser test role');return;}
 await f.pool.query(`DROP SCHEMA ${f.schema} CASCADE`);await migrate(f.pool,f.schema);
 const client=await f.pool.connect();
 try{
  await client.query('SET session_replication_role=replica');
  for(const table of tables)await client.query(`INSERT INTO ${table} SELECT * FROM jsonb_populate_recordset(NULL::${table},$1::jsonb)`,[JSON.stringify(backup[table])]);
  await client.query('SET session_replication_role=origin');
  await assertForeignKeysIntact(client,f.schema);
 }finally{client.release();}
 const restored=await f.pool.query(`SELECT p.published_revision_id,r.title,r.citations,pub.publisher_id,pub.approval_id,pub.snapshot_id
  FROM knowledge_pages p JOIN knowledge_revisions r ON r.id=p.published_revision_id JOIN knowledge_publications pub ON pub.revision_id=r.id WHERE p.id=$1`,[f.pageId]);
 assert.equal(restored.rows[0].title,'出差审批指南');assert.deepEqual(restored.rows[0].citations,f.citations);assert.equal(restored.rows[0].publisher_id,principal);assert.equal(restored.rows[0].approval_id,approval);assert.equal(restored.rows[0].snapshot_id,snapshotId);
 assert.equal((await f.pool.query('SELECT count(*)::int n FROM knowledge_fragments WHERE source_id=$1',[f.sourceId])).rows[0].n,1);
 assert.equal((await f.pool.query('SELECT count(*)::int n FROM knowledge_publication_capabilities WHERE snapshot_id=$1',[snapshotId])).rows[0].n,1);
 assert.equal(await new PrivateObjects(objectBackup).read(f.pool,f.contentHash),f.content);
 const damage=await f.pool.connect();
 try{
  await damage.query('SET session_replication_role=replica');
  await damage.query('DELETE FROM product_approvals WHERE id=$1',[approval]);
  await damage.query('SET session_replication_role=origin');
 }finally{damage.release();}
 await assert.rejects(assertForeignKeysIntact(f.pool,f.schema),/FK_VIOLATION/);
});

test('immutable revisions and identity bindings reject mutation or mismatched references',async(t)=>{
 const f=await v0Schema(t);await migrate(f.pool,f.schema);
 const c1='concept-'+randomUUID(),c2='concept-'+randomUUID(),cr1='concept-revision-'+randomUUID(),cr2='concept-revision-'+randomUUID();
 await f.pool.query('INSERT INTO knowledge_concepts(id,space_id) VALUES($1,$2),($3,$2)',[c1,f.spaceId,c2]);
 await f.pool.query(`INSERT INTO knowledge_concept_revisions(id,concept_id,space_id,revision,label,content_hash)
  VALUES($1,$2,$3,1,'Concept one',repeat('c',64)),($4,$5,$3,1,'Concept two',repeat('d',64))`,[cr1,c1,f.spaceId,cr2,c2]);
 const assignment='assignment-'+randomUUID();
 await f.pool.query(`INSERT INTO knowledge_entry_concept_assignments(id,space_id,entry_id,concept_id,concept_revision_id,revision,status,content_hash)
  VALUES($1,$2,$3,$4,$5,1,'suggested',repeat('e',64))`,[assignment,f.spaceId,f.pageId,c1,cr1]);
 await assert.rejects(f.pool.query(`INSERT INTO knowledge_entry_concept_assignments(id,space_id,entry_id,concept_id,concept_revision_id,revision,status,content_hash)
  VALUES($1,$2,$3,$4,$5,1,'suggested',repeat('e',64))`,[randomUUID(),f.spaceId,f.pageId,c1,cr2]),/foreign key|violates/i);
 await assert.rejects(f.pool.query("UPDATE knowledge_concept_revisions SET label='changed' WHERE id=$1",[cr1]),/IMMUTABLE_REVISION|check/i);
 await assert.rejects(f.pool.query('DELETE FROM knowledge_concept_revisions WHERE id=$1',[cr1]),/IMMUTABLE_REVISION|check/i);
 await assert.rejects(f.pool.query("UPDATE knowledge_entry_concept_assignments SET status='confirmed' WHERE id=$1",[assignment]),/IMMUTABLE_REVISION|check/i);
 const fragmentWrong=randomUUID();
 await assert.rejects(f.pool.query(`INSERT INTO knowledge_fragments(id,space_id,source_id,source_revision,locator,locator_key,excerpt,text_hash,status,revision,entry_id)
  VALUES($1,$2,$3,1,'{"type":"line","lineStart":1,"lineEnd":1}'::jsonb,'line:1:1','wrong entry',repeat('f',64),'pending',1,$4)`,[fragmentWrong,f.spaceId,f.sourceId,'page-'+randomUUID()]),/foreign key|violates/i);
 const fragmentGood=randomUUID();
 await f.pool.query(`INSERT INTO knowledge_fragments(id,space_id,source_id,source_revision,locator,locator_key,excerpt,text_hash,status,revision,entry_id)
  VALUES($1,$2,$3,1,'{"type":"line","lineStart":1,"lineEnd":1}'::jsonb,'line:1:1','immutable source',repeat('a',64),'pending',1,$4)`,[fragmentGood,f.spaceId,f.sourceId,f.pageId]);
 await assert.rejects(f.pool.query("UPDATE knowledge_fragments SET excerpt='changed' WHERE id=$1",[fragmentGood]),/IMMUTABLE_FRAGMENT|check/i);
 const secondSpace='space-'+randomUUID();await f.pool.query('INSERT INTO knowledge_spaces(id,title) VALUES($1,$2)',[secondSpace,'second space']);
 await assert.rejects(f.pool.query('UPDATE knowledge_concepts SET space_id=$2 WHERE id=$1',[c1,secondSpace]),/IMMUTABLE_CONCEPT_IDENTITY|foreign key|violates/i);
 const snapshot='snapshot-'+randomUUID();
 await f.pool.query(`INSERT INTO knowledge_publication_snapshots(id,space_id,manifest,graph_hash,policy_revision,effective_at)
  VALUES($1,$2,'{"version":1}'::jsonb,repeat('a',64),1,clock_timestamp())`,[snapshot,f.spaceId]);
 await assert.rejects(f.pool.query(`UPDATE knowledge_publication_snapshots SET manifest='{"version":2}'::jsonb WHERE id=$1`,[snapshot]),/IMMUTABLE_SNAPSHOT|check/i);
 await f.pool.query('UPDATE knowledge_publication_snapshots SET current=true WHERE id=$1',[snapshot]);
 await assert.rejects(f.pool.query('DELETE FROM knowledge_publication_snapshots WHERE id=$1',[snapshot]),/IMMUTABLE_SNAPSHOT|check/i);
 await assert.rejects(f.pool.query('UPDATE knowledge_space_policy_revisions SET allow_self_publish=true WHERE space_id=$1',[f.spaceId]),/IMMUTABLE_REVISION|check/i);
 await assert.rejects(f.pool.query('DELETE FROM knowledge_space_policy_revisions WHERE space_id=$1',[f.spaceId]),/IMMUTABLE_REVISION|check/i);
});
