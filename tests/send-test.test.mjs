import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import handler from '../api/send-test.mjs';
import {send,sendTest} from '../lib/send.mjs';
const origin='https://sender.example';
const registrationToken='test-device-token-'.repeat(10);
const input=()=>({kind:'links',eventId:'single-device-test-123456',title:'[테스트] 오늘 링크',body:'방문 적립\nhttps://campaign2.naver.com/npay/v2/click-point/?eventId=example',registrationToken});
const req=(body=input(),path='/api/send-test',extra={})=>new Request(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer admin-token',...extra},body:JSON.stringify(body)});
test('device test requires administrator and POST just like the normal endpoint',async()=>{
 assert.equal((await handler.fetch(new Request(origin+'/api/send-test'))).status,405);
 assert.equal((await sendTest(req(input(),undefined,{Authorization:''}),{})).status,403);
 assert.equal((await sendTest(req(input(),undefined,{Origin:'https://evil.example'}),{})).status,403);
});
test('missing/invalid token cannot reach FCM, and normal endpoint rejects device selectors',async t=>{
 t.mock.method(globalThis,'fetch',async url=>{assert.ok(url.includes('accounts:lookup'));return Response.json({users:[{email:'tenutohahwi@gmail.com',emailVerified:true}]});});
 for(const token of [undefined,'','short',null,123,'x'.repeat(4097),'https://example.com/'+registrationToken]){
  assert.equal((await sendTest(req({...input(),registrationToken:token}),{})).status,400);
 }
 assert.equal((await sendTest(req({...input(),kind:'notice'}),{})).status,400);
 assert.equal((await send(req(input(),'/api/send'),{})).status,400);
});
test('authorized test sends ONLY the exact supplied token; no topic/condition or retry',async t=>{
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const env={FIREBASE_SERVICE_ACCOUNT:JSON.stringify({project_id:'littlemakes-16ea4',client_email:'test@example.com',private_key:privateKey.export({type:'pkcs8',format:'pem'})})};
 let calls=0;
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  if(url.includes('accounts:lookup'))return Response.json({users:[{email:'tenutohahwi@gmail.com',emailVerified:true}]});
  if(url.includes('oauth2.googleapis.com'))return Response.json({access_token:'fake-access-token'});
  calls++;const m=JSON.parse(options.body).message;
  assert.equal(m.token,registrationToken);assert.equal(m.topic,undefined);assert.equal(m.condition,undefined);
  assert.equal(m.data.notice_action,'links');assert.equal(m.data.notice_title,'[테스트] 오늘 링크');
  return Response.json({name:'projects/test/messages/single-device'});
 });
 const result=await handler.fetch(req()); // no credentials are read by this test
 assert.equal(result.status,503);
 assert.equal((await sendTest(req(),env)).status,200);assert.equal(calls,1);
});
