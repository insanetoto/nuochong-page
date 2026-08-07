export async function GET(request: Request) {
  const country = request.headers.get("cf-ipcountry");
  return Response.json({ country: country || "XX" });
}
