import app from "./pass10.js";

export default {
  async fetch(request, env, ctx) {
    const response = await app.fetch(request, env, ctx);
    const type = response.headers.get("content-type") || "";
    if (request.method === "GET" && type.includes("text/html")) {
      const html = await response.text();
      const injected = html.includes("/pass11-premium.js")
        ? html
        : html.replace("</body>", '  <script src="/pass11-premium.js"></script>\n</body>');
      return new Response(injected, { status: response.status, headers: response.headers });
    }
    return response;
  },
};
