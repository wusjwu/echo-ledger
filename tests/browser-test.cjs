/* Optional release verification. This script has been prepared, NOT executed.
   A browser-capable agent can run: node tests/browser-test.cjs
   Requires Playwright and Chromium; serve the project at GAME_URL (default below). */
const {chromium,devices}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.GAME_URL||'http://127.0.0.1:8766';
const out=path.resolve(__dirname,'../screenshots');fs.mkdirSync(out,{recursive:true});
let activeBrowser;
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 activeBrowser=browser;
 const report={executedAt:new Date().toISOString(),contexts:[],screenshots:[]};
 async function pageFor(options={}){
  const context=await browser.newContext(options),page=await context.newPage(),errors=[],network=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  page.on('requestfailed',r=>network.push({url:r.url(),error:r.failure()?.errorText}));
  return{context,page,errors,network};
 }
 async function screenshot(page,name){const file=path.join(out,name+'.png');await page.screenshot({path:file,fullPage:true});report.screenshots.push(file)}
 async function snapshot(page){return page.evaluate(()=>window.echoLedger.snapshot())}
 async function record(page,x,y){await page.evaluate(([x,y])=>window.echoLedger.debug.teleport(x,y),[x,y]);await page.keyboard.press('KeyR');await page.waitForTimeout(850);await page.keyboard.press('KeyR');await page.waitForTimeout(250)}
 const desktop=await pageFor({viewport:{width:1440,height:1050}}),p=desktop.page;
 await p.goto(base+'/?test=1');await p.waitForTimeout(9000);
 await screenshot(p,'title');const telemetry=await p.evaluate(()=>window.squeekFeed.snapshot());
 report.browserCors=telemetry.live&&['status','settlements','economy/state'].every(ep=>telemetry.requests[ep]?.ok&&telemetry.requests[ep]?.cors==='cors');
 report.telemetry=telemetry;
 await p.click('#startBtn');await p.evaluate(()=>{window.echoLedger.debug.protect();window.echoLedger.debug.clearThreats()});
 const r=(await snapshot(p)).relays[0];await p.evaluate(([x,y])=>window.echoLedger.debug.teleport(x-75,y),[r.x,r.y]);
 await p.keyboard.press('KeyR');await p.keyboard.down('KeyD');await p.waitForTimeout(400);await p.keyboard.up('KeyD');await p.waitForTimeout(1000);await p.keyboard.press('KeyR');await p.waitForTimeout(1200);
 assert.ok((await snapshot(p)).echoes.length>0);await screenshot(p,'gameplay');
 await p.goto(base+'/?test=1&sector=5');await p.click('#startBtn');await p.evaluate(()=>{window.echoLedger.debug.protect();window.echoLedger.debug.clearThreats()});
 await record(p,355,205);await p.waitForTimeout(2800);assert.equal((await snapshot(p)).boss.hp,3);
 await record(p,355,515);await screenshot(p,'boss');await p.waitForTimeout(8500);assert.equal((await snapshot(p)).boss.dead,true);
 report.contexts.push({name:'desktop',consoleErrors:desktop.errors,failedRequests:desktop.network});
 const mobile=await pageFor({...devices['iPhone 13'],defaultBrowserType:undefined}),m=mobile.page;
 await m.goto(base+'/?test=1');await m.waitForTimeout(8500);await m.click('#startBtn');await m.evaluate(()=>{window.echoLedger.debug.protect();window.echoLedger.debug.clearThreats()});
 const start=(await snapshot(m)).player.x,box=await m.locator('#joystick').boundingBox();
 // Pointer/touch action is exercised in-page by Playwright's touchscreen tap for buttons.
 await m.touchscreen.tap(box.x+box.width*.8,box.y+box.height/2);
 await m.locator('#touchRecord').tap();await m.waitForTimeout(850);await m.locator('#touchRecord').tap();
 assert.equal((await snapshot(m)).echoes.length,1);assert.ok(await m.locator('.touch-controls').isVisible());
 assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no mobile horizontal overflow');
 await screenshot(m,'mobile');report.contexts.push({name:'mobile',consoleErrors:mobile.errors,failedRequests:mobile.network});
 const offline=await pageFor({viewport:{width:1280,height:980}}),o=offline.page;
 await o.goto(base+'/?offline=1&test=1');await o.click('#startBtn');assert.equal((await snapshot(o)).telemetry.live,false);await o.evaluate(()=>window.echoLedger.debug.surge());assert.ok((await o.locator('#surgeBanner').textContent()).includes('SIMULATED'));
 report.contexts.push({name:'offline practice',consoleErrors:offline.errors,failedRequests:offline.network});
 fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2));
 await browser.close();
 console.log(JSON.stringify(report,null,2));
 const errors=report.contexts.flatMap(c=>c.consoleErrors);assert.equal(errors.length,0,'zero console errors required; inspect report for transport/CORS failures');
})().catch(async e=>{console.error(e);if(activeBrowser)await activeBrowser.close();process.exitCode=1});
