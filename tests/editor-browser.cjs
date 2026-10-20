const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],sent=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://editor-test.example/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/admin/auth.js')return route.fulfill({contentType:'text/javascript',body:'export async function connectAuth(cb){cb({allowed:true,email:"test@example.com"});return {token:async()=>"fake-token",login(){},logout(){}}}'});
  if(url.pathname==='/api/send'){sent.push(route.request().postDataJSON());return route.fulfill({contentType:'application/json',body:'{"state":"accepted"}'});}
  const file=path.join(__dirname,'..',url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname);
  return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/html'});
 });
 await page.goto('https://editor-test.example/admin/');
 await page.locator('#tab-links').click();assert(await page.locator('#form-event').isHidden());assert(await page.locator('#form-links').isVisible());
 await page.locator('#title').fill('오늘 링크');await page.locator('#body').fill('오늘 링크\nhttps://example.com/a?eventId=one&x=2\nhttps://example.com/b');
 await page.locator('#review').click();await page.locator('#send').click();
 assert.equal(sent.length,1);assert.equal(sent[0].kind,'links');assert.equal(sent[0].remindAt,undefined);assert.ok(sent[0].eventId);assert.ok(sent[0].body.includes('eventId=one&x=2'));
 await page.locator('#cancel').click();await page.locator('#save').click();await page.locator('#tab-event').click();await page.locator('#restore').click();assert(await page.locator('#form-links').isVisible());
 await page.locator('#tab-links').focus();await page.keyboard.press('ArrowRight');assert(await page.locator('#form-rec').isVisible());
 await page.locator('#tab-ipo').click();assert(await page.locator('#form-ipo').isVisible());await page.locator('#ipo-day').fill('2020-01-01');await page.locator('#review').click();assert(!(await page.locator('#confirm').isVisible()));
 const day=new Date(Date.now()+86400000+9*3600000).toISOString().slice(0,10);await page.locator('#ipo-day').fill(day);await page.locator('#review').click();assert((await page.locator('#confirm-summary').textContent()).includes('오후 4시'));await page.locator('#send').click();const ipo=sent.at(-1);assert.equal(ipo.kind,'event');assert.equal(ipo.remindAt,Date.parse(day+'T15:00:00+09:00'));assert.equal(ipo.endAt,ipo.remindAt+3600000);
 await page.locator('#cancel').click();await page.locator('#save').click();await page.locator('#tab-event').click();await page.locator('#restore').click();assert(await page.locator('#form-ipo').isVisible());
 await page.screenshot({path:'/private/tmp/ipo-web.png',fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log('PASS: mobile link tab, date-free payload, fake authenticated send, link draft restore, five-tab keyboard navigation and IPO expiry. No real push sent.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
