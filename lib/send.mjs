import {gzipSync} from 'node:zlib';
import {prepareConsole,prepareNotice,eventEndAt} from '../admin/compose.js';
const PROJECT='littlemakes-16ea4';
const API_KEY='AIzaSyCRHKfgmAw4vCggoXyy8rYBSaFooISRt6s';
const OWNER='tenutohahwi@gmail.com';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const encode=value=>b64(new TextEncoder().encode(JSON.stringify(value)));
function eventMessage(data,now=Date.now()){
 if(!data||typeof data!=='object')throw Error('입력을 확인하세요');
 for(const [key,max] of [['title',80],['body',1000],['url',800]])if(typeof data[key]!=='string'||data[key].length>max)throw Error('입력을 확인하세요');
 const title=data.title.trim(),body=data.body.trim(),url=data.url.trim(),time=data.remindAt;
 if(!title||!body||!Number.isSafeInteger(time)||time<=now||time>now+365*86400000)throw Error('제목·내용·미래 알림 시간을 확인하세요');
 if(typeof data.eventId!=='string'||!/^[a-zA-Z0-9_-]{16,80}$/.test(data.eventId))throw Error('요청 번호 오류');
 if(url){const u=new URL(url);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('링크 오류');}
 const payload={eventId:data.eventId,title,body,url,category:'이벤트',remindAt:String(time),endAt:String(eventEndAt(data,now))};
 if(new TextEncoder().encode(JSON.stringify(payload)).length>1800)throw Error('내용이 너무 길어요');
 return {topic:'events',data:payload,android:{priority:'high',ttl:Math.min(2419200,Math.max(1,Math.floor((time-now)/1000)))+'s'}};
}
export async function message(data,now=Date.now()){
 if(data?.kind==='notice'||data?.kind==='links'){
  const prepared=prepareNotice(data);
  const outgoing={topic:'events',notification:{title:prepared.title,body:prepared.body},data:prepared.fields,
   android:{priority:'high',ttl:'86400s',notification:{channel_id:'events',tag:'notice_'+prepared.fields.notice_id}}};
  if(Buffer.byteLength(JSON.stringify(outgoing),'utf8')>3500){
   outgoing.data.notice_body_gzip=gzipSync(outgoing.data.notice_body).toString('base64');delete outgoing.data.notice_body;
  }
  if(Buffer.byteLength(JSON.stringify(outgoing),'utf8')>3500)throw Error('공지 내용이 전송 한도를 넘었어요. 링크나 본문을 줄여 주세요.');
  return outgoing;
 }
 if(data?.kind==='event')return eventMessage(data,now);
 if(data?.kind!=='recommendation')throw Error('작성 종류를 확인하세요.');
 const prepared=await prepareConsole(data,[],now);
 return {topic:'events',notification:{title:prepared.title,body:prepared.body},data:prepared.fields,android:{priority:'high',ttl:'86400s'}};
}
async function authorize(request){
 const token=request.headers.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1];
 if(!token) return false;
 const response=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+API_KEY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token})});
 if(!response.ok)return false;
 const account=(await response.json()).users?.[0];
 return account?.email===OWNER&&account.emailVerified===true&&!account.disabled;
}
async function accessToken(env){
 const account=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT||'{}');
 if(account.project_id!==PROJECT||!account.private_key||!account.client_email)throw Error('발송 인증 설정이 필요합니다');
 const now=Math.floor(Date.now()/1000);
 const unsigned=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:account.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
 const der=Uint8Array.from(atob(account.private_key.replace(/-----[^-]+-----/g,'').replace(/\s/g,'')),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey('pkcs8',der,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned));
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+b64(new Uint8Array(signature))})});
 if(!response.ok)throw Error('발송 인증 실패');
 return (await response.json()).access_token;
}
async function sendAuthorized(request,env,deviceOnly){
 if(request.method!=='POST')return json({error:'POST required'},405);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'허용되지 않은 요청'},403);
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'JSON required'},415);
 try{
  if(!await authorize(request))return json({error:'관리자 계정으로 로그인하세요'},403);
  const raw=await request.text();if(raw.length>20000)return json({error:'입력이 너무 길어요'},413);
  let outgoing;try{
   const input=JSON.parse(raw);
   if(deviceOnly){
    if(input.kind!=='links')throw Error('테스트는 링크 모음만 지원합니다.');
    if(typeof input.registrationToken!=='string'||!/^[-_a-zA-Z0-9:.]{80,4096}$/.test(input.registrationToken))throw Error('테스트 기기 토큰을 확인하세요.');
   }else if(input.registrationToken!==undefined)throw Error('기기 테스트는 전용 API를 사용하세요.');
   outgoing=await message(input);
   if(deviceOnly){delete outgoing.topic;outgoing.token=input.registrationToken;
    if(Buffer.byteLength(JSON.stringify(outgoing),'utf8')>4000)throw Error('테스트 메시지가 전송 한도를 넘었어요.');
   }
  }catch(e){return json({error:e.message},400);}
  if(!env.FIREBASE_SERVICE_ACCOUNT)return json({error:'Vercel에 FIREBASE_SERVICE_ACCOUNT 환경변수를 등록하고 다시 배포하세요.'},503);
  const token=await accessToken(env);
  const response=await fetch('https://fcm.googleapis.com/v1/projects/'+PROJECT+'/messages:send',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({message:outgoing})});
  if(!response.ok){
   if(deviceOnly){
    let details={};try{details=await response.json();}catch{}
    const status=details.error?.status;
    const code=details.error?.details?.find(x=>x['@type']==='type.googleapis.com/google.firebase.fcm.v1.FcmError')?.errorCode;
    const safe=[status,code].filter(x=>typeof x==='string'&&/^[A-Z_]{1,50}$/.test(x));
    return json({error:'기기 테스트 발송 실패 (HTTP '+response.status+(safe.length?' · '+safe.join(' / '):'')+'). 토큰·프로젝트 연결을 확인하세요.'},502);
   }
   return json({error:'발송 접수 실패. 프로젝트 발송 권한을 확인하세요.'},502);
  }
  return json({state:'accepted',messageId:(await response.json()).name});
 }catch{return json({error:'전송 결과를 확인하지 못했어요. 무조건 재전송하지 말고 휴대폰 수신을 확인하세요.'},502);}
}


// Separate URL: an older deployment returns 404 instead of ignoring a device
// selector and accidentally sending to the topic. Never fall back to /api/send.
export async function send(request,env){return sendAuthorized(request,env,false);}
export async function sendTest(request,env){return sendAuthorized(request,env,true);}
