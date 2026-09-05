import app from "./pass19.js";

export default {
  async fetch(request,env,ctx){
    const response=await app.fetch(request,env,ctx);
    const type=response.headers.get("content-type")||"";
    if(request.method==="GET"&&type.includes("text/html")){
      let html=await response.text();
      if(!html.includes("/pass20-final-cleanup.css"))html=html.replace("</head>",'  <link rel="stylesheet" href="/pass20-final-cleanup.css">\n</head>');
      if(!html.includes("/pass20-nurture-hotfix.css"))html=html.replace("</head>",'  <link rel="stylesheet" href="/pass20-nurture-hotfix.css">\n</head>');
      if(!html.includes("/pass20-final-cleanup.js"))html=html.replace("</body>",'  <script src="/pass20-final-cleanup.js"></script>\n</body>');
      return new Response(html,{status:response.status,headers:response.headers});
    }
    return response;
  }
};
