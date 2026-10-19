import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
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
