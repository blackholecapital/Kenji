import app from "./pass17.js";

export default {
  async fetch(request,env,ctx){
    const response=await app.fetch(request,env,ctx);
    const type=response.headers.get("content-type")||"";
    if(request.method==="GET"&&type.includes("text/html")){
      let html=await response.text();
      if(!html.includes("/pass18-client-workspace.css"))html=html.replace("</head>",'  <link rel="stylesheet" href="/pass18-client-workspace.css">\n</head>');
      if(!html.includes("/pass18-client-workspace.js"))html=html.replace("</body>",'  <script src="/pass18-client-workspace.js"></script>\n</body>');
      return new Response(html,{status:response.status,headers:response.headers});
    }
    return response;
  }
};
