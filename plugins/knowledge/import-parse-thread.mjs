import {parentPort,workerData} from 'node:worker_threads';
import {parseImportBytes} from './import-parsers.mjs';
try{parentPort.postMessage({ok:true,value:parseImportBytes(Buffer.from(workerData.bytes),workerData.mediaType)});}
catch(error){parentPort.postMessage({ok:false,code:error.code??'REQUEST_FAILED',message:error.message});}
