import {productEntry,productEntryHTML} from '../../../lib/product-entries.mjs';
export async function GET(_request: Request, context: {params: Promise<{slug:string}>}) {
 const {slug}=await context.params;const entry=productEntry(slug);
 if(!entry)return new Response('Not found',{status:404});
 if(entry.target)return Response.redirect(entry.target,307);
 return new Response(productEntryHTML(entry),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow'}});
}
