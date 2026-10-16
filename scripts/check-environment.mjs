import assert from 'node:assert/strict';

const environments = {
  test: 'https://nuochong-company-homepage-test.76gzwtk9sb.workers.dev/',
  production: 'https://nuochong.net/',
};
const target = process.argv[2];
assert.ok(Object.hasOwn(environments, target), 'Usage: node scripts/check-environment.mjs test|production');

async function request(url, contentType) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      assert.equal(response.status, 200, `${url}: HTTP ${response.status}`);
      assert.match(response.headers.get('content-type') ?? '', contentType, `${url}: unexpected content type`);
      const body = await response.text();
      assert.ok(body.length > 0, `${url}: empty response`);
      console.log(`PASS ${url} -> ${response.url} (${response.status}, ${body.length} characters)`);
      return { body, url: response.url };
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt}/3 failed for ${url}: ${error.message} ${error.cause?.message ?? ''}`);
    }
  }
  throw lastError;
}

const home = await request(environments[target], /text\/html/i);
assert.match(home.body, /Nuochong Technology/, 'Homepage brand/title missing');
assert.doesNotMatch(home.body, /dnspod\.qcloud\.com\/static\/webblock/, 'Domain is blocked');
if (target === 'production') {
  assert.equal(new URL(home.url).hostname, 'www.nuochong.net', 'Production canonical redirect missing');
}

const assets = [...home.body.matchAll(/<(script|link)\b[^>]*\b(?:src|href)="([^"#]+)"[^>]*>/g)]
  .filter(([, tag, path]) => tag === 'script' || /\.css(?:\?|$)/.test(path))
  .map(([, tag, path]) => ({
    url: new URL(path, home.url),
    type: tag === 'script' ? /(?:javascript|ecmascript)/i : /text\/css/i,
  }))
  .filter(({ url }) => url.origin === new URL(home.url).origin);
assert.ok(assets.some(({ type }) => type.test('application/javascript')), 'Homepage has no JavaScript entry');
await Promise.all(assets.map(({ url, type }) => request(url, type)));
await request(new URL('/logo-mark.svg', home.url), /image\/svg\+xml/i);
console.log(`${target} environment passed HTTP, brand and asset checks.`);
