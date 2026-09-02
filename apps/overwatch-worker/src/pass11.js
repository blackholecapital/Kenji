import app from "./pass10.js";

export default {
  async fetch(request, env, ctx) {
    const response = await app.fetch(request, env, ctx);
    const type = response.headers.get("content-type") || "";
    if (request.method === "GET" && type.includes("text/html")) {
      let html = await response.text();
      if (!html.includes("/pass11-premium.css")) {
        html = html.replace("</head>", '  <link rel="stylesheet" href="/pass11-premium.css">\n</head>');
      }
      if (!html.includes("/pass11-premium.js")) {
        html = html.replace("</body>", '  <script src="/pass11-premium.js"></script>\n  <script src="/pass11-support.js"></script>\n</body>');
      }
      return new Response(html, { status: response.status, headers: response.headers });
    }
    return response;
  },
};
