import {prepareConsole,CONSOLE_URL} from './compose.js';
import {connectAuth} from './auth.js';
const $=id=>document.getElementById(id);
const editable=['app','action','type','name','url','code','description','ipo-day','ipo-url','day','time','event-url','notice-url','links-url','title','body'];
let kind='recommendation',apps=[];
let authClient,adminAllowed=false,sending=false,pending=null,lastSignature='',requestId=crypto.randomUUID(),acceptedId='';
function updateSend(){ $('send').disabled=!adminAllowed||sending||!pending||pending.eventId===acceptedId; }
connectAuth(state=>{
 adminAllowed=state.allowed;$('account-email').textContent=state.email;
 $('login').hidden=!!state.email;$('logout').hidden=!state.email;
 $('setup').textContent=state.allowed?'관리자 로그인 완료. 내용을 확인한 뒤 구독자에게 전송하세요.':state.email?'관리자 계정 tenutohahwi@gmail.com으로 로그인하세요.':'관리자 Google 로그인이 필요합니다. 작성·초안 저장은 로그인 전에도 사용할 수 있어요.';
 updateSend();
},message=>{$('setup').textContent=message;}).then(client=>{
 authClient=client;$('login').disabled=false;
}).catch(()=>{$('setup').textContent='로그인을 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침하세요. 작성·복사는 계속 사용할 수 있습니다.';});
$('login').onclick=()=>authClient?.login();$('logout').onclick=()=>authClient?.logout();
$('send').onclick=async()=>{
 if(!adminAllowed||sending||!pending)return;
 const outgoing=pending;
 sending=true;updateSend();$('confirm-status').textContent='발송 요청 중…';
 try{
  const token=await authClient.token();
  const response=await fetch('/api/send',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(outgoing)});
  const result=await response.json();if(!response.ok)throw Error(result.error||'발송 접수에 실패했어요.');
  acceptedId=outgoing.eventId;
  $('confirm-status').textContent='FCM 발송 접수 완료. 실제 수신은 휴대폰에서 확인하세요.';
 }catch(e){$('confirm-status').textContent=e.message||'전송 결과 확인 필요. 재전송 전에 휴대폰 수신을 확인하세요.';}
 finally{sending=false;updateSend();}
};

const storage={read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}},write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}};
const status=message=>$('status').textContent=message;
const draftsKey='littlemakes-admin-draft-v1',appsKey='littlemakes-admin-apps-v1';
function updatePreview(){
 $('body').maxLength=['notice','links'].includes(kind)?6000:1000;
 $('preview-title').textContent=$('title').value||'추천 앱테크를 소개해요';$('preview-body').textContent=$('body').value||'작성한 푸시 내용이 여기에 표시됩니다.';
 $('preview-card').hidden=kind!=='recommendation';$('preview-type').textContent=$('action').value==='delete'?'추천 종료':$('type').value;
 $('preview-name').textContent=$('name').value||'앱 이름';$('preview-description').textContent=$('description').value;
 $('preview-code').textContent=$('code').value?'추천인 코드 · '+$('code').value:'';
 const deleting=$('action').value==='delete';for(const id of ['name','type','code','description'])$(id).disabled=deleting;
}
function setKind(value){
 kind=value;for(const [id,target] of [['rec','recommendation'],['event','event'],['ipo','ipo'],['notice','notice'],['links','links']]){
  $('tab-'+id).setAttribute('aria-selected',String(value===target));$('tab-'+id).tabIndex=value===target?0:-1;$('form-'+id).hidden=value!==target;
 }
 if(value==='ipo'){if(!$('title').value)$('title').value='공모주 청약 마감 안내';if(!$('body').value)$('body').value='오늘 오후 4시 공모주 청약 마감입니다. 청약할 종목과 증권사를 확인하세요.';}
 updatePreview();
}
const tabs=['tab-rec','tab-ipo','tab-event','tab-notice','tab-links'];
for(const [index,target] of ['recommendation','ipo','event','notice','links'].entries())$(tabs[index]).onclick=()=>setKind(target);
for(const [index,id] of tabs.entries())$(id).onkeydown=e=>{
 if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();
 const target=e.key==='Home'?0:e.key==='End'?tabs.length-1:(index+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
 $(tabs[target]).click();$(tabs[target]).focus();
};
for(const id of editable)$(id).addEventListener('input',()=>{updatePreview();});
function fillAppOptions(selected=''){
 $('app').replaceChildren(new Option('새 앱 추가',''));
 for(const app of apps)$('app').add(new Option(app.name,app.id));$('app').value=selected;
}
$('app').onchange=()=>{
 const app=apps.find(e=>e.id===$('app').value);
 for(const key of ['name','url','code','description'])$(key).value=app?.[key]||'';
 $('type').value=app?.type||'만보기형';$('action').value='upsert';
 $('title').value=app?'추천 앱테크 · '+app.name:'';$('body').value=app?'새 추천 앱을 확인해 보세요.':'';
 updatePreview();
};
$('action').onchange=()=>{
 if($('action').value==='delete'){$('title').value='추천 앱테크 목록 변경';$('body').value=($('name').value||'앱')+' 추천이 종료됐어요. 눌러서 목록을 갱신하세요.';}
 updatePreview();
};
function collect(){
 const data={kind,title:$('title').value.trim(),body:$('body').value.trim()};
 if(!data.title||!data.body)throw Error('푸시 제목과 내용을 입력해 주세요.');
 if(kind==='recommendation'){
  Object.assign(data,{action:$('action').value,id:$('app').value||undefined,name:$('name').value.trim(),type:$('type').value,url:$('url').value.trim(),code:$('code').value.trim(),description:$('description').value.trim()});
  validateUrl(data.url);if(data.action==='upsert'&&!data.name)throw Error('앱 이름을 입력해 주세요.');
 }else if(kind==='notice'||kind==='links'){
  const url=$(kind==='links'?'links-url':'notice-url').value.trim();if(url)validateUrl(url);data.url=url;
 }else if(kind==='ipo'){
  const remindAt=Date.parse($('ipo-day').value+'T15:00:00+09:00');
  if(!Number.isSafeInteger(remindAt)||remindAt<=Date.now()||remindAt>Date.now()+365*86400000)throw Error('오후 3시가 지나지 않은 1년 이내 청약 마감일을 선택하세요.');
  const url=$('ipo-url').value.trim();if(url)validateUrl(url);Object.assign(data,{kind:'event',remindAt,endAt:remindAt+3600000,url});
 }else{
  const remindAt=Date.parse($('day').value+'T'+$('time').value+':00+09:00');
  if(!Number.isFinite(remindAt)||remindAt<=Date.now()||remindAt>Date.now()+365*86400000)throw Error('1년 이내의 미래 날짜·시각을 입력해 주세요.');
  const url=$('event-url').value.trim();if(url)validateUrl(url);Object.assign(data,{remindAt,url});
 }
 return data;
}
function validateUrl(value){let u;try{u=new URL(value);}catch{throw Error('설치·참여 링크를 확인해 주세요.');}if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('HTTP(S) 링크를 입력해 주세요.');}
async function copy(value){
 try{await navigator.clipboard.writeText(value);$('confirm-status').textContent='복사했어요. Firebase 콘솔의 해당 칸에 붙여넣으세요.';}
 catch{$('confirm-status').textContent='복사 권한이 없어요. 위 텍스트를 선택해서 복사해 주세요.';}
}
function renderFields(prepared){
 $('custom-fields').replaceChildren();
 for(const [label,key,value] of [
  ['알림 제목','',prepared.title],['알림 텍스트','',prepared.body],
  ...Object.entries(prepared.fields).map(([key,value])=>['맞춤 데이터',key,value])
 ]){
  const row=document.createElement('div');row.className='field-row';const heading=document.createElement('strong');heading.textContent=key?label+' · '+key:label;
  const content=document.createElement('div');content.textContent=value;row.append(heading,content);
  if(key){const keyButton=document.createElement('button');keyButton.textContent='키 복사';keyButton.onclick=()=>copy(key);row.append(keyButton);}
  const valueButton=document.createElement('button');valueButton.textContent='값 복사';valueButton.onclick=()=>copy(value);row.append(valueButton);$('custom-fields').append(row);
 }
}
$('compose').onsubmit=async e=>{
 e.preventDefault();$('review').disabled=true;
 try{
  const data=collect();
  const signature=JSON.stringify(data);if(signature!==lastSignature){requestId=crypto.randomUUID();lastSignature=signature;}
  const outgoing={...data,eventId:requestId},prepared=await prepareConsole(outgoing,apps);
  pending=outgoing;updateSend();
  renderFields(prepared);
  if(prepared.entry){apps=apps.filter(e=>e.id!==prepared.entry.id);apps.push(prepared.entry);storage.write(appsKey,apps);fillAppOptions(prepared.entry.id);}
  $('confirm-summary').textContent=kind==='ipo'?$('ipo-day').value+' 청약: 오후 3시 알림 · 오후 4시 마감 (한국 시간). 구독자 전체의 휴대폰에 예약합니다.':kind==='links'?'링크 모음을 구독자 전체에게 전송합니다. 사용자가 푸시를 누르면 네이버 링크 열기를 시작합니다. 표시 권한이 필요합니다.':kind==='notice'?'일반 공지를 구독자 전체에게 전송합니다. 예약 일정에는 등록하지 않습니다. 제목·내용·링크를 확인하세요.':'아래 내용이 이벤트 알림 구독자 전체에게 전달됩니다. 날짜·시각과 링크를 확인하세요.';
  $('confirm-status').textContent=pending.eventId===acceptedId?'이미 발송 접수한 내용입니다.':adminAllowed?'확인 후 구독자에게 전송을 누르세요.':'관리자 Google 로그인 후 전송할 수 있습니다.';
  $('confirm').showModal();
 }catch(e){status(e.message);}finally{$('review').disabled=false;}
};
$('cancel').onclick=()=>$('confirm').close();
for(const anchor of document.querySelectorAll('[data-console]'))anchor.href=CONSOLE_URL;
$('save').onclick=()=>{
 const fields=Object.fromEntries(editable.map(id=>[id,$(id).value]));
 status(storage.write(draftsKey,{kind,fields})?'초안을 이 브라우저에 저장했어요.':'저장하지 못했어요. 브라우저 저장 권한을 확인하세요.');
};
$('restore').onclick=()=>{
 const draft=storage.read(draftsKey,null);if(!draft?.fields){status('저장한 초안이 없어요.');return;}
 for(const [key,value] of Object.entries(draft.fields))if(editable.includes(key)&&typeof value==='string')$(key).value=value;
 setKind(['event','notice','links','ipo'].includes(draft.kind)?draft.kind:'recommendation');status('초안을 불러왔어요. 전송 전에 내용을 확인해 주세요.');
};
async function boot(){
 const next=new Date(Date.now()+600000+9*3600000).toISOString();$('ipo-day').value=new Date(Date.now()+9*3600000+(new Date(Date.now()+9*3600000).getUTCHours()>=15?86400000:0)).toISOString().slice(0,10);$('day').value=next.slice(0,10);$('time').value=next.slice(11,16);
 try{const response=await fetch('apps.json');if(!response.ok)throw Error();apps=await response.json();const saved=storage.read(appsKey,[]);if(Array.isArray(saved))for(const entry of saved){if(!entry||typeof entry.id!=='string'||typeof entry.name!=='string')continue;apps=apps.filter(e=>e.id!==entry.id);apps.push(entry);}fillAppOptions();}catch{status('기본 목록을 불러오지 못했어요. 새 앱은 직접 작성할 수 있어요.');}
 updatePreview();
}
boot();
