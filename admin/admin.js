import {prepareConsole,CONSOLE_URL} from './compose.js';
const $=id=>document.getElementById(id);
const editable=['app','action','type','name','url','code','description','day','time','event-url','title','body'];
let kind='recommendation',apps=[];
const storage={read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}},write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}};
const status=message=>$('status').textContent=message;
const draftsKey='littlemakes-admin-draft-v1',appsKey='littlemakes-admin-apps-v1';
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
 updatePreview();
}
$('tab-rec').onclick=()=>setKind('recommendation');$('tab-event').onclick=()=>setKind('event');
for(const id of ['tab-rec','tab-event'])$(id).onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const target=kind==='event'?'tab-rec':'tab-event';$(target).click();$(target).focus();}};
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
  const data=collect(),prepared=await prepareConsole(data,apps);
  renderFields(prepared);
  if(prepared.entry){apps=apps.filter(e=>e.id!==prepared.entry.id);apps.push(prepared.entry);storage.write(appsKey,apps);fillAppOptions(prepared.entry.id);}
  $('confirm-summary').textContent='제목과 본문을 복사하고, 맞춤 데이터는 아래 항목을 한 행씩 추가하세요.';
  $('confirm-status').textContent='내용을 복사한 뒤 콘솔 열기를 눌러 직접 전송하세요.';
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
 setKind(draft.kind==='event'?'event':'recommendation');status('초안을 불러왔어요. 전송 전에 내용을 확인해 주세요.');
};
async function boot(){
 const next=new Date(Date.now()+600000+9*3600000).toISOString();$('day').value=next.slice(0,10);$('time').value=next.slice(11,16);
 try{const response=await fetch('apps.json');if(!response.ok)throw Error();apps=await response.json();const saved=storage.read(appsKey,[]);if(Array.isArray(saved))for(const entry of saved){if(!entry||typeof entry.id!=='string'||typeof entry.name!=='string')continue;apps=apps.filter(e=>e.id!==entry.id);apps.push(entry);}fillAppOptions();}catch{status('기본 목록을 불러오지 못했어요. 새 앱은 직접 작성할 수 있어요.');}
 updatePreview();
}
boot();
