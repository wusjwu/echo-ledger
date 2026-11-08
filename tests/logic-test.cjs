// Dependency-free Node VM verification; NOT a browser or a CORS test.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
class Classes{constructor(){this.set=new Set()}add(...xs){xs.forEach(x=>this.set.add(x))}remove(...xs){xs.forEach(x=>this.set.delete(x))}contains(x){return this.set.has(x)}toggle(x,force){if(force??!this.set.has(x))this.add(x);else this.remove(x)}}
const ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}})}, {get:(o,k)=>k in o?o[k]:(...a)=>{},set:(o,k,v)=>(o[k]=v,true)});
class Element{constructor(id=''){this.id=id;this.style={};this.classList=new Classes();this.children=[];this.textContent='';this.innerHTML='';}append(...a){this.children.push(...a)}appendChild(a){this.append(a)}replaceChildren(...a){this.children=a}getContext(){return ctx}getBoundingClientRect(){return{left:0,top:0,width:100,height:100}}setPointerCapture(){}}
async function boot(search='?test=1',saved=new Map(),viewport=1440){
 let now=Date.now(),frame,fail=false;const listeners={},elements=new Map(),intervals=[];
 const get=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id)};
 const status=JSON.parse(fs.readFileSync(path.join(root,'research/status.json'))),ledger=JSON.parse(fs.readFileSync(path.join(root,'research/settlements.json'))),economy=JSON.parse(fs.readFileSync(path.join(root,'research/economy-state.json')));
 status.measurement.observedAt=new Date(now).toISOString();status.measurement.coreStatus='ACTIVE';status.measurement.rpmMilli=42000;
 const data={status,settlements:ledger,'economy/state':economy};
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}
 class DetailEvent extends Event{constructor(t,o={}){super(t);this.detail=o.detail}}
 const sandbox={console,Math,Date:Clock,Intl,Number,JSON,Array,Object,String,Set,Map,parseInt,BigInt,EventTarget,Event,CustomEvent:DetailEvent,URLSearchParams,AbortController,HTMLButtonElement:Element,innerWidth:viewport,location:{search},
  document:{getElementById:get,createElement:()=>new Element(),createTextNode:t=>({textContent:t}),addEventListener:(t,f)=>listeners['document:'+t]=f,hidden:false},
  localStorage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)},
  addEventListener:(t,f)=>{(listeners[t]??=[]).push(f)},setInterval:(f,ms)=>{intervals.push({f,ms});return intervals.length},clearInterval(){},setTimeout,clearTimeout,
  requestAnimationFrame:f=>frame=f,
  fetch:async url=>{if(fail)throw new Error('Failed to fetch');const key=url.split('/v1/')[1];return{ok:true,status:200,type:'cors',headers:{get:()=>key==='settlements'?'live':null},json:async()=>JSON.parse(JSON.stringify(data[key]))}}};
 sandbox.window=sandbox;vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(root,'telemetry.js'),'utf8'),sandbox);vm.runInContext(fs.readFileSync(path.join(root,'game.js'),'utf8'),sandbox);
 await new Promise(r=>setImmediate(r));
 let elapsed=0;function step(seconds){for(let i=0;i<Math.ceil(seconds*60);i++){now+=1000/60;elapsed+=1000/60;frame(elapsed);}}
 function key(code){for(const f of listeners.keydown||[])f({code,repeat:false,target:null,preventDefault(){}});for(const f of listeners.keyup||[])f({code});}
 function click(id){assert.equal(typeof get(id).onclick,'function',id+' click');get(id).onclick({preventDefault(){}})}
 return{s:sandbox,get,step,key,click,snapshot:()=>sandbox.echoLedger.snapshot(),debug:sandbox.echoLedger.debug,data,saved,fail:v=>fail=v};
}
async function recordAt(t,x,y){t.debug.teleport(x,y);t.key('KeyR');t.step(.8);t.key('KeyR');t.step(.8);}
(async()=>{
 const t=await boot();assert.equal(t.s.squeekFeed.live,true);assert.equal(t.get('liveBadge').textContent,'LIVE');assert.equal(t.get('feedSource').textContent,'LIVE / SEPOLIA');assert.ok(t.get('ledgerFeed').children[0].href.startsWith('https://sepolia.etherscan.io/tx/'));
 t.click('startBtn');t.debug.clearThreats();t.debug.protect();t.step(.1);
 assert.equal(t.snapshot().surgeTime,0,'initial history must not surge');assert.ok(t.snapshot().regen>12,'ACTIVE RPM increases regen');
 const activeRegen=t.snapshot().regen;t.data.status.measurement.coreStatus='IDLE';t.data.status.measurement.rpmMilli=0;await t.s.squeekFeed.poll();assert.ok(t.snapshot().regen<activeRegen);
 for(const r of t.snapshot().relays)await recordAt(t,r.x,r.y);t.step(1);assert.ok(t.snapshot().relays.every(r=>r.on),'echoes power relays');assert.equal(t.snapshot().echoes.length,2);
 t.data.settlements.recentSettlements.unshift({...t.data.settlements.recentSettlements[0],transactionHash:'0x'+'a'.repeat(64),logIndex:'999',settledThroughRound:'618'});
 await t.s.squeekFeed.poll();assert.equal(t.snapshot().stats.surges,1,'new safe receipt triggers surge');await t.s.squeekFeed.poll();assert.equal(t.snapshot().stats.surges,1,'duplicate receipt ignored');
 for(const v of t.snapshot().vaults){t.debug.teleport(v.x,v.y);t.step(.1)}t.debug.teleport(935,360);t.step(.1);assert.equal(t.snapshot().state,'shop');
 t.debug.fragments(300);const buttons=t.get('upgrades').children;buttons[0].onclick();assert.equal(t.snapshot().echoLimit,3);assert.ok(t.snapshot().money<300);t.click('nextBtn');assert.equal(t.snapshot().level,2);
 t.key('KeyP');assert.equal(t.snapshot().state,'pause');t.click('retireBtn');assert.equal(t.snapshot().state,'over');assert.ok(t.get('summaryGrid').innerHTML.includes('ECHOES'));
 t.click('codexBtn');assert.equal(t.snapshot().state,'info');t.click('enemyTab');assert.equal(t.get('codexContent').children.length,6);t.click('featTab');assert.equal(t.get('codexContent').children.length,12);t.click('closeCodex');assert.equal(t.snapshot().state,'over');
 const boss=await boot('?test=1&sector=5');boss.click('startBtn');boss.debug.clearThreats();boss.debug.protect();assert.ok(boss.snapshot().boss);await recordAt(boss,355,205);boss.step(3);assert.equal(boss.snapshot().boss.hp,3,'one echo cannot damage boss');await recordAt(boss,355,515);boss.step(9);assert.equal(boss.snapshot().boss.hp,0);assert.ok(boss.snapshot().boss.dead);assert.equal(boss.snapshot().stats.bosses,1);
 for(const v of boss.snapshot().vaults){boss.debug.teleport(v.x,v.y);boss.step(.1)}boss.debug.teleport(935,360);boss.step(.1);assert.equal(boss.snapshot().state,'shop','boss delivery completable');
 const paired=await boot('?test=1&sector=3');paired.click('startBtn');paired.debug.clearThreats();paired.debug.protect();for(const r of paired.snapshot().relays)await recordAt(paired,r.x,r.y);paired.step(3);assert.ok(paired.snapshot().relays.every(r=>r.on),'paired seals can be solved');
 const offline=await boot('?test=1&offline=1');offline.click('startBtn');offline.debug.clearThreats();offline.debug.protect();for(let i=0;i<46;i++)offline.s.squeekFeed.tick();assert.equal(offline.snapshot().telemetry.live,false);assert.equal(offline.snapshot().stats.surges,1,'offline simulated surge');assert.ok(offline.get('surgeBanner').textContent.startsWith('SIMULATED'));assert.equal(offline.snapshot().progress.maxDistance,0,'sim distance never unlocks real lore');
 t.fail(true);await t.s.squeekFeed.poll();assert.equal(t.snapshot().telemetry.live,false);assert.equal(t.get('liveBadge').textContent,'SIMULATED');
 const normal=await boot('');normal.click('startBtn');normal.key('KeyR');normal.step(.8);normal.key('KeyR');assert.ok(normal.snapshot().progress.feats.includes('first'));assert.ok(normal.snapshot().progress.maxDistance>=5000);
 const restored=await boot('',normal.saved);assert.ok(restored.snapshot().progress.feats.includes('first'),'achievements persist');
 const shared1=await boot(),shared2=await boot();for(const s of [shared1,shared2]){s.click('sharedMode');s.click('startBtn');}assert.equal(shared1.snapshot().seed,shared2.snapshot().seed);assert.deepEqual(shared1.snapshot().walls,shared2.snapshot().walls);
 const mobile=await boot('?test=1',new Map(),390);mobile.click('startBtn');mobile.debug.protect();mobile.debug.clearThreats();assert.equal(mobile.get('game').width,640);assert.equal(mobile.get('game').height,800);const oldX=mobile.snapshot().player.x;mobile.get('joystick').onpointerdown({preventDefault(){},pointerId:1,clientX:82,clientY:50});mobile.step(.3);mobile.get('joystick').onpointerup();assert.ok(mobile.snapshot().player.x>oldX+25,'touch pad moves mouse');mobile.get('touchRecord').onpointerdown({preventDefault(){}});mobile.step(.8);mobile.get('touchRecord').onpointerdown({preventDefault(){}});assert.equal(mobile.snapshot().echoes.length,1,'touch records and releases');
 const enemySet=new Set();for(const level of [1,3,5,7]){const a=await boot('?test=1&sector='+level);a.click('startBtn');a.step(.5);a.snapshot().enemies.forEach(e=>enemySet.add(e.type));}assert.equal(enemySet.size,5);
 console.log('PASS: telemetry mapping, RPM regen, safe settlement baseline/dedup, relay puzzles, paired seals, boss two-echo requirement & victory, shop upgrades, summary, codex, 12 feats, offline surge, network fallback, persistence, shared seed, five threats, mobile touch input and renderer execution.');
 console.log('This is VM logic verification, not Chromium, visual verification or proof of browser CORS.');
})().catch(e=>{console.error(e);process.exitCode=1});
