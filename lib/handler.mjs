import {buildMessage,PROJECT,BUILT_INS} from './messages.mjs';
import {verifyAdmin,serviceToken} from './firebase.mjs';
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function createHandler({env=process.env,fetcher=fetch,authorize=verifyAdmin,getToken=serviceToken}={}){
 return async request=>{
  const path=new URL(request.url).pathname;
  if(path==='/api/admin'&&request.method==='GET')return json({enabled:env.ADMIN_SEND_ENABLED==='true'&&!!env.FIREBASE_SERVICE_ACCOUNT,apps:BUILT_INS});
  if(request.method!=='POST')return json({error:'POST 요청만 허용합니다.'},405);
  if(path!=='/api/admin')return json({error:'경로를 확인하세요.'},404);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'허용되지 않은 요청입니다.'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'입력 형식을 확인하세요.'},415);
  const token=request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
  if(!await authorize(token,{fetcher}))return json({error:'관리자 계정으로 로그인해 주세요.'},403);
  if(env.ADMIN_SEND_ENABLED!=='true'||!env.FIREBASE_SERVICE_ACCOUNT)return json({error:'발송 설정이 준비되지 않았어요. 미리보기와 초안 저장을 이용해 주세요.'},503);
  let message;
  try{const raw=await request.text();if(raw.length>8000)return json({error:'내용이 너무 길어요.'},413);message=buildMessage(JSON.parse(raw));}catch(e){return json({error:e.message||'입력을 확인하세요.'},400);}
  let access;
  try{access=await getToken(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT),{fetcher});}catch{return json({error:'서버 발송 인증 설정을 확인해 주세요.'},503);}
  try{
   const response=await fetcher(`https://fcm.googleapis.com/v1/projects/${PROJECT}/messages:send`,{method:'POST',signal:AbortSignal.timeout(10000),headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},body:JSON.stringify({message})});
   if(!response.ok)return json({error:'발송 요청이 거절됐어요. 서버 발송 권한을 확인하세요.'},502);
   return json({state:'accepted',messageId:(await response.json()).name,appId:message.data.app_id});
  }catch{return json({error:'전송 결과를 확인하지 못했어요. 휴대폰 수신을 먼저 확인하고 다시 전송하세요.'},502);}
 };
}
