function decodeBase64(value=""){
  const raw=atob(String(value));
  const bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  return bytes;
}

export function createDeepgramTranscriber(env,handlers={}){
  const apiKey=String(env.DEEPGRAM_API_KEY||"").trim();
  if(!apiKey)return null;
  const model=String(env.DEEPGRAM_STT_MODEL||"nova-3").trim();
  const endpointing=String(env.DEEPGRAM_ENDPOINTING_MS||"300").trim();
  const url=new URL("wss://api.deepgram.com/v1/listen");
  url.searchParams.set("encoding","mulaw");
  url.searchParams.set("sample_rate","8000");
  url.searchParams.set("channels","1");
  url.searchParams.set("model",model);
  url.searchParams.set("smart_format","true");
  url.searchParams.set("interim_results","true");
  url.searchParams.set("endpointing",endpointing);
  const socket=new WebSocket(url.toString(),["token",apiKey]);
  let open=false,closed=false;const pending=[];
  const flush=()=>{if(!open||closed)return;while(pending.length)socket.send(pending.shift());};
  socket.addEventListener("open",()=>{open=true;handlers.onOpen?.({model,endpointing});flush();});
  socket.addEventListener("message",event=>{
    if(typeof event.data!=="string")return;let message;try{message=JSON.parse(event.data);}catch{return;}
    if(message.type==="Results"){
      const alt=message.channel?.alternatives?.[0]||{},transcript=String(alt.transcript||"").trim();if(!transcript)return;
      handlers.onTranscript?.({transcript,isFinal:Boolean(message.is_final),speechFinal:Boolean(message.speech_final),confidence:Number(alt.confidence||0)});return;
    }
    if(message.type==="UtteranceEnd")handlers.onUtteranceEnd?.(message);
    if(message.type==="SpeechStarted")handlers.onSpeechStarted?.(message);
  });
  socket.addEventListener("close",event=>{closed=true;open=false;handlers.onClose?.({code:event.code,reason:event.reason||""});});
  socket.addEventListener("error",event=>handlers.onError?.(event));
  return {
    sendBase64(payload){if(closed||!payload)return;const bytes=decodeBase64(payload);if(open)socket.send(bytes);else pending.push(bytes);},
    finalize(){if(closed)return;const msg=JSON.stringify({type:"Finalize"});if(open)socket.send(msg);else pending.push(msg);},
    close(){if(closed)return;try{if(open)socket.send(JSON.stringify({type:"CloseStream"}));}catch{}try{socket.close(1000,"twilio-stream-ended");}catch{}closed=true;open=false;},
  };
}
