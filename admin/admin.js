const $=id=>document.getElementById(id);
const editable=['app','action','type','name','url','code','description','day','time','event-url','title','body'];
let kind='recommendation',apps=[],user=null,auth=null,sdk=null,enabled=false,sending=false,pending=null,eventId=crypto.randomUUID(),lastAccepted='';
const storage={read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}},write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}};
const status=message=>$('status').textContent=message;
const draftsKey='littlemakes-admin-draft-v1',appsKey='littlemakes-admin-apps-v1',historyKey='littlemakes-admin-history-v1';
function allowed(){return user?.email==='tenutohahwi@gmail.com'&&user.emailVerified;}
function refreshSend(){ $('send').disabled=!allowed()||!enabled||sending; }
function updatePreview(){
 $('preview-title').textContent=$('title').value||'추천 앱테크를 소개해요';$('preview-body').textContent=$('body').value||'작성한 푸시 내용이 여기에 표시됩니다.';
 $('preview-card').hidden=kind!=='recommendation';$('preview-type').textContent=$('action').value==='delete'?'추천 종료':$('type').value;
 $('preview-name').textContent=$('name').value||'앱 이름';$('preview-description').textContent=$('description').value;
 $('preview-code').textContent=$('code').value?'추천인 코드 · '+$('code').value:'';
 const deleting=$('action').value==='delete';for(const id of ['name','type','code','description'])$(id).disabled=deleting;
}
function setKind(value){
 kind=value;for(const [id,target] of [['rec','recommendation'],['event','event']]){
  $('tab-'+id).setAttribute('aria-selected',String(value===target));$('tab-'+id).tabIndex=value===target?0:-1;$('form-'+id).hidden=value!==target;
 }
 eventId=crypto.randomUUID();updatePreview();
}
$('tab-rec').onclick=()=>setKind('recommendation');$('tab-event').onclick=()=>setKind('event');
for(const id of ['tab-rec','tab-event'])$(id).onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const target=kind==='event'?'tab-rec':'tab-event';$(target).click();$(target).focus();}};
for(const id of editable)$(id).addEventListener('input',()=>{eventId=crypto.randomUUID();updatePreview();});
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
 }else{
  const remindAt=Date.parse($('day').value+'T'+$('time').value+':00+09:00');
  if(!Number.isFinite(remindAt)||remindAt<=Date.now()||remindAt>Date.now()+365*86400000)throw Error('1년 이내의 미래 날짜·시각을 입력해 주세요.');
  const url=$('event-url').value.trim();if(url)validateUrl(url);Object.assign(data,{remindAt,url,eventId});
 }
 return data;
}
function validateUrl(value){let u;try{u=new URL(value);}catch{throw Error('설치·참여 링크를 확인해 주세요.');}if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('HTTP(S) 링크를 입력해 주세요.');}
function customFields(data){
 if(data.kind==='event')return {eventId:data.eventId,title:data.title,body:data.body,url:data.url,category:'이벤트',remindAt:String(data.remindAt),endAt:String(data.remindAt+86400000)};
 const fields={app_action:data.action,app_url:data.url};if(data.id)fields.app_id=data.id;
 if(data.action==='upsert'){Object.assign(fields,{app_name:data.name,app_type:data.type});if(data.code)fields.referral_code=data.code;if(data.description)fields.app_description=data.description;}
 return fields;
}
function renderFields(data){
 $('custom-fields').replaceChildren();
 for(const [key,value] of Object.entries(customFields(data))){
  const row=document.createElement('div');row.className='field-row';const label=document.createElement('strong');label.textContent=key;
  const text=document.createElement('div');text.textContent=value;row.append(label,text);
  if(data.kind==='recommendation')for(const [title,valueToCopy] of [['키 복사',key],['값 복사',value]]){
   const button=document.createElement('button');button.textContent=title;button.onclick=async()=>{try{await navigator.clipboard.writeText(valueToCopy);$('confirm-status').textContent='복사했어요.';}catch{$('confirm-status').textContent='복사 권한이 없어요. 위 텍스트를 선택해서 복사해 주세요.';}};row.append(button);
  }
  $('custom-fields').append(row);
 }
}
$('compose').onsubmit=e=>{
 e.preventDefault();if(sending)return;
 try{
  pending=collect();renderFields(pending);
  $('confirm-summary').textContent=(pending.kind==='event'?'이벤트 알림':'추천 앱 '+(pending.action==='delete'?'삭제':'추가·수정'))+'\n제목: '+pending.title+'\n내용: '+pending.body;
  $('confirm-status').textContent=enabled?'관리자 로그인 후 전송할 수 있어요.':'발송 설정 전입니다. 추천 앱은 위 키·값을 복사해 Firebase 콘솔에서도 보낼 수 있어요.';
  refreshSend();$('confirm').showModal();
 }catch(e){status(e.message);}
};
$('cancel').onclick=()=>{if(!sending)$('confirm').close();};
$('confirm').addEventListener('cancel',e=>{if(sending)e.preventDefault();});
$('save').onclick=()=>{
 const fields=Object.fromEntries(editable.map(id=>[id,$(id).value]));
 status(storage.write(draftsKey,{kind,fields})?'초안을 이 브라우저에 저장했어요.':'저장하지 못했어요. 브라우저 저장 권한을 확인하세요.');
};
$('restore').onclick=()=>{
 const draft=storage.read(draftsKey,null);if(!draft?.fields){status('저장한 초안이 없어요.');return;}
 for(const [key,value] of Object.entries(draft.fields))if(editable.includes(key)&&typeof value==='string')$(key).value=value;
 setKind(draft.kind==='event'?'event':'recommendation');status('초안을 불러왔어요. 전송 전에 내용을 확인해 주세요.');
};
function renderHistory(){
 const history=storage.read(historyKey,[]);$('history').replaceChildren();
 for(const entry of history.slice(0,8)){const li=document.createElement('li');li.textContent=new Date(entry.at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' · '+entry.title+' · 접수 완료';$('history').append(li);}
 if(!history.length){const li=document.createElement('li');li.textContent='아직 이 브라우저에서 발송한 내역이 없어요.';$('history').append(li);}
}
$('send').onclick=async()=>{
 if(sending||!allowed()||!enabled||!pending)return;
 const serialized=JSON.stringify(pending);if(lastAccepted===serialized){$('confirm-status').textContent='이미 발송 접수한 내용입니다. 내용을 변경한 뒤 다시 확인하세요.';return;}
 sending=true;refreshSend();$('cancel').disabled=true;$('confirm-status').textContent='발송을 요청하고 있어요…';
 try{
  const token=await user.getIdToken();
  const response=await fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:serialized,signal:AbortSignal.timeout(25000)});
  const result=await response.json();if(!response.ok)throw Error(result.error||'전송 결과를 확인하지 못했어요.');
  lastAccepted=serialized;
  storage.write(historyKey,[{at:Date.now(),title:pending.title,messageId:result.messageId},...storage.read(historyKey,[])].slice(0,20));renderHistory();
  if(pending.kind==='recommendation'&&pending.action==='upsert'){
   const entry={id:result.appId,name:pending.name,type:pending.type,url:pending.url,code:pending.code,description:pending.description};
   apps=apps.filter(e=>e.id!==entry.id);apps.push(entry);storage.write(appsKey,apps);fillAppOptions(entry.id);
  }
  $('confirm-status').textContent='FCM 발송 접수 완료. 사용자 휴대폰에서 수신을 확인해 주세요.';status('발송 요청이 접수됐어요.');
 }catch(e){$('confirm-status').textContent=e.name==='TimeoutError'?'응답을 기다리는 시간이 지났어요. 다시 보내기 전에 휴대폰 수신을 먼저 확인하세요.':e.message;}
 finally{sending=false;$('cancel').disabled=false;refreshSend();}
};
$('login').onclick=async()=>{if(!auth)return;try{await sdk.signInWithPopup(auth,new sdk.GoogleAuthProvider());}catch{status('로그인하지 못했어요. 팝업 허용과 Firebase 승인 도메인을 확인하세요.');}};
$('logout').onclick=async()=>{if(auth)await sdk.signOut(auth);};
async function boot(){
 $('login').disabled=true;
 const next=new Date(Date.now()+600000+9*3600000).toISOString();$('day').value=next.slice(0,10);$('time').value=next.slice(11,16);
 try{const response=await fetch('apps.json');if(!response.ok)throw Error();apps=await response.json();const saved=storage.read(appsKey,[]);if(Array.isArray(saved))for(const entry of saved){if(!entry||typeof entry.id!=='string'||typeof entry.name!=='string')continue;apps=apps.filter(e=>e.id!==entry.id);apps.push(entry);}fillAppOptions();}catch{status('기본 목록을 불러오지 못했어요. 새 앱은 직접 작성할 수 있어요.');}
 try{const response=await fetch('/api/admin');if(!response.ok)throw Error();const config=await response.json();enabled=config.enabled===true;}catch{enabled=false;}
 $('setup').textContent=enabled?'발송 서버가 연결됐어요. 관리자 Google 계정으로 로그인하세요.':'준비 모드 · 초안 작성과 추천 앱 키·값 복사를 사용할 수 있어요. 직접 발송은 서버 환경변수 설정 후 켤 수 있습니다.';
 updatePreview();renderHistory();
 try{
  const [{initializeApp},authSdk,{firebaseConfig}]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),import('./firebase-config.js')]);
  sdk=authSdk;auth=sdk.getAuth(initializeApp(firebaseConfig));await sdk.setPersistence(auth,sdk.browserSessionPersistence);$('login').disabled=false;
  sdk.onAuthStateChanged(auth,value=>{user=value;$('account').textContent=value?.email||'로그인 전';$('login').hidden=!!value;$('logout').hidden=!value;if(value&&!allowed())status('이 계정에는 관리자 권한이 없어요.');refreshSend();});
 }catch{$('account').textContent='로그인 연결 안 됨';status('로그인 연결을 확인해 주세요. 초안 작성과 추천 앱 키·값 복사는 계속 사용할 수 있어요.');}
}
boot();
