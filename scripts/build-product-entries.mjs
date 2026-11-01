import {mkdir,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import {productEntries,productEntryHTML} from '../lib/product-entries.mjs';
// Nginx serves directory index pages in the static production site. No root configuration change.
for(const entry of productEntries){const folder=resolve('dist-static','product',entry.slug);await mkdir(folder,{recursive:true});await writeFile(resolve(folder,'index.html'),productEntryHTML(entry));}
