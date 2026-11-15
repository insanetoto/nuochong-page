import {parentPort,workerData} from 'node:worker_threads';
import {parseImportBytes} from './import-parsers.mjs';
const delay=process.env.NODE_ENV==='test'?Number(process.env.IMPORT_TEST_PARSE_DELAY_MS??0):0;
if(delay>0)await new Promise(resolve=>setTimeout(resolve,Math.min(delay,5000)));
try{parentPort.postMessage({ok:true,value:parseImportBytes(Buffer.from(workerData.bytes),workerData.mediaType)});}
catch(error){parentPort.postMessage({ok:false,code:error.code??'REQUEST_FAILED',message:error.message});}
