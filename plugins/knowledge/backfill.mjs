// KBV2-02: idempotent paragraph backfill for v0 Markdown/TXT sources and a
// compatibility helper for the existing line/range citations.
import {createHash,randomUUID} from 'node:crypto';
import {transaction} from '../../apps/control-api/src/db.mjs';
import {requireThat} from '../../apps/control-api/src/errors.mjs';
import {PrivateObjects} from './objects.mjs';

const hashText=text=>createHash('sha256').update(text,'utf8').digest('hex');

// Split on blank lines while retaining 1-based source line numbers. A
// paragraph may span multiple lines; the excerpt is always the exact source
// slice, never a model rewrite.
export function paragraphRanges(text){
 const lines=text.split('\n'),ranges=[];let start=null;
 for(let index=0;index<lines.length;index+=1){
  const blank=lines[index].trim()==='';
  if(!blank&&start===null)start=index+1;
  if((blank||index===lines.length-1)&&start!==null){
   const end=blank?index:index+1;
   const excerpt=lines.slice(start-1,end).join('\n');
   if(excerpt.trim().length)ranges.push({lineStart:start,lineEnd:end,excerpt});
   start=null;
  }
 }
 return ranges;
}

export async function backfillV0Fragments(pool,{objectRoot,spaceId=null}={}){
 const objects=new PrivateObjects(objectRoot);
 const sources=(await pool.query(`SELECT id,space_id,object_hash,ordinal FROM knowledge_sources
  WHERE ($1::text IS NULL OR space_id=$1) ORDER BY space_id,id`,[spaceId])).rows;
 let fragmentsInserted=0;
 for(const source of sources){
  await transaction(pool,async db=>{
   const text=await objects.read(db,source.object_hash);
   const ranges=paragraphRanges(text);
   requireThat(ranges.length>0,422,'EMPTY_SOURCE_CONTENT');
   for(const range of ranges){
    const locator={type:'line',lineStart:range.lineStart,lineEnd:range.lineEnd};
    const textHash=hashText(range.excerpt);
    const inserted=await db.query(`INSERT INTO knowledge_fragments
      (id,space_id,source_id,source_revision,locator,locator_key,excerpt,text_hash,status,revision)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'pending',1)
      ON CONFLICT(source_id,locator_key,text_hash) DO NOTHING RETURNING id`,
      [randomUUID(),source.space_id,source.id,source.ordinal,JSON.stringify(locator),`line:${range.lineStart}:${range.lineEnd}`,range.excerpt,textHash]);
    fragmentsInserted+=inserted.rowCount;
   }
  });
 }
 return {sources:sources.length,fragmentsInserted};
}

// New read helper for the compatibility window. Existing v0 revisions retain
// their line citations; callers can resolve the same range to the immutable
// fragment(s) without mutating the old revision.
export async function legacyCitationFragments(pool,{spaceId,sourceId,lineStart,lineEnd}){
 requireThat(Number.isInteger(lineStart)&&Number.isInteger(lineEnd)&&lineStart>0&&lineEnd>=lineStart,400,'INVALID_CITATION');
 return (await pool.query(`SELECT id,space_id,source_id,locator,excerpt,text_hash,status,revision
  FROM knowledge_fragments
  WHERE space_id=$1 AND source_id=$2 AND locator->>'type'='line'
   AND (locator->>'lineStart')::integer<=$4 AND (locator->>'lineEnd')::integer>=$3
  ORDER BY (locator->>'lineStart')::integer,id`,[spaceId,sourceId,lineStart,lineEnd])).rows;
}
