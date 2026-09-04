import app from "./pass16.js";

export default {
  async fetch(request,env,ctx){
    const response=await app.fetch(request,env,ctx);
    const type=response.headers.get("content-type")||"";
    if(request.method==="GET"&&type.includes("text/html")){
      let html=await response.text();
      if(!html.includes("/pass17-branding.css"))html=html.replace("</head>",'  <link rel="stylesheet" href="/pass17-branding.css">\n</head>');
      if(!html.includes("/pass17-branding.js"))html=html.replace("</body>",'  <script src="/pass17-branding.js"></script>\n</body>');
      return new Response(html,{status:response.status,headers:response.headers});
    }
    return response;
  }
};
