import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const get = (url) => fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20000) });
const native = await get('https://www.nuochong.net/oa-test/');
assert.ok([502, 503].includes(native.status));
for (const url of ['https://www.nuochong.net/', 'https://nuochong-company-homepage-test.76gzwtk9sb.workers.dev/']) {
  const response = await get(url); assert.equal(response.status, 200); assert.match(await response.text(), /Nuochong Technology/);
}
for (const path of ['/app', '/app/login', '/app/users', '/app/training', '/app/notifications', '/app/workorders', '/app/help']) {
  assert.equal((await get('https://nuochong-company-homepage-test.76gzwtk9sb.workers.dev' + path)).status, 404);
}
const report = { passed: true, nativeStoppedStatus: native.status, productionWebsite: 200, testWebsite: 200, retiredRoutes: 7, modelCalls: 0 };
writeFileSync('oa-01-availability.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
