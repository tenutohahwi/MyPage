import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareConsole,linkIdentity,CONSOLE_URL} from '../admin/compose.js';
const apps=JSON.parse(await readFile(new URL('../admin/apps.json',import.meta.url)));
const fixture={kind:'recommendation',action:'upsert',title:'추천 앱',body:'추천 내용',name:'건강의신',type:'만보기형',url:apps[1].url,code:'Q49V5G',description:''};
test('recommendation fields can be copied separately without JSON or sending',async()=>{
 const prepared=await prepareConsole(fixture,apps);assert.equal(prepared.fields.referral_code,'Q49V5G');assert.equal(prepared.fields.app_name,'건강의신');assert.equal(prepared.fields.app_type,'만보기형');assert.equal(prepared.entry.id,'godofhealth');assert(!('recommended_app' in prepared.fields));assert(!('app_description' in prepared.fields));assert.equal(prepared.title,fixture.title);
 assert.equal(linkIdentity(fixture.url),linkIdentity(fixture.url.replace('hl=ko','hl=en')));
});
test('delete requires action and original installation URL',async()=>{
 const prepared=await prepareConsole({kind:'recommendation',action:'delete',title:'삭제 안내',body:'추천 종료',url:fixture.url},apps);
 assert.deepEqual(prepared.fields,{app_action:'delete',app_url:fixture.url});assert(!prepared.entry);
});
test('new apps have stable identity and edited links keep selected identity',async()=>{
 const first=await prepareConsole({...fixture,url:'https://example.com/app'},apps),second=await prepareConsole({...fixture,url:'https://example.com/app'},apps);assert.equal(first.entry.id,second.entry.id);
 const edit={...fixture,id:'godofhealth',url:'https://example.com/new-link'};
 const changed=await prepareConsole(edit,apps);assert.equal(changed.fields.app_id,'godofhealth');
 const again=await prepareConsole(edit,[changed.entry]);assert.equal(again.fields.app_id,'godofhealth');
});
test('event creates a Korea-time event_message and matching console notification body',async()=>{
 const now=Date.parse('2026-10-16T00:00:00Z'),at=Date.parse('2026-10-16T02:30:00Z');
 const prepared=await prepareConsole({kind:'event',title:'쿠폰',body:'쿠폰 시작',remindAt:at,url:'https://example.com/event'},apps,now);
 assert.equal(prepared.fields.event_message,'261016-11:30 쿠폰 시작\nhttps://example.com/event');assert.equal(prepared.body,prepared.fields.event_message);assert.equal(prepared.fields.event_title,'쿠폰');assert.equal(prepared.fields.url,'https://example.com/event');assert(!('remindAt' in prepared.fields));
});
test('invalid inputs are rejected before copying',async()=>{
 for(const changes of [{url:'javascript:alert(1)'},{type:'unknown'},{action:'unknown'},{name:''},{id:'bad id'},{title:''}])await assert.rejects(()=>prepareConsole({...fixture,...changes},apps));
 await assert.rejects(()=>prepareConsole({kind:'event',title:'일정',body:'내용',remindAt:0,url:''},apps));
});
test('console fallback remains alongside the authenticated direct sender',async()=>{
 assert.equal(CONSOLE_URL,'https://console.firebase.google.com/project/littlemakes-16ea4/messaging');
 const html=await readFile(new URL('../admin/index.html',import.meta.url),'utf8');
 assert(html.includes('id="send"'));assert(html.includes('관리자 Google 로그인'));assert(html.includes('콘솔 열기'));
});
test('notice preview needs no date, preserves raw body and has no calendar fields',async()=>{
 const data={kind:'notice',eventId:'notice-preview-12345',title:'공지',body:'공지 내용',url:'https://example.com/notice'};
 const prepared=await prepareConsole(data);
 assert.equal(prepared.body,'[공지] 공지 내용');assert.equal(prepared.fields.notice_body,'공지 내용');assert.equal(prepared.fields.notice_id,data.eventId);
 assert.equal(prepared.fields.event_message,undefined);assert.equal(prepared.fields.remindAt,undefined);
});
