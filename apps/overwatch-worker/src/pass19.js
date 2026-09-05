import app from "./pass18.js";

export default {
  async fetch(request,env,ctx){
    const response=await app.fetch(request,env,ctx);
    const type=response.headers.get("content-type")||"";
    if(request.method==="GET"&&type.includes("text/html")){
      let html=await response.text();
      if(!html.includes("/pass19-nurture-auth.css"))html=html.replace("</head>",'  <link rel="stylesheet" href="/pass19-nurture-auth.css">\n</head>');
      if(!html.includes("/pass19-nurture-auth.js"))html=html.replace("</body>",'  <script src="/pass19-nurture-auth.js"></script>\n</body>');
      return new Response(html,{status:response.status,headers:response.headers});
    }
    return response;
  }
};
