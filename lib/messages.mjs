import {createHash} from 'node:crypto';
export const PROJECT='littlemakes-16ea4';
export const OWNER='tenutohahwi@gmail.com';
export const API_KEY='AIzaSyCRHKfgmAw4vCggoXyy8rYBSaFooISRt6s';
export const BUILT_INS=[
{id:'gs',name:'우리동네GS',type:'출첵형',code:'',description:'25일 출석체크 시 기프티콘 증정',url:'https://abr.ge/k2m9ujr'},
{id:'godofhealth',name:'건강의신',type:'만보기형',code:'Q49V5G',description:'',url:'https://play.google.com/store/apps/details?id=com.lemonhc.godofhealth.prod&hl=ko'},
{id:'nhhealthcare',name:'NH헬스케어',type:'만보기형',code:'',description:'기프티콘 구매',url:'https://play.google.com/store/apps/details?id=com.nhlife.customer.healthcare&hl=ko'},
{id:'laplay',name:'라플레이',type:'만보기형',code:'20240227332',description:'',url:'https://m.lifeplanet.co.kr:444/bridge/bm/BM07000S.dev?shareCd=20240227332'},
{id:'hyfredit',name:'hy프레딧',type:'만보기형',code:'',description:'',url:'https://m.fredit.co.kr/member/login-form?rootId=shyknight_m@naver.com'}];
function text(value,max,label,required=false){
 if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw Error(label+'을 확인해 주세요.');return value.trim();
}
export function identity(value){
 const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('HTTP(S) 링크를 입력하세요.');
 if(url.hostname==='play.google.com'&&url.pathname==='/store/apps/details'&&url.searchParams.get('id'))return 'play:'+url.searchParams.get('id');
 url.hash='';return url.href;
}
export function appId(url){
 const key=identity(url),existing=BUILT_INS.find(e=>identity(e.url)===key);
 return existing?.id||'app_'+createHash('sha256').update(key).digest('hex');
}
export function buildMessage(input,now=Date.now()){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('입력을 확인하세요.');
 const title=text(input.title,80,'푸시 제목',true),body=text(input.body,1000,'푸시 내용',true);
 let data;
 if(input.kind==='recommendation'){
  const action=input.action;if(!['upsert','delete'].includes(action))throw Error('작업을 확인하세요.');
  const url=text(input.url,800,'설치 링크',true);const id=input.id||appId(url);identity(url);
  if(typeof id!=='string'||! /^[a-zA-Z0-9_-]{1,80}$/.test(id))throw Error('앱 선택을 확인하세요.');
  data={app_action:action,app_url:url,app_id:id};
  if(action==='upsert'){
   data.app_name=text(input.name,80,'앱 이름',true);
   if(!['출첵형','만보기형'].includes(input.type))throw Error('유형을 확인하세요.');
   data.app_type=input.type;
   const code=text(input.code??'',200,'추천인 코드'),description=text(input.description??'',500,'소개');
   if(code)data.referral_code=code;if(description)data.app_description=description;
  }
 }else if(input.kind==='event'){
  const at=input.remindAt;
  if(!Number.isSafeInteger(at)||at<=now||at>now+365*86400000)throw Error('한국 시간 기준 미래 알림 시각을 확인하세요.');
  if(typeof input.eventId!=='string'||! /^[a-zA-Z0-9_-]{16,80}$/.test(input.eventId))throw Error('요청 번호를 확인하세요.');
  const url=text(input.url??'',800,'참여 링크');if(url)identity(url);
  data={eventId:input.eventId,title,body,url,category:'이벤트',remindAt:String(at),endAt:String(at+86400000)};
 }else throw Error('전송 종류를 확인하세요.');
 const message={topic:'events',data,notification:{title,body},android:{priority:'high',ttl:'86400s'}};
 // Event data-only delivery allows background scheduling without tapping a notification.
 if(input.kind==='event')delete message.notification;
 if(Buffer.byteLength(JSON.stringify(message))>3500)throw Error('내용이 길어요. 제목·소개를 줄여 주세요.');
 return message;
}
