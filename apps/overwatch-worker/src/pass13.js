import app from "./pass12.js";

export default {
  async fetch(request,env,ctx){
    const response=await app.fetch(request,env,ctx);
    const type=response.headers.get("content-type")||"";
    if(request.method==="GET"&&type.includes("text/html")){
      let html=await response.text();
      if(!html.includes("/pass13-dense.css"))html=html.replace("</head>",'  <link rel="stylesheet" href="/pass13-dense.css">\n</head>');
      if(!html.includes("/pass13-dense.js"))html=html.replace("</body>",'  <script src="/pass13-dense.js"></script>\n</body>');
      return new Response(html,{status:response.status,headers:response.headers});
    }
    return response;
  }
};
