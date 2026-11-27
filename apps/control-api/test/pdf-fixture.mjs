export function pdfBuffer(pages){
 const objects=[];const pagesId=2,fontId=3+pages.length*2;objects[1]='<< /Type /Catalog /Pages 2 0 R >>';objects[2]='<< /Type /Pages /Kids ['+pages.map((_,i)=>`${3+i*2} 0 R`).join(' ')+'] /Count ${pages.length} >>';objects[fontId]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
 pages.forEach((page,i)=>{const pageId=3+i*2,contentId=pageId+1;objects[pageId]=`<< /Type /Page /Parent ${pagesId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;const body=Buffer.from(`BT /F1 12 Tf 72 700 Td (${page.replace(/[()\\]/g,c=>'\\'+c)}) Tj ET`,'latin1');objects[contentId]=`<< /Length ${body.length} >>\nstream\n${body.toString('latin1')}\nendstream`;});
 let out='%PDF-1.4\n';objects.forEach((body,index)=>{if(index)out+=`${index} 0 obj\n${body}\nendobj\n`;});return Buffer.from(out,'latin1');
}
