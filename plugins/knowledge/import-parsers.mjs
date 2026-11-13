// KBV2-04 107-A: server-side format adapters. These functions consume raw
// bytes and return immutable text/fragment candidates; they never call models.
import {createHash} from 'node:crypto';
import {inflateRawSync,inflateSync} from 'node:zlib';
import {paragraphRanges} from './backfill.mjs';

const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const textHash=text=>createHash('sha256').update(text,'utf8').digest('hex');
const decoder=new TextDecoder('utf-8',{fatal:true});
const MAX_CODE_POINTS=20000;
const quota=()=>Object.assign(new Error('QUOTA_EXCEEDED'),{code:'QUOTA_EXCEEDED'});
function assertText(text){if([...text].length>MAX_CODE_POINTS)throw quota();return text;}

function fragment(locator,excerpt){
 return {locator,locatorKey:JSON.stringify(locator),excerpt,textHash:textHash(excerpt)};
}
function textResult(text,locatorType='line'){
 const fragments=[];for(const range of paragraphRanges(text))fragments.push(fragment({type:locatorType,lineStart:range.lineStart,lineEnd:range.lineEnd},range.excerpt));
 return {text,fragments};
}

export function parseText(bytes,{mediaType='text/plain'}={}){
 if(!bytes.length)throw Object.assign(new Error('EMPTY_FILE'),{code:'INVALID_INPUT'});
 let text;try{text=decoder.decode(bytes);}catch{throw Object.assign(new Error('INVALID_UTF8'),{code:'INVALID_INPUT'});}
 if(!text.trim())throw Object.assign(new Error('EMPTY_TEXT'),{code:'INVALID_INPUT'});assertText(text);
 if(mediaType==='text/markdown')return textResult(text,'line');
 return textResult(text,'line');
}

function pdfString(raw){
 let out='';for(let i=0;i<raw.length;i++){
  const c=raw[i];if(c!=='\\'){out+=c;continue;}
  const n=raw[++i];if(n==='n')out+='\n';else if(n==='r')out+='\r';else if(n==='t')out+='\t';else if(n==='b')out+='\b';else if(n==='f')out+='\f';else if(n==='('||n===')'||n==='\\')out+=n;else if(/[0-7]/.test(n)){let oct=n;while(oct.length<3&&/[0-7]/.test(raw[i+1]??''))oct+=raw[++i];out+=String.fromCharCode(parseInt(oct,8));}else out+=n??'';
 }
 return out;
}
function pdfText(stream){
 const text=stream.toString('latin1');if(/\/Encrypt\b/.test(text))throw Object.assign(new Error('ENCRYPTED'),{code:'INVALID_INPUT'});if(/<[0-9a-fA-F\s]+>\s*(?:Tj|TJ)/.test(text))throw Object.assign(new Error('PDF_UNSUPPORTED_TEXT'),{code:'PARSER_UNAVAILABLE'});
 const lines=[];let line='';
 for(const match of text.matchAll(/\((?:\\.|[^\\)])*\)\s*Tj|\[(?:[^\]]*)\]\s*TJ|T\*|\bTd\b|\bTD\b/g)){
  const token=match[0];
  if(token.endsWith('Tj')){const raw=token.slice(1,token.lastIndexOf(')'));line+=pdfString(raw);}
  else if(token.endsWith('TJ')){const raw=token.slice(1,token.lastIndexOf(']'));for(const s of raw.matchAll(/\((?:\\.|[^\\)])*\)/g))line+=pdfString(s[0].slice(1,-1));}
  else {if(line.trim())lines.push(line);line='';}
 }
 if(line.trim())lines.push(line);
 return lines.join('\n');
}
function inflateStream(body,header,remaining){
 const limit=remaining;
 try{
  if(/\/FlateDecode\b/.test(header))return inflateSync(body,{maxOutputLength:limit});
  if(body.length>limit)throw quota();
  return body;
 }catch(error){
  if(error.code==='QUOTA_EXCEEDED')throw error;
  if(error.code==='ERR_BUFFER_TOO_LARGE')throw quota();
  throw Object.assign(new Error('PDF_STREAM_CORRUPT'),{code:'INVALID_INPUT'});
 }
}
function pageRefs(objects,pageLimit){
 const catalog=[...objects.values()].find(body=>/\/Type\s*\/Catalog\b/.test(body));
 const root=catalog&&/\/Pages\s+(\d+)\s+\d+\s+R/.exec(catalog)?.[1];
 if(!root)return null;
 const refs=[],seen=new Set();let nodes=0;
 const walk=(number,depth)=>{
  if(depth>32)throw Object.assign(new Error('PDF_PAGE_TREE_DEPTH'),{code:'INVALID_INPUT'});
  if(seen.has(number))throw Object.assign(new Error('PDF_PAGE_TREE_CYCLE'),{code:'INVALID_INPUT'});
  seen.add(number);nodes+=1;
  if(nodes>pageLimit*4+64)throw Object.assign(new Error('QUOTA_EXCEEDED'),{code:'QUOTA_EXCEEDED'});
  const body=objects.get(Number(number));if(!body)throw Object.assign(new Error('PDF_PAGE_TREE_MISSING'),{code:'INVALID_INPUT'});
  if(/\/Type\s*\/Page\b/.test(body)&&!/\/Type\s*\/Pages\b/.test(body)){
   refs.push(Number(number));
   if(refs.length>pageLimit)throw Object.assign(new Error('QUOTA_EXCEEDED'),{code:'QUOTA_EXCEEDED'});
   return;
  }
  const kids=/\/Kids\s*\[([^\]]+)\]/.exec(body);
  if(kids)for(const ref of kids[1].matchAll(/(\d+)\s+\d+\s+R/g))walk(ref[1],depth+1);
 };
 walk(root,0);return refs;
}

export function parsePdf(bytes,{expandedLimit=100*1024*1024,pageLimit=100}={}){
 const raw=bytes.toString('latin1');if(!raw.startsWith('%PDF-'))throw Object.assign(new Error('PDF_MAGIC_MISMATCH'),{code:'INVALID_INPUT'});
 if(/\/Encrypt\b/.test(raw))throw Object.assign(new Error('ENCRYPTED'),{code:'INVALID_INPUT'});
 if(/\/ToUnicode\b/.test(raw))throw Object.assign(new Error('PDF_UNSUPPORTED_TEXT'),{code:'PARSER_UNAVAILABLE'});
 const objects=new Map();for(const m of raw.matchAll(/(\d+)\s+\d+\s+obj\b([\s\S]*?)endobj/g))objects.set(Number(m[1]),m[2]);
 const refs=pageRefs(objects,pageLimit)??[...objects].filter(([,body])=>/\/Type\s*\/Page\b/.test(body)&&!/\/Type\s*\/Pages\b/.test(body)).map(([number])=>number);
 if(refs.length>pageLimit)throw quota();
 const pages=[];let budget=expandedLimit;
 for(let index=0;index<refs.length;index+=1){
  const body=objects.get(refs[index])??'';const contentRefs=[];const single=/\/Contents\s+(\d+)\s+\d+\s+R/.exec(body);if(single)contentRefs.push(Number(single[1]));
  const array=/\/Contents\s*\[([^\]]+)\]/.exec(body);if(array)for(const ref of array[1].matchAll(/(\d+)\s+\d+\s+R/g))contentRefs.push(Number(ref[1]));
  let text='';
  for(const ref of contentRefs){const obj=objects.get(ref);if(!obj)continue;const stream=/stream\r?\n([\s\S]*?)\r?\nendstream/.exec(obj);if(!stream)continue;const header=obj.slice(0,stream.index);const decoded=inflateStream(Buffer.from(stream[1],'latin1'),header,budget);budget-=decoded.length;text+=pdfText(decoded)+(text?'\n':'');}
  pages.push({page:index+1,text:text.trim()});
 }
 if(!pages.some(page=>page.text))throw Object.assign(new Error('PDF_TEXT_LAYER_MISSING'),{code:'REQUEST_FAILED'});
 const text=pages.filter(page=>page.text).map(page=>page.text).join('\n\n');assertText(text);
 const fragments=[];for(const page of pages)for(const range of paragraphRanges(page.text))fragments.push(fragment({type:'page',page:page.page,lineStart:range.lineStart,lineEnd:range.lineEnd},range.excerpt));
 return {text,fragments,pages};
}

function zipEntries(bytes,expandedLimit){
 const entries=new Map();let offset=0;const eocd=bytes.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
 if(eocd<0)throw Object.assign(new Error('DOCX_MAGIC_MISMATCH'),{code:'INVALID_INPUT'});
 const centralOffset=bytes.readUInt32LE(eocd+16),count=bytes.readUInt16LE(eocd+10);offset=centralOffset;let spent=0;
 for(let i=0;i<count;i++){
  if(bytes.readUInt32LE(offset)!==0x02014b50)throw Object.assign(new Error('DOCX_ZIP_CORRUPT'),{code:'INVALID_INPUT'});
  const method=bytes.readUInt16LE(offset+10),compressed=bytes.readUInt32LE(offset+20),size=bytes.readUInt32LE(offset+24),nameLength=bytes.readUInt16LE(offset+28),extraLength=bytes.readUInt16LE(offset+30),commentLength=bytes.readUInt16LE(offset+32),localOffset=bytes.readUInt32LE(offset+42);
  const remaining=expandedLimit-spent;if(size>remaining)throw quota();
  const name=bytes.subarray(offset+46,offset+46+nameLength).toString('utf8');
  const local=localOffset;if(bytes.readUInt32LE(local)!==0x04034b50)throw Object.assign(new Error('DOCX_ZIP_CORRUPT'),{code:'INVALID_INPUT'});
  const localName=bytes.readUInt16LE(local+26),localExtra=bytes.readUInt16LE(local+28),dataStart=local+30+localName+localExtra;
  const body=bytes.subarray(dataStart,dataStart+compressed);
  if(compressed>remaining+65536)throw quota();
  let data;try{data=method===0?body:method===8?inflateRawSync(body,{maxOutputLength:size}):null;}catch(error){if(error.code==='ERR_BUFFER_TOO_LARGE')throw quota();throw Object.assign(new Error('DOCX_ZIP_CORRUPT'),{code:'INVALID_INPUT'});}
  if(!data||data.length!==size)throw Object.assign(new Error('DOCX_ZIP_CORRUPT'),{code:'INVALID_INPUT'});
  spent+=size;entries.set(name,data);offset+=46+nameLength+extraLength+commentLength;
 }
 return entries;
}
function xmlText(value){
 return value.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));
}
export function parseDocx(bytes,{expandedLimit=100*1024*1024}={}){
 if(bytes[0]!==0x50||bytes[1]!==0x4b)throw Object.assign(new Error('DOCX_MAGIC_MISMATCH'),{code:'INVALID_INPUT'});
 const entries=zipEntries(bytes,expandedLimit);const document=entries.get('word/document.xml');if(!document)throw Object.assign(new Error('DOCX_DOCUMENT_MISSING'),{code:'INVALID_INPUT'});
 const xml=document.toString('utf8');const paragraphs=[];for(const p of xml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)){
  let text='';for(const t of p[1].matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>/g))text+=t[0].startsWith('<w:tab')?'\t':t[0].startsWith('<w:br')?'\n':xmlText(t[1]);
  if(text.trim())paragraphs.push(text);
 }
 if(!paragraphs.length)throw Object.assign(new Error('DOCX_TEXT_MISSING'),{code:'REQUEST_FAILED'});
 const text=paragraphs.join('\n');assertText(text);const fragments=paragraphs.map((text,index)=>fragment({type:'paragraph',index:index+1},text));
 return {text,fragments,paragraphs};
}

export function parseImportBytes(bytes,mediaType){
 if(!Buffer.isBuffer(bytes))throw Object.assign(new Error('INVALID_BYTES'),{code:'INVALID_INPUT'});
 if(mediaType==='text/markdown'||mediaType==='text/plain')return {...parseText(bytes,{mediaType}),sha256:sha256(bytes),byteLength:bytes.length};
 if(mediaType==='application/pdf')return {...parsePdf(bytes),sha256:sha256(bytes),byteLength:bytes.length};
 if(mediaType==='application/vnd.openxmlformats-officedocument.wordprocessingml.document')return {...parseDocx(bytes),sha256:sha256(bytes),byteLength:bytes.length};
 throw Object.assign(new Error('FORMAT_NOT_IMPLEMENTED'),{code:'PARSER_UNAVAILABLE'});
}
