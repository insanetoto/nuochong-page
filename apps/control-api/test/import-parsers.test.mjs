import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deflateRawSync} from 'node:zlib';
import {parseImportBytes,parsePdf,parseDocx} from '../../../plugins/knowledge/import-parsers.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function pdf(pages,extra=''){
 const objects=[];
 const pagesId=2;const fontId=3+pages.length*2;objects[1]='<< /Type /Catalog /Pages 2 0 R >>';objects[2]='<< /Type /Pages /Kids ['+pages.map((_,i)=>`${3+i*2} 0 R`).join(' ')+'] /Count ${pages.length} >>';objects[fontId]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
 pages.forEach((page,i)=>{const pageId=3+i*2,contentId=pageId+1;objects[pageId]=`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;const body=Buffer.from(`BT /F1 12 Tf 72 700 Td (${page.replace(/[()\\]/g,c=>'\\'+c)}) Tj ET`,'latin1');objects[contentId]=`<< /Length ${body.length} >>\nstream\n${body.toString('latin1')}\nendstream`;});
 let out='%PDF-1.4\n';objects.forEach((body,index)=>{if(index)out+=`${index} 0 obj\n${body}\nendobj\n`;});return Buffer.from(out+extra,'latin1');
}
function zip(files){
 const locals=[],centrals=[];let offset=0;
 for(const [name,data] of Object.entries(files)){
  const buffer=Buffer.isBuffer(data)?data:Buffer.from(data,'utf8');const compressed=deflateRawSync(buffer);const nameBytes=Buffer.from(name,'utf8');const crc=0;
  const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(buffer.length,22);local.writeUInt16LE(nameBytes.length,26);local.writeUInt16LE(0,28);
  const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(8,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(buffer.length,24);central.writeUInt16LE(nameBytes.length,28);central.writeUInt32LE(offset,42);
  locals.push(local,nameBytes,compressed);centrals.push(central,nameBytes);offset+=local.length+nameBytes.length+compressed.length;
 }
 const localBlock=Buffer.concat(locals),centralBlock=Buffer.concat(centrals);const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(centralBlock.length,12);end.writeUInt32LE(localBlock.length,16);
 return Buffer.concat([localBlock,centralBlock,end]);
}
function docx(paragraphs){const body=paragraphs.map(p=>`<w:p><w:r><w:t>${p}</w:t></w:r></w:p>`).join('');return zip({'[Content_Types].xml':'<Types/>','word/document.xml':`<w:document><w:body>${body}</w:body></w:document>`});}

test('Markdown and TXT use exact bytes, paragraph locators and expected hashes',()=>{
 const md=Buffer.from('# Synthetic policy\n\nTravel requires approval.\nKeep receipts.\n');
 const parsed=parseImportBytes(md,'text/markdown');assert.equal(parsed.sha256,sha(md));assert.equal(parsed.byteLength,md.length);assert.deepEqual(parsed.fragments.map(f=>f.locator),[{type:'line',lineStart:1,lineEnd:1},{type:'line',lineStart:3,lineEnd:4}]);assert.equal(parsed.fragments[1].excerpt,'Travel requires approval.\nKeep receipts.');
 const txt=Buffer.from('Travel requires approval.\n\nKeep receipts.\n');const parsedTxt=parseImportBytes(txt,'text/plain');assert.deepEqual(parsedTxt.fragments.map(f=>[f.locator.lineStart,f.locator.lineEnd]),[[1,1],[3,3]]);
});

test('actual two-page text-layer PDF maps page locators',()=>{
 const file=pdf(['Synthetic policy','Travel requires approval.\nKeep receipts.']);const parsed=parseImportBytes(file,'application/pdf');assert.equal(parsed.pages.length,2);assert.deepEqual(parsed.pages.map(p=>p.text),['Synthetic policy','Travel requires approval.\nKeep receipts.']);assert.deepEqual(parsed.fragments.map(f=>f.locator),[{type:'page',page:1,lineStart:1,lineEnd:1},{type:'page',page:2,lineStart:1,lineEnd:2}]);
});

test('actual DOCX container extracts exact paragraphs',()=>{
 const file=docx(['Travel requires approval.','Keep receipts.']);const parsed=parseImportBytes(file,'application/vnd.openxmlformats-officedocument.wordprocessingml.document');assert.deepEqual(parsed.paragraphs,['Travel requires approval.','Keep receipts.']);assert.deepEqual(parsed.fragments.map(f=>f.locator),[{type:'paragraph',index:1},{type:'paragraph',index:2}]);
});

test('PDF preserves real page number for an empty first page',()=>{const file=pdf(['','Travel requires approval.']);const parsed=parsePdf(file);assert.equal(parsed.pages.length,2);assert.equal(parsed.pages[0].page,1);assert.equal(parsed.pages[0].text,'');assert.equal(parsed.fragments[0].locator.page,2);assert.equal(parsed.fragments[0].locator.lineStart,1);});

test('PDF page tree rejects cycles and stays within page budget',()=>{
 const cycle=Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [2 0 R] /Count 1 >> endobj\n');
 assert.throws(()=>parsePdf(cycle),/PDF_PAGE_TREE_CYCLE|INVALID/);
 const deep=pdf(Array.from({length:101},(_,i)=>'page '+i));assert.throws(()=>parsePdf(deep),/QUOTA_EXCEEDED/);
});
test('PDF refuses mixed literal/hex text instead of partial success',()=>{
 const mixed=Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R >> endobj\n4 0 obj << /Length 18 >>\nstream\nBT (A) Tj <42> Tj ET\nendstream\nendobj\n');
 assert.throws(()=>parsePdf(mixed),/PDF_UNSUPPORTED_TEXT|PARSER_UNAVAILABLE/);
 const tjArray=Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R >> endobj\n4 0 obj << /Length 22 >>\nstream\nBT [(A) <42>] TJ ET\nendstream\nendobj\n');
 assert.throws(()=>parsePdf(tjArray),/PDF_UNSUPPORTED_TEXT|PARSER_UNAVAILABLE/);
});
test('text and expansion limits fail before unbounded work',()=>{assert.throws(()=>parseImportBytes(Buffer.from('x'.repeat(20001)),'text/plain'),/QUOTA_EXCEEDED|TEXT_OR_RESOURCE|QUOTA/);assert.throws(()=>parseDocx(docx(['x'.repeat(100000)]),{expandedLimit:100}),/QUOTA_EXCEEDED|DOCX_EXPANSION|QUOTA/);});

test('negative formats fail closed without empty success',()=>{
 assert.throws(()=>parseImportBytes(Buffer.alloc(0),'text/plain'),/EMPTY_FILE|INVALID_INPUT/);
 assert.throws(()=>parseImportBytes(Buffer.from([0xff,0xfe,0x00]),'text/plain'),/INVALID|UTF/);
 assert.throws(()=>parseImportBytes(Buffer.from('not a pdf'),'application/pdf'),/PDF_MAGIC|INVALID/);
 assert.throws(()=>parsePdf(pdf([''])),/PDF_TEXT_LAYER_MISSING|REQUEST_FAILED/);
 assert.throws(()=>parsePdf(pdf(['text'],'\n/Encrypt << /Filter /Standard >>')),/ENCRYPTED|INVALID/);
 assert.throws(()=>parseDocx(docx(['x']),{expandedLimit:1}),/DOCX_EXPANSION_LIMIT|QUOTA_EXCEEDED/);
});
