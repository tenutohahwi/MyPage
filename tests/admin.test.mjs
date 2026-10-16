import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createSign} from 'node:crypto';
import {buildMessage,appId,BUILT_INS,PROJECT,OWNER} from '../lib/messages.mjs';
import {verifyAdmin,serviceToken} from '../lib/firebase.mjs';
import {createHandler} from '../lib/handler.mjs';
const fixture={kind:'recommendation',action:'upsert',title:'건강의신',body:'추천 앱 안내',name:'건강의신',type:'만보기형',url:BUILT_INS[1].url,code:'Q49V5G',description:''};
const request=(body=fixture,headers={},method='POST')=>new Request('https://mypage.example/api/admin',{method,headers:{Origin:'https://mypage.example','Content-Type':'application/json',Authorization:'Bearer admin-token',...headers},...(method==='POST'?{body:JSON.stringify(body)}:{})});
test('recommendation uses separate fields and stable bundled identity',()=>{
 const message=buildMessage(fixture);assert.equal(message.data.app_id,'godofhealth');assert.equal(message.data.referral_code,'Q49V5G');assert.equal(message.notification.title,'건강의신');assert.equal(message.topic,'events');assert(!('recommended_app' in message.data));
 assert.equal(appId(fixture.url.replace('hl=ko','hl=en')),'godofhealth');
 for(const entry of BUILT_INS)assert.equal(appId(entry.url),entry.id);
});
test('deletion requires only action, link and notification; optional fields clear',()=>{
 const message=buildMessage({kind:'recommendation',action:'delete',url:fixture.url,title:'삭제',body:'변경'});
 assert.deepEqual(message.data,{app_action:'delete',app_url:fixture.url,app_id:'godofhealth'});
 assert(!('referral_code' in buildMessage({...fixture,code:''}).data));
});
test('invalid URLs, unsupported category, invalid ID and oversized payload are rejected',()=>{
 for(const change of [{url:'javascript:alert(1)'},{url:'https://user:secret@example.com'},{type:'unknown'},{id:'invalid id'},{name:''},{kind:'unknown'},{description:'가'.repeat(501)}])assert.throws(()=>buildMessage({...fixture,...change}));
});
test('event uses data-only scheduling, a stable request ID and future Korea time',()=>{
 const at=Date.now()+60000;const message=buildMessage({kind:'event',eventId:'12345678-1234-1234',title:'일정',body:'내용',remindAt:at,url:''});
 assert.equal(message.data.remindAt,String(at));assert.equal(message.data.endAt,String(at+86400000));assert(!message.notification);
 assert.throws(()=>buildMessage({kind:'event',eventId:'12345678-1234-1234',title:'일정',body:'내용',remindAt:0,url:''}));
});
test('send stays disabled without configuration and unauthenticated requests never send',async()=>{
 let calls=0;const handler=createHandler({env:{},authorize:async()=>true,fetcher:async()=>{calls++;throw Error();}});
 assert.equal((await handler(request())).status,503);assert.equal(calls,0);
 const denied=createHandler({env:{ADMIN_SEND_ENABLED:'true',FIREBASE_SERVICE_ACCOUNT:'{}'},authorize:async()=>false});assert.equal((await denied(request())).status,403);
 assert.equal((await handler(request(fixture,{Origin:'https://other.example'}))).status,403);
 assert.equal((await handler(request(fixture,{'Content-Type':'text/plain'}))).status,415);
});
test('valid request sends only to the fixed project/topic and returns accepted app identity',async()=>{
 let sent;
 const handler=createHandler({env:{ADMIN_SEND_ENABLED:'true',FIREBASE_SERVICE_ACCOUNT:'{}'},authorize:async()=>true,getToken:async()=> 'service-token',fetcher:async(url,options)=>{assert.equal(url,`https://fcm.googleapis.com/v1/projects/${PROJECT}/messages:send`);sent=JSON.parse(options.body);return Response.json({name:'projects/test/messages/123'});}});
 const response=await handler(request({...fixture,topic:'arbitrary'}));assert.equal(response.status,200);assert.equal((await response.json()).appId,'godofhealth');assert.equal(sent.message.topic,'events');
 assert.equal((await handler(request({...fixture,type:'invalid'}))).status,400);
});
test('malformed JSON, failed service credentials and ambiguous FCM response handled safely',async()=>{
 const env={ADMIN_SEND_ENABLED:'true',FIREBASE_SERVICE_ACCOUNT:'{}'},base={env,authorize:async()=>true};
 assert.equal((await createHandler({...base,getToken:async()=>{throw Error('secret');}})(request())).status,503);
 const response=await createHandler({...base,getToken:async()=> 'x',fetcher:async()=>{throw Error('private');}})(request());assert.equal(response.status,502);assert(!(await response.text()).includes('private'));
 const malformed=new Request('https://mypage.example/api/admin',{method:'POST',headers:{Origin:'https://mypage.example','Content-Type':'application/json'},body:'{'});assert.equal((await createHandler(base)(malformed)).status,400);
});
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const now=Date.now(),seconds=Math.floor(now/1000);
const claims={aud:PROJECT,iss:'https://securetoken.google.com/'+PROJECT,sub:'user123',exp:seconds+3600,iat:seconds,auth_time:seconds,email:OWNER,email_verified:true};
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
function jwt(claims,header={alg:'RS256',kid:'test-key'}){const unsigned=encode(header)+'.'+encode(claims);return unsigned+'.'+createSign('RSA-SHA256').update(unsigned).sign(privateKey,'base64url');}
const certs=async()=>Response.json({'test-key':publicKey.export({type:'spki',format:'pem'})});
test('admin authentication verifies signature, project, owner, email verification and expiration',async()=>{
 assert.equal(await verifyAdmin(jwt(claims),{fetcher:certs,now}),true);
 for(const changes of [{aud:'other-project'},{email:'someone@example.com'},{email_verified:false},{exp:seconds-1},{iss:'https://evil.example'},{sub:''}])assert.equal(await verifyAdmin(jwt({...claims,...changes}),{fetcher:certs,now}),false);
 assert.equal(await verifyAdmin(jwt(claims).slice(0,-5)+'xxxxx',{fetcher:certs,now}),false);
 assert.equal(await verifyAdmin(jwt(claims,{alg:'none',kid:'test-key'}),{fetcher:certs,now}),false);
 assert.equal(await verifyAdmin(undefined,{fetcher:certs,now}),false);
});
test('service token scopes requests to Firebase Messaging and refuses foreign project',async()=>{
 const account={project_id:PROJECT,client_email:'test@example.com',private_key:privateKey.export({type:'pkcs8',format:'pem'})};
 const value=await serviceToken(account,{now,fetcher:async(url,options)=>{
  assert.equal(url,'https://oauth2.googleapis.com/token');const unsigned=options.body.get('assertion').split('.');const payload=JSON.parse(Buffer.from(unsigned[1],'base64url'));assert.equal(payload.scope,'https://www.googleapis.com/auth/firebase.messaging');return Response.json({access_token:'ok'});
 }});assert.equal(value,'ok');await assert.rejects(()=>serviceToken({...account,project_id:'other'}));
});
