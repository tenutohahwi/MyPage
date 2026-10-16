export const CONSOLE_URL='https://console.firebase.google.com/project/littlemakes-16ea4/messaging';
export function linkIdentity(value){
 let url;try{url=new URL(value);}catch{throw Error('설치·참여 링크를 확인해 주세요.');}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('HTTP(S) 링크를 입력해 주세요.');
 if(url.hostname==='play.google.com'&&url.pathname==='/store/apps/details'&&url.searchParams.get('id'))return 'play:'+url.searchParams.get('id');
 url.hash='';return url.href;
}
function text(value,max,label,required=false){if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw Error(label+'을 확인해 주세요.');return value.trim();}
export async function prepareConsole(input,apps=[],now=Date.now()){
 const title=text(input.title,80,'푸시 제목',true),body=text(input.body,1000,'푸시 내용',true);
 let fields,entry,notificationBody=body;
 if(input.kind==='recommendation'){
  if(!['upsert','delete'].includes(input.action))throw Error('작업을 확인해 주세요.');
  const url=text(input.url,800,'설치 링크',true),identity=linkIdentity(url);
  const previous=apps.find(e=>e.url&&linkIdentity(e.url)===identity);
  let id=input.id||previous?.id;
  if(!id){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity));id='app_'+Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');}
  if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id))throw Error('앱 선택을 확인하세요.');
  fields={app_action:input.action,app_url:url};
  // Keep a selected app's identity even if its link has changed.
  if(input.id)fields.app_id=input.id;
  if(input.action==='upsert'){
   const name=text(input.name,80,'앱 이름',true),code=text(input.code??'',200,'추천인 코드'),description=text(input.description??'',500,'앱 소개');
   if(!['만보기형','출첵형'].includes(input.type))throw Error('유형을 확인해 주세요.');
   fields.app_name=name;fields.app_type=input.type;if(code)fields.referral_code=code;if(description)fields.app_description=description;
   entry={id,name,type:input.type,code,description,url};
  }
 }else if(input.kind==='event'){
  const at=input.remindAt;
  if(!Number.isSafeInteger(at)||at<=now||at>now+365*86400000)throw Error('1년 이내의 미래 날짜·시각을 입력해 주세요.');
  const url=text(input.url??'',800,'참여 링크');if(url)linkIdentity(url);
  const korea=new Date(at+9*3600000).toISOString();
  const formatted=korea.slice(2,10).replaceAll('-','')+'-'+korea.slice(11,16)+' '+body+(url?'\n'+url:'');
  fields={event_message:formatted,event_title:title};if(url)fields.url=url;
  notificationBody=formatted;
 }else throw Error('작성 종류를 확인해 주세요.');
 if(new TextEncoder().encode(JSON.stringify({notification:{title,body:notificationBody},data:fields})).length>3500)throw Error('내용이 길어요. 제목이나 소개를 줄여 주세요.');
 return {title,body:notificationBody,fields,entry};
}
