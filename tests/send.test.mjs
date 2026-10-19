import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,generateKeyPairSync} from 'node:crypto';
import handler from '../api/send.mjs';
import {message,send} from '../lib/send.mjs';
const origin='https://sender.example';
const valid=()=>({kind:'event',eventId:'test-event-123456789',title:'테스트',body:'알림 내용',url:'https://example.com',remindAt:Date.now()+600000});
const request=(body=valid(),extra={})=>new Request(origin+'/api/send',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer test-token',...extra},body:typeof body==='string'?body:JSON.stringify(body)});
test('data-only message automatically registers in Android; TTL ends at reminder',async()=>{
 const now=Date.now(),data=valid(),result=await message(data,now);
 assert.equal(result.topic,'events');assert.equal(result.notification,undefined);
 assert.equal(result.data.eventId,data.eventId);assert.equal(result.data.remindAt,String(data.remindAt));
 assert.equal(result.android.priority,'high');assert.equal(result.android.ttl,'600s');
 assert.ok(Object.values(result.data).every(v=>typeof v==='string'));
});
test('reject expired, excessive, unsafe and malformed input',async()=>{
 for(const change of [{remindAt:0},{remindAt:Date.now()+366*86400000},{url:'javascript:alert(1)'},{url:'https://user:pass@example.com'},{eventId:undefined},{title:''},{body:'한'.repeat(900)}])await assert.rejects(()=>message({...valid(),...change}));
});
test('API blocks wrong method, origin and missing authentication before network access',async()=>{
 assert.equal((await handler.fetch(new Request(origin+'/api/send'))).status,405);
 assert.equal((await send(request(valid(),{Origin:'https://evil.example'}),{})).status,403);
 assert.equal((await send(request(valid(),{Authorization:''}),{})).status,403);
});
test('server checks administrator and FCM credentials; signs JWT and sends no notification payload',async t=>{
 const account={email:'tenutohahwi@gmail.com',emailVerified:true};let fcmCalls=0;
 t.mock.method(globalThis,'fetch',async (url,options)=>{
  if(url.includes('accounts:lookup'))return Response.json({users:[account]});
  if(url.includes('oauth2.googleapis.com')){assert.equal(options.body.get('assertion').split('.').length,3);return Response.json({access_token:'access-test'});}
  assert.ok(url.includes('/projects/littlemakes-16ea4/messages:send'));assert.equal(options.headers.Authorization,'Bearer access-test');
  assert.equal(JSON.parse(options.body).message.notification,undefined);fcmCalls++;return Response.json({name:'projects/test/messages/123'});
 });
 for(const change of [{email:'other@example.com'},{emailVerified:false},{disabled:true}]){
  const original={...account};Object.assign(account,change);assert.equal((await send(request(),{})).status,403);Object.keys(account).forEach(k=>delete account[k]);Object.assign(account,original);
 }
 assert.equal((await send(request('{bad'),{})).status,400);
 assert.equal((await send(request(),{})).status,503);
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const env={FIREBASE_SERVICE_ACCOUNT:JSON.stringify({project_id:'littlemakes-16ea4',client_email:'test@example.com',private_key:privateKey.export({type:'pkcs8',format:'pem'})})};
 const result=await send(request(),env);assert.equal(result.status,200);assert.equal((await result.json()).state,'accepted');assert.equal(fcmCalls,1);
});

test('recommendations keep notification plus separate fields for Android tap handling',async()=>{
 const data={kind:'recommendation',action:'upsert',id:'godofhealth',title:'추천 앱',body:'새 추천을 확인하세요',name:'건강의신',type:'만보기형',url:'https://example.com/app',code:'CODE',description:'소개'};
 const result=await message(data);
 assert.deepEqual(result.notification,{title:data.title,body:data.body});
 assert.equal(result.data.app_id,'godofhealth');assert.equal(result.data.app_action,'upsert');assert.equal(result.data.referral_code,'CODE');assert.equal(result.data.eventId,undefined);
 const deleted=await message({...data,action:'delete'});assert.equal(deleted.data.app_action,'delete');assert.equal(deleted.data.app_name,undefined);
 await assert.rejects(()=>message({...data,type:'invalid'}));await assert.rejects(()=>message({...data,url:'javascript:alert(1)'}));
 await assert.rejects(()=>message({...valid(),kind:'unknown'}));
});

test('notices display once and carry only notice fields, even with legacy reminder input',async()=>{
 const data={...valid(),kind:'notice',body:'991231-23:00 날짜가 포함된 일반 공지',event_message:'991231-23:00 예약 아님',endAt:Date.now()+86400000};
 const result=await message(data);
 assert.deepEqual(result.notification,{title:data.title,body:'[공지] '+data.body});
 assert.equal(result.data.message_type,'notice');assert.equal(result.data.notice_id,data.eventId);
 assert.equal(result.data.notice_title,data.title);assert.equal(result.data.notice_body,data.body);assert.equal(result.data.notice_url,data.url);
 assert.deepEqual(Object.keys(result.data).sort(),['message_type','notice_id','notice_title','notice_body','notice_url'].sort());
 for(const key of ['eventId','remindAt','endAt','event_message','app_action'])assert.equal(result.data[key],undefined);
 assert.equal(result.android.notification.tag,'notice_'+data.eventId);assert.equal(result.android.ttl,'86400s');
 const noLink=await message({kind:'notice',eventId:data.eventId,title:'공지',body:'예약 없는 공지'});assert.equal(noLink.data.notice_url,'');
});
test('notice validation rejects missing content, invalid ID, unsafe links and UTF-8 overflow',async()=>{
 const data={kind:'notice',eventId:'notice-request-12345',title:'공지',body:'내용',url:''};
 for(const change of [{title:''},{body:''},{title:'a'.repeat(81)},{body:'a'.repeat(6001)},{body:randomBytes(4500).toString('base64')},{eventId:'bad id'},{eventId:null},{url:'javascript:alert(1)'},{url:'https://user:pass@example.com'},{url:12}])await assert.rejects(()=>message({...data,...change}));
});

test('long link notices fit FCM via bounded gzip, with a short notification preview',async()=>{
 const body='클릭 적립 안내\n'+Array.from({length:45},(_,i)=>'방문 혜택 '+i+'\nhttps://campaign.example.com/npay/v2/click-point/?eventId=cr_2026101905_2610_0955_'+i).join('\n');
 const result=await message({kind:'notice',eventId:'bulk-links-notice-12345',title:'클릭적립',body,url:''});
 assert.equal(result.data.notice_body,undefined);assert.ok(result.data.notice_body_gzip);
 const {gunzipSync}=await import('node:zlib');assert.equal(gunzipSync(Buffer.from(result.data.notice_body_gzip,'base64')).toString(),body);
 assert.ok(Buffer.byteLength(JSON.stringify(result))<=3500);assert.ok(result.notification.body.length<160);assert.equal(result.data.remindAt,undefined);
});

test('link pushes carry a tap action, preserve URLs and remain compatible with notice readers',async()=>{
 const body='오늘 링크\nhttps://example.com/a?eventId=one&x=2\nhttps://example.com/b';
 const result=await message({kind:'links',eventId:'links-request-123456',title:'오늘의 링크',body,url:''});
 assert.equal(result.data.message_type,'notice');assert.equal(result.data.notice_action,'links');
 assert.equal(result.data.notice_body,body);assert.ok(result.notification.body.startsWith('[링크 모음]'));
 for(const key of ['eventId','remindAt','event_message'])assert.equal(result.data[key],undefined);
 await assert.rejects(()=>message({kind:'links',eventId:'links-request-123456',title:'링크',body:'링크 없음'}));
 await assert.rejects(()=>message({kind:'links',eventId:'links-request-123456',title:'링크',body:'https://user:pass@example.com'}));
 const separate=await message({kind:'links',eventId:'links-request-123456',title:'링크',body:'추가 링크',url:'https://example.com'});
 assert.equal(separate.data.notice_action,'links');
 const many=Array.from({length:50},(_,i)=>'방문 '+i+'\nhttps://example.com/reward?eventId=campaign_2026101905_2610_0955_'+i).join('\n');
 const compressed=await message({kind:'links',eventId:'links-request-123456',title:'링크',body:many});
 assert.equal(compressed.data.notice_action,'links');assert.ok(compressed.data.notice_body_gzip);assert.ok(Buffer.byteLength(JSON.stringify(compressed))<=3500);
 const {gunzipSync}=await import('node:zlib');assert.equal(gunzipSync(Buffer.from(compressed.data.notice_body_gzip,'base64')).toString(),many);
});
