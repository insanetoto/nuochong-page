// This route never proxies an owner launch token into the public website.
// Company-wide access must be placed behind the OA identity boundary first.
export async function GET() {
  const value = process.env.NUOCHONG_OA_URL;
  if (value) {
    try {
      const url = new URL(value);
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      if (!url.username && !url.password && !url.search && !url.hash &&
          (url.protocol === "https:" || (url.protocol === "http:" && local))) {
        return Response.redirect(url.href, 307);
      }
    } catch { /* Return an explicit unavailable state below. */ }
  }
  return new Response("<!doctype html><html lang=\"zh-CN\"><meta charset=\"utf-8\"><title>OA</title><h1>OA 服务尚未启动</h1><p>请联系管理员启用 OA 入口。</p></html>", {
    status: 503, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
