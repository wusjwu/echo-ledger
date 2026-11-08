'use strict';
(() => {
const $ = id => document.getElementById(id), canvas = $('game'), ctx = canvas.getContext('2d');
const W = 1000, H = 720, TAU = Math.PI * 2, feed = window.squeekFeed;
const params = new URLSearchParams(location.search), debugSector = Math.min(99, Math.max(1, parseInt(params.get('sector'),10) || 1));
const testMode = params.get('test') === '1', practice = debugSector > 1 || testMode;
const clamp = (v,a,b) => Math.max(a,Math.min(b,v)), distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const copy = x => JSON.parse(JSON.stringify(x));
function load(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (_) { return fallback; } }
function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} }
const stored = load('echo-ledger-v2-progress', {});
const progress = {lore:Array.isArray(stored.lore)?stored.lore.filter(x=>Number.isInteger(x)&&x>=0&&x<9):[0], feats:Array.isArray(stored.feats)?stored.feats:[], maxDistance:Number(stored.maxDistance)||0, best:Number(stored.best)||0};
if (!progress.lore.includes(0)) progress.lore.push(0);
let scores = load('echo-ledger-v2-scores', []); if (!Array.isArray(scores)) scores = [];
scores = scores.filter(x=>x&&Number.isFinite(x.score)&&Number.isFinite(x.level)).slice(0,5);
let state='title', previousState='title', level=1, score=0, money=0, time=0, last=0, seed=0, rng=Math.random, shared=false, seedHeight=0, seedWasLive=false;
let player=null, relays=[], vaults=[], enemies=[], walls=[], hazards=[], pickups=[], particles=[], echoes=[], bolts=[], boss=null;
let recording=false, route=[], recordTime=0, sampleTime=0, toastTime=0, sectorTime=0, totalVaults=0, surgeTime=0, pendingSurge=null;
let keys={}, stick={x:0,y:0}, pointer=null, up, stats, sectorDamage=0, infoTab='lore', lastWork=null, lastAnchor=null, liveWas=false, signalFlash=0, shake=0;
let muted=load('echo-ledger-v2-muted',true)!==false, audio=null, ambientTick=0;
const baseUp = () => ({capacity:0,speed:0,echo:0,armor:0,regen:0,magnet:0,purge:0,duration:0});
up=baseUp();
const biomes = [
 {name:'Wheel Core',sub:'Copper roots / the living engine',bg:'#111e28',floor:'#162b35',grid:'#37545b',accent:'#ffbb69',second:'#65efc5',wall:'#624535',hazard:'Hot axle vents',detail:'Real wheel work energizes every echo.'},
 {name:'Mempool Tunnels',sub:'Violet current / unconfirmed whispers',bg:'#1b1730',floor:'#28233f',grid:'#594770',accent:'#b99aff',second:'#67d9ff',wall:'#4a3d6b',hazard:'Packet storms',detail:'Do not mistake projected height for settled proof.'},
 {name:'Settlement Vaults',sub:'Jade chambers / permanent memories',bg:'#102a2e',floor:'#163c3f',grid:'#2f6266',accent:'#60f0cf',second:'#ffcc78',wall:'#295c62',hazard:'Finality seals',detail:'A confirmed settlement leaves a permanent trail.'}
];
const biomeIndex = () => Math.floor((level-1)/2)%3;
const biome = () => biomes[biomeIndex()];
const lore = [
 {title:'01 / The wheel above',text:'Squeektoshi is a real hamster. His wheel work is the heartbeat of Squeekchain. Below it, a mouse courier carries the fragments no auditor thinks worth keeping.',note:'Protocol note: /v1/status exposes hardware freshness, RPM and cumulative work.',unlock:'Available from the start.'},
 {title:'02 / A second pair of paws',text:'A spool holds footsteps, not a soul. Play them back and your echo walks while you do something else. The burrow survives through cooperation, even with your past self.',note:'Game mechanic: only echoes power relay rings. Two different echoes open paired seals.',unlock:'Release your first echo.'},
 {title:'03 / The amber ledger',text:'The first vault contains a receipt: effort was real even when nobody watched. You tuck it into your satchel. The General would rather the small lives disappeared.',note:'Game SQK fragments are fictional points. They are not tokens and have no financial value.',unlock:'Recover your first memory vault.'},
 {title:'04 / One hundred meters',meters:100,text:'A hundred meters of small steps power a very large idea. The pipes run warm; every courier in Wheel Core hears the same heartbeat.',note:'Protocol note: measured distanceMm is divided by 1,000 to display meters.',unlock:'Real cumulative wheel distance: 100 m.'},
 {title:'05 / A kilometer of proof',meters:1000,text:'Fork Rats insist there are two wheels. The ledger remembers one path. The courier follows verified work rather than the loudest whisper in the tunnel.',note:'Protocol note: builder.anchor.blockHeight is settled; builder.projected is optimistic, not settled.',unlock:'Real cumulative wheel distance: 1,000 m.'},
 {title:'06 / The settling room',meters:3000,text:'Raw motion becomes an accepted record. When a settlement reaches the vault, every lamp flashes violet. Couriers call it a Surge: a chance to move while the auditors blink.',note:'Protocol note: only newly observed safe/confirmed settlement records trigger live Surges. Initial history does not.',unlock:'Real cumulative wheel distance: 3,000 m.'},
 {title:'07 / The SQK archive',meters:5000,text:'SQK marks the economy above. Down here, paper fragments buy spool parts and repairs. A good courier knows the difference between a game counter and an actual asset.',note:'Protocol note: /v1/economy/state reports SQK live supply in base units, with 18 decimals on the current Sepolia deployment.',unlock:'Real cumulative wheel distance: 5,000 m.'},
 {title:'08 / Ten thousand promises',meters:10000,text:'The wheel has carried ten thousand meters of promises. A Stale Data Wraith offers yesterday as today. The courier checks the timestamp and waits for a living signal.',note:'Protocol note: stale or unreachable hardware is explicitly marked SIMULATED here. Simulated distance never unlocks real-distance lore.',unlock:'Real cumulative wheel distance: 10,000 m.'},
 {title:'09 / General, dismissed',text:'The General can count one courier. He cannot reconcile two echoes holding separate seals. His armor splits; behind it is a blank page. You write: Small work still matters.',note:'Community fiction, not an official Squeekchain story. There is always another delivery.',unlock:'Defeat the Auditor General.'}
];
const threats = [
 ['Auditor','A red collector follows the nearest echo before chasing you. Leave a looping decoy, then slip past.'],
 ['Fork Rat','A quick zigzag hunter. Touching an echo stuns it; long loops are safer than straight chases.'],
 ['Gas Leech','Drains echo energy within its amber aura. An echo draws its attention away from your satchel.'],
 ['Stale Data Wraith','A phase-shifting violet threat. Nearby echoes ground it and stop its advance.'],
 ['Checksum Turret','A stationary sentry sends slow packets along a rotating aim. Dash between volleys or purge its bolts.'],
 ['The Auditor General','Every fifth sector: hold BOTH tribunal seals with two different echoes. Each sustained sync breaks an armor plate. Three breaks dismiss the General.']
];
const feats = [
 ['first','First Replay','Release an echo.'],['double','Double Entry','Have two echoes alive together.'],['four','Echo Architect','Coordinate four echoes.'],['vaults','Memory Carrier','Recover five vaults in one run.'],['boss','General Dismissed','Defeat the Auditor General.'],['biomes','Burrow Cartographer','Visit all three biomes in one run.'],['clean','Clean Receipt','Complete a sector without taking damage.'],['live','Wheel Witness','Play while live Squeektoshi telemetry is ACTIVE.'],['surge','Settlement Courier','Experience a real confirmed Settlement Surge.'],['offline','Resilient Signal','Complete a sector in simulated mode.'],['lore','Archivist','Unlock six lore chapters.'],['distance','A Kilometer of Proof','Observe 1,000 m of real cumulative wheel distance.']
];
function persist() {save('echo-ledger-v2-progress',progress);}
function unlockLore(index, notify=true) {if(progress.lore.includes(index))return;progress.lore.push(index);persist();if(notify)toast('CODEX RECOVERED / '+lore[index].title);updateCodexCount();}
function achieve(id, notify=true) {if(practice||progress.feats.includes(id))return;progress.feats.push(id);persist();if(notify){const f=feats.find(f=>f[0]===id);toast('ACHIEVEMENT / '+f[1]);sound(900,'triangle',.25);} }
function updateCodexCount() {$('codexCount').textContent=progress.lore.length+'/9';if(progress.lore.length>=6)achieve('lore',false);}
function seeded(s) {return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function hash(s) {let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function rand(a,b) {return a+rng()*(b-a);}
function maxEnergy(){return 100+up.capacity*35;}
function maxHp(){return 4+up.armor;}
function echoLimit(){return 2+up.echo;}
function echoLife(){return 32+up.duration*9;}
function archiveBonus(){return Math.min(25,Math.floor(progress.maxDistance/1000)*2);}
function regen(){const w=feed.wheel;return (w.active?7+Math.min(w.rpm,150)*.12:4.5)*(1+up.regen*.3)*(player?.overclock>0?1.7:1);}
function sound(freq=440,type='sine',duration=.1,volume=.035){if(muted)return;try{if(!audio)audio=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(45,freq*.6),audio.currentTime+duration);g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}catch(_){} }
function burst(x,y,color,count=15){for(let i=0;i<count;i++)particles.push({x,y,vx:(Math.random()-.5)*230,vy:(Math.random()-.5)*230,life:.3+Math.random()*.65,color});}
function toast(message){$('message').textContent=message;$('message').classList.add('show');toastTime=4.5;}
const overlayIds=['title','pause','guide','codex','shop','gameover'];
function clearOverlays(){overlayIds.forEach(id=>$(id).classList.add('hidden'));}
function resetInput(){keys={};stick={x:0,y:0};pointer=null;$('stick').style.transform='';}
function start(){clearOverlays();resetInput();level=debugSector;score=0;money=0;totalVaults=0;up=baseUp();seedHeight=feed.wheel.anchor;seedWasLive=feed.live;
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 seed=shared?hash(day+':'+seedHeight):Math.floor(Math.random()*2147483647);
 stats={seconds:0,echoes:0,relays:0,surges:0,damage:0,bosses:0,fragments:0,biomes:[],liveSeconds:0};
 player={x:90,y:360,r:13,hp:4,energy:100,invuln:2,dash:0,dashTime:0,dx:1,dy:0,shield:0,overclock:0,purges:2};
 pendingSurge=null;surgeTime=0;generate();state='play';sound(660,'triangle',.25);toast(level%5===0?'The General: record one short echo on EACH seal. Hold both together.':'Welcome, courier. Stand on a relay, record a short route, then release your echo.');}
function blocked(x,y,r=18){return walls.some(w=>x+r>w.x&&x-r<w.x+w.w&&y+r>w.y&&y-r<w.y+w.h);}
function freePoint(avoid=[],min=55){for(let i=0;i<250;i++){const p={x:rand(140,870),y:rand(115,600)};if(!blocked(p.x,p.y,30)&&avoid.every(a=>distance(p,a)>min)&&distance(p,{x:90,y:360})>155)return p;}return{x:500,y:100};}
function generate(){rng=seeded(seed+level*971);walls=[];relays=[];vaults=[];enemies=[];hazards=[];pickups=[];particles=[];echoes=[];bolts=[];boss=null;recording=false;route=[];sectorTime=0;sectorDamage=0;surgeTime=0;
 player.x=90;player.y=360;player.energy=maxEnergy();player.invuln=2.5;player.dash=0;player.dashTime=0;player.shield=0;player.overclock=0;
 const b=biomeIndex();if(!stats.biomes.includes(b))stats.biomes.push(b);if(stats.biomes.length===3)achieve('biomes');
 if(level%5===0){
  relays=[{x:355,y:205,charge:0,on:false,paired:true},{x:355,y:515,charge:0,on:false,paired:true}];
  boss={x:740,y:360,hp:3,maxHp:3,sync:0,timer:0,volley:3,phase:1,dead:false};
  vaults=[{x:820,y:180,taken:false}];walls=[{x:500,y:290,w:50,h:140}];
 }else{
  const jitter=()=>rand(-35,35);
  relays=[{x:300+jitter(),y:200+jitter(),charge:0,on:false,paired:false},{x:620+jitter(),y:485+jitter(),charge:0,on:false,paired:false}];
  if(level>=3){relays[0].paired=true;relays[1].paired=true;}
  if(level>=4)relays.push({x:780+jitter(),y:205+jitter(),charge:0,on:false,paired:false});
  vaults=[{x:820,y:360,taken:false}];if(level>=2)vaults.push({x:540,y:155,taken:false});
  for(let i=0;i<4+Math.min(3,Math.floor(level/3));i++){
   const wall={x:rand(210,790),y:rand(160,540),w:rand(50,95),h:22};
   if([...relays,...vaults].every(p=>p.x<wall.x-75||p.x>wall.x+wall.w+75||p.y<wall.y-75||p.y>wall.y+wall.h+75)&&!walls.some(w=>Math.abs(w.x-wall.x)<145&&Math.abs(w.y-wall.y)<90))walls.push(wall);
  }
 }
 for(let i=0;i<Math.min(9,level+2);i++){
  const types=['auditor','fork','leech','wraith','turret'];
  enemies.push({...freePoint([...relays,...vaults],95),type:types[i%types.length],r:i%5===4?15:12,speed:42+Math.min(level,15)*2+(i%5===1?28:0),phase:rand(0,6),stun:0,shot:2+rand(0,3),angle:0});
 }
 for(let i=0;i<Math.min(6,1+Math.floor(level/2));i++)hazards.push({...freePoint([...relays,...vaults,...hazards],110),r:23,phase:rand(0,6)});
 for(let i=0;i<25+Math.min(level,20);i++)pickups.push({...freePoint([...relays,...vaults],45),type:'fragment',taken:false});
 ['repair','battery','shield','overclock','purge'].forEach(type=>pickups.push({...freePoint([...relays,...vaults],50),type,taken:false}));
 $('bossHud').classList.toggle('hidden',!boss);$('surgeBanner').classList.add('hidden');updateHud();}
function updateHud(){if(!player)return;
 $('sectorText').textContent=String(level).padStart(2,'0')+' / '+biome().name.toUpperCase();
 $('sectorSub').textContent=boss?'BOSS / THE AUDITOR GENERAL':biome().sub;
 $('healthText').textContent='♥ '.repeat(Math.max(0,player.hp))+'· '.repeat(Math.max(0,maxHp()-player.hp));
 $('energyText').textContent=Math.round(player.energy/maxEnergy()*100)+'%';$('energyBar').style.width=(player.energy/maxEnergy()*100)+'%';
 $('regenText').textContent='+'+regen().toFixed(1)+'/s · '+(feed.wheel.active?'wheel boost':'idle reserve');
 $('moneyText').textContent=money;$('scoreText').textContent=String(score).padStart(5,'0');
 $('mode').textContent=recording?'● RECORDING '+recordTime.toFixed(1)+'s / R TO RELEASE':'ECHOES '+echoes.length+'/'+echoLimit()+' · '+(surgeTime>0?'SURGE '+Math.ceil(surgeTime)+'s':'R TO RECORD');
 $('mode').style.color=recording?'#ff7f9c':'#62efdc';$('touchRecord').textContent=recording?'RELEASE ■':'REC ●';
 $('statusText').textContent=echoes.length+'/'+echoLimit()+' ECHOES · '+player.purges+' PURGES · ARCHIVE BONUS +'+archiveBonus()+'%'+(player.shield>0?' · SHIELDED':'');
 $('seedLabel').textContent=(practice?'PRACTICE / ':'')+(shared?(seedWasLive?'SHARED BLOCK ':'SIM SHARED BLOCK ')+seedHeight:'STORY EXPEDITION');
 const charged=relays.filter(r=>r.on).length,remaining=vaults.filter(v=>!v.taken).length;
 $('objectiveText').textContent=boss&&!boss.dead?'General: hold BOTH seals with two different echoes. Armor '+boss.hp+'/3.':charged<relays.length?(relays.some(r=>r.paired&&!r.on)?'Paired seals: two echoes at once. Other relays latch. ':'Only echoes power rings. ')+charged+'/'+relays.length+' relays online.':remaining?'Vaults open! Recover '+remaining+' amber memor'+(remaining===1?'y.':'ies.'):'Delivery ready. Reach the green uplink →';
 if(boss){$('bossBar').style.width=(boss.hp/boss.maxHp*100)+'%';$('bossPhase').textContent=boss.dead?'DISMISSED':boss.sync>0?'SYNC '+Math.round(boss.sync/2.4*100)+'%':'TWO ECHOES → BREAK ARMOR';}}
function toggleRecord(){if(state!=='play')return;if(recording){release();return;}if(player.energy<12){toast('Low echo energy. Wait for wheel-powered regeneration or collect a battery.');return;}player.energy-=6;recording=true;recordTime=0;sampleTime=0;route=[{x:player.x,y:player.y,t:0}];sound(440,'sine',.12);}
function release(){if(!recording)return;recording=false;if(recordTime<.35){route=[];toast('Record for at least a moment. Standing on a relay works too.');return;}
 route.push({x:player.x,y:player.y,t:recordTime});if(echoes.length>=echoLimit())echoes.shift();
 echoes.push({path:route.map(p=>({...p})),duration:recordTime,age:0,life:echoLife()+(surgeTime>0?10:0),x:route[0].x,y:route[0].y,angle:0});
 route=[];stats.echoes++;achieve('first');unlockLore(1,false);if(echoes.length>=2)achieve('double');if(echoes.length>=4)achieve('four');
 sound(880,'triangle',.2);burst(player.x,player.y,'#62efdc',24);toast('Echo '+echoes.length+'/'+echoLimit()+' deployed / '+echoLife()+'s. Your past self holds the route.');}
function dash(){if(state!=='play'||player.dash>0)return;player.dash=Math.max(1.4,3-up.speed*.25);player.dashTime=.18;player.invuln=Math.max(player.invuln,.28);sound(170,'sawtooth',.12,.025);burst(player.x,player.y,biome().second,10);}
function purge(){if(state!=='play')return;if(player.purges<=0){toast('No purge charges. Look for violet ✦ chips or restock at the workbench.');return;}player.purges--;const radius=190+up.purge*45;enemies.forEach(e=>{if(distance(player,e)<radius)e.stun=5+up.purge;});bolts=bolts.filter(b=>distance(player,b)>radius);burst(player.x,player.y,'#bc9aff',60);player.purgeFlash=1;shake=5;sound(140,'triangle',.45);toast('Packet purge! Nearby threats stunned; hostile packets cleared.');}
function move(o,dx,dy,r){const nx=clamp(o.x+dx,48,W-48);if(!blocked(nx,o.y,r))o.x=nx;const ny=clamp(o.y+dy,90,H-85);if(!blocked(o.x,ny,r))o.y=ny;}
function hurt(){if(!player||player.invuln>0||state!=='play')return;if(player.shield>0){player.shield=0;player.invuln=1.4;burst(player.x,player.y,'#67d9ff',25);toast('Shield absorbed the hit. Keep the ledger moving.');return;}player.hp--;player.invuln=1.8;stats.damage++;sectorDamage++;shake=9;burst(player.x,player.y,'#ff7f9c',30);sound(90,'sawtooth',.2,.045);if(player.hp<=0)endRun(false);else toast('Courier hit! Dash or leave an echo to draw threats away.');}
function applySurge(event){pendingSurge=null;surgeTime=12;stats.surges++;player.energy=maxEnergy();echoes.forEach(e=>e.life=Math.min(65,e.life+12));enemies.forEach(e=>e.stun=4);bolts=[];
 for(let i=0;i<9;i++)pickups.push({...freePoint([],25),type:'fragment',taken:false,surge:true});
 if(!event.simulated)achieve('surge');$('surgeBanner').textContent=(event.simulated?'SIMULATED ':'')+'SETTLEMENT SURGE · +ENERGY · BONUS SQK';$('surgeBanner').classList.remove('hidden');
 burst(500,360,'#bc9aff',80);sound(1220,'triangle',.5);toast((event.simulated?'Practice settlement':'Confirmed settlement')+' / '+event.blocks+' blocks. 12s bonus salvage, extended echoes & stunned threats.');}
feed.addEventListener('settlement',e=>{if(!player||['title','over'].includes(state))return;pendingSurge=e.detail;if(state==='play')applySurge(pendingSurge);});
const upgrades=[
 {id:'echo',name:'Parallel Spools',desc:'+1 echo slot. Two → three → four → five.',base:27,branch:'COOPERATION'},
 {id:'duration',name:'Long Memory',desc:'+9 seconds of echo life per rank.',base:22,branch:'COOPERATION'},
 {id:'capacity',name:'SQK Capacitor',desc:'+35 maximum echo energy.',base:20,branch:'WHEELWORK'},
 {id:'regen',name:'Wheel Coupler',desc:'+30% wheel-fed energy regeneration.',base:24,branch:'WHEELWORK'},
 {id:'speed',name:'Tunnel Bearings',desc:'+12% speed; shorter dash cooldown.',base:25,branch:'COURIER'},
 {id:'magnet',name:'Fragment Satchel',desc:'+24 pickup range; restores 1 integrity.',base:18,branch:'COURIER'},
 {id:'armor',name:'Ledger Plating',desc:'+1 maximum integrity; full repair.',base:28,branch:'SURVIVAL'},
 {id:'purge',name:'Packet Purifier',desc:'+45 purge radius; +1 charge now.',base:20,branch:'SURVIVAL'}
];
function shop(){if(state!=='play')return;state='shop';recording=false;route=[];resetInput();
 const reward=24+level*4;score+=500+level*100+Math.max(0,Math.floor(120-sectorTime))*3;money+=reward;player.hp=Math.min(maxHp(),player.hp+1);player.purges=Math.min(6,player.purges+1);
 if(!sectorDamage)achieve('clean');if(!feed.live)achieve('offline');
 clearOverlays();$('shop').classList.remove('hidden');$('shopSummary').textContent=biome().name+' secured in '+Math.round(sectorTime)+'s. Delivery paid '+reward+' game SQK. One integrity and one purge restored. '+(level%5===4?'Next: the Auditor General. Bring two short echoes.':'Eight branches, three ranks each.');
 renderShop();sound(980,'triangle',.35);updateHud();}
function renderShop(){$('shopMoney').textContent='GAME SQK / ◆ '+money;$('upgrades').replaceChildren();for(const u of upgrades){const cost=u.base+up[u.id]*17,maxed=up[u.id]>=3,button=document.createElement('button');button.className='upgrade';button.disabled=maxed||money<cost;button.innerHTML='<b>'+u.name+'</b><small>'+u.desc+'</small><span>'+(maxed?'MAX RANK':cost+' SQK · RANK '+up[u.id]+'/3')+'</span><em>'+u.branch+' '+('●'.repeat(up[u.id])+'○'.repeat(3-up[u.id]))+'</em>';button.onclick=()=>{if(up[u.id]>=3||money<cost)return;money-=cost;up[u.id]++;if(u.id==='armor')player.hp=maxHp();if(u.id==='magnet')player.hp=Math.min(maxHp(),player.hp+1);if(u.id==='purge')player.purges=Math.min(9,player.purges+1);sound(620,'triangle',.15);renderShop();updateHud();};$('upgrades').append(button);}}
function endRun(retired){if(!player)return;recording=false;resetInput();state='over';clearOverlays();$('gameover').classList.remove('hidden');
 if(!practice){progress.best=Math.max(progress.best,score);persist();scores.push({score,level,mode:shared?'Shared':'Story'});scores.sort((a,b)=>b.score-a.score);scores=scores.slice(0,5);save('echo-ledger-v2-scores',scores);}
 $('endLabel').textContent=practice?'PRACTICE RUN / NOT RANKED':retired?'DELIVERY LOG / COURIER RETIRED':'DELIVERY LOG / SIGNAL LOST';
 $('endSummary').textContent='Sector '+level+' · '+biome().name+' · '+(shared?'Shared Block '+seedHeight:'Story expedition')+'. '+(retired?'The ledger is safe until your next delivery.':'Another courier will carry your echoes.');
 const cells=[[Math.floor(stats.seconds/60)+':'+String(Math.floor(stats.seconds%60)).padStart(2,'0'),'RUN TIME'],[totalVaults,'VAULTS'],[stats.echoes,'ECHOES'],[stats.surges,'SURGES'],[stats.relays,'RELAYS'],[stats.bosses,'GENERALS'],[stats.fragments,'SQK COLLECTED'],[Math.round(stats.liveSeconds)+'s','LIVE PLAY']];
 $('summaryGrid').innerHTML=cells.map(c=>'<div><b>'+c[0]+'</b>'+c[1]+'</div>').join('');$('endScore').textContent=String(score).padStart(5,'0')+' PTS';
 $('leaderboard').innerHTML='<b>LOCAL COURIER RECORDS</b><br>'+(scores.length?scores.map((s,i)=>(i+1)+'. '+s.score+' PTS / SECTOR '+s.level+' / '+(s.mode==='Shared'?'Shared':'Story')).join('<br>'):'Practice runs do not enter the archive.');
 $('bestTitle').textContent='PERSONAL BEST / '+String(progress.best).padStart(5,'0');sound(170,'triangle',.4);}
function update(dt){time+=dt;toastTime-=dt;if(toastTime<=0)$('message').classList.remove('show');signalFlash=Math.max(0,signalFlash-dt);shake=Math.max(0,shake-dt*25);
 for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;if(p.life<=0)particles.splice(i,1);}
 if(state!=='play')return;if(pendingSurge)applySurge(pendingSurge);stats.seconds+=dt;sectorTime+=dt;if(feed.live)stats.liveSeconds+=dt;
 if(feed.live&&feed.wheel.active)achieve('live');surgeTime=Math.max(0,surgeTime-dt);if(!surgeTime)$('surgeBanner').classList.add('hidden');
 ['invuln','dash','dashTime','shield','overclock','purgeFlash'].forEach(k=>player[k]=Math.max(0,(player[k]||0)-dt));
 let dx=(keys.ArrowRight||keys.KeyD?1:0)-(keys.ArrowLeft||keys.KeyA?1:0)+stick.x,dy=(keys.ArrowDown||keys.KeyS?1:0)-(keys.ArrowUp||keys.KeyW?1:0)+stick.y;
 const len=Math.hypot(dx,dy);if(len>.05){dx/=Math.max(1,len);dy/=Math.max(1,len);player.dx=dx;player.dy=dy;}if(player.dashTime>0){dx=player.dx;dy=player.dy;}
 const speed=195*(1+up.speed*.12)*(player.dashTime>0?3.2:1)*(player.overclock>0?1.25:1);move(player,dx*speed*dt,dy*speed*dt,player.r);
 if(recording){recordTime+=dt;sampleTime+=dt;player.energy=Math.max(0,player.energy-6*dt);if(sampleTime>=.045){route.push({x:player.x,y:player.y,t:recordTime});sampleTime=0;}if(player.energy<=0||recordTime>=10)release();}
 else player.energy=Math.min(maxEnergy(),player.energy+regen()*dt);
 for(let i=echoes.length-1;i>=0;i--){const e=echoes[i];e.age+=dt;e.life-=dt;if(e.life<=0){burst(e.x,e.y,'#62efdc',9);echoes.splice(i,1);continue;}const t=e.age%e.duration;let j=0;while(j<e.path.length-2&&e.path[j+1].t<t)j++;const a=e.path[j],b=e.path[j+1],f=clamp((t-a.t)/(b.t-a.t||.01),0,1);e.x=a.x+(b.x-a.x)*f;e.y=a.y+(b.y-a.y)*f;if(distance(a,b)>.1)e.angle=Math.atan2(b.y-a.y,b.x-a.x);}
 const assigned=new Set();const occupancy=relays.map(r=>{const index=echoes.findIndex((e,i)=>!assigned.has(i)&&distance(e,r)<45);if(index>=0)assigned.add(index);return index>=0;});
 if(boss&&!boss.dead){const sync=occupancy[0]&&occupancy[1];boss.sync=sync?boss.sync+dt:Math.max(0,boss.sync-dt*2);relays.forEach((r,i)=>r.charge=occupancy[i]?clamp(boss.sync/2.4,0,1):0);
  if(boss.sync>=2.4){boss.hp--;boss.sync=0;shake=13;burst(boss.x,boss.y,'#ffce77',65);sound(1400,'triangle',.35);enemies.forEach(e=>e.stun=3);score+=400;toast('PARALLEL PROOF! General armor broken / '+boss.hp+' plates remain.');if(boss.hp<=0){boss.dead=true;relays.forEach(r=>r.on=true);stats.relays+=2;stats.bosses++;score+=1500;money+=45;bolts=[];achieve('boss');unlockLore(8,false);toast('GENERAL DISMISSED! Two echoes beat one bad ledger. Claim the memory vault.');}}
  boss.timer+=dt;boss.volley-=dt;if(boss.volley<=0){boss.volley=3.1-boss.phase*.25;boss.phase=4-boss.hp;for(let i=0;i<8+boss.phase*2;i++){const a=i*TAU/(8+boss.phase*2)+boss.timer*.2;bolts.push({x:boss.x,y:boss.y,vx:Math.cos(a)*100,vy:Math.sin(a)*100,life:6,r:5,color:'#ff7f9c'});}sound(120,'sine',.1,.01);}
 }else if(!boss){const pair=relays.map((r,i)=>({r,i})).filter(x=>x.r.paired&&!x.r.on);const pairOK=pair.length>0&&pair.every(x=>occupancy[x.i]);
  relays.forEach((r,i)=>{if(r.on)return;const active=r.paired?pairOK:occupancy[i];r.charge=active?r.charge+dt/(r.paired?2: .65):Math.max(0,r.charge-dt*.55);if(r.charge>=1){r.on=true;stats.relays++;score+=120;burst(r.x,r.y,'#62efdc',28);sound(760,'sine',.18);}});
 }
 const unlocked=relays.every(r=>r.on)&&(!boss||boss.dead);
 for(const v of vaults){if(!v.taken&&unlocked&&distance(player,v)<34){v.taken=true;money+=18;score+=Math.round(350*(1+archiveBonus()/100));stats.fragments+=18;totalVaults++;unlockLore(2,false);if(totalVaults>=5)achieve('vaults');burst(v.x,v.y,'#ffce77',40);sound(1060,'triangle',.3);toast('Memory recovered / +18 game SQK / distance archive bonus +'+archiveBonus()+'%.');}}
 for(const p of pickups){if(p.taken)continue;const d=distance(player,p);if(d<50+up.magnet*24){p.x+=(player.x-p.x)*dt*5;p.y+=(player.y-p.y)*dt*5;}if(d<22){p.taken=true;if(p.type==='fragment'){const amount=p.surge||surgeTime>0?3:1;money+=amount;stats.fragments+=amount;score+=20*amount;sound(1050,'sine',.035,.008);}else{const labels={repair:'REPAIR / +1 integrity',battery:'BATTERY / +45 echo energy',shield:'SHIELD / absorbs one hit for 20s',overclock:'OVERCLOCK / +speed & regeneration for 15s',purge:'PURGE CHIP / +1 charge'};if(p.type==='repair')player.hp=Math.min(maxHp(),player.hp+1);if(p.type==='battery')player.energy=Math.min(maxEnergy(),player.energy+45);if(p.type==='shield')player.shield=20;if(p.type==='overclock')player.overclock=15;if(p.type==='purge')player.purges=Math.min(9,player.purges+1);toast(labels[p.type]);sound(660,'triangle',.15);}burst(p.x,p.y,itemColor(p.type),9);}}
 for(const e of enemies){e.phase+=dt;e.stun=Math.max(0,e.stun-dt);if(e.stun>0)continue;let target=player,nearest=Infinity;for(const echo of echoes){const d=distance(e,echo);if(d<nearest){nearest=d;target=echo;}}
  if(e.type==='fork'&&nearest<31){e.stun=3;burst(e.x,e.y,'#ffce77',10);continue;}
  if(e.type==='wraith'&&nearest<130)continue;
  if(e.type==='turret'){e.shot-=dt;e.angle=Math.atan2(target.y-e.y,target.x-e.x);if(e.shot<=0){e.shot=3.6;bolts.push({x:e.x,y:e.y,vx:Math.cos(e.angle)*140,vy:Math.sin(e.angle)*140,life:5,r:4,color:'#67d9ff'});}continue;}
  let angle=Math.atan2(target.y-e.y,target.x-e.x);if(e.type==='fork')angle+=Math.sin(e.phase*5)*.65;e.angle=angle;
  const phaseSlow=e.type==='wraith'?(Math.sin(e.phase*2)>0?1.1:.25):1;move(e,Math.cos(angle)*e.speed*phaseSlow*dt,Math.sin(angle)*e.speed*phaseSlow*dt,e.r);
  if(e.type==='leech'&&distance(e,player)<75&&nearest>75)player.energy=Math.max(0,player.energy-12*dt);
  if(distance(player,e)<player.r+e.r)hurt();
 }
 for(let i=bolts.length-1;i>=0;i--){const b=bolts[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.life<=0||b.x<30||b.x>970||b.y<60||b.y>660){bolts.splice(i,1);continue;}if(distance(player,b)<player.r+b.r){hurt();bolts.splice(i,1);}}
 for(const h of hazards)if(hazardActive(h)&&distance(player,h)<h.r+player.r-5)hurt();
 if(boss&&!boss.dead&&distance(player,boss)<53)hurt();
 if(state==='play'&&unlocked&&vaults.every(v=>v.taken)&&distance(player,{x:935,y:360})<38)shop();
 ambientTick+=dt;if(ambientTick>6){ambientTick=0;if(!muted)sound(feed.wheel.active?220:110,'sine',.3,.007);}
 updateHud();}
function rr(x,y,w,h,r=6){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function text(t,x,y,color='#9aafbf',size=10,align='center'){ctx.fillStyle=color;ctx.font=size+'px monospace';ctx.textAlign=align;ctx.fillText(t,x,y);}
function circle(x,y,r,fill,stroke){ctx.beginPath();ctx.arc(x,y,r,0,TAU);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function line(path,color,width=2,dash=[]){if(path.length<2)return;ctx.beginPath();ctx.moveTo(path[0].x,path[0].y);path.forEach(p=>ctx.lineTo(p.x,p.y));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);}
function hazardActive(h){return Math.sin(time*1.8+h.phase+(feed.wheel.anchor%7)*.4)>.55;}
function itemColor(type){return {fragment:'#ffce77',repair:'#ff7f9c',battery:'#62efdc',shield:'#67d9ff',overclock:'#d4fa8a',purge:'#bc9aff'}[type]||'#fff';}
function courier(x,y,angle,color,ghost=false){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.shadowColor=color;ctx.shadowBlur=ghost?17:8;
 ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-10,1);ctx.bezierCurveTo(-29,17,-39,-8,-24,-8);ctx.stroke();
 ctx.fillStyle=ghost?'#62efdc55':color;ctx.beginPath();ctx.ellipse(0,0,17,11,0,0,TAU);ctx.fill();ctx.stroke();
 circle(-2,-10,7,ghost?'#62efdc55':'#ebadab',color);circle(-2,10,7,ghost?'#62efdc55':'#ebadab',color);
 ctx.shadowBlur=0;circle(10,-4,2,ghost?'#defbf7':'#142a31');circle(17,0,2,'#ff9ea3');
 ctx.fillStyle=ghost?'#62efdc':'#92613d';rr(-11,-6,10,12,2);ctx.fill();ctx.strokeStyle=ghost?'#a7fff0':'#ffce77';ctx.stroke();
 ctx.strokeStyle=ghost?'#a7fff0':'#f8eee0';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(12,-1);ctx.lineTo(23,-7);ctx.moveTo(12,1);ctx.lineTo(23,7);ctx.stroke();ctx.restore();}
function drawWheel(){ctx.save();ctx.translate(119,145);ctx.globalAlpha=.6;const color=biome().accent;circle(0,0,61,null,color);circle(0,0,54,null,color);ctx.save();ctx.rotate(time*feed.wheel.rpm*.035);for(let i=0;i<12;i++){ctx.rotate(TAU/12);ctx.strokeStyle=color+'55';ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(52,0);ctx.stroke();}ctx.restore();
 circle(0,12,21,'#c59359');circle(-15,-4,10,'#c59359');circle(15,-4,10,'#c59359');circle(-6,10,2,'#152433');circle(6,10,2,'#152433');circle(0,17,3,'#f6ceae');
 ctx.globalAlpha=1;text('SQUEEKTOSHI',0,83,color,8);text(feed.wheel.active?'WHEEL WORK / ACTIVE':'WHEEL REST / IDLE',0,95,'#91a8ba',7);ctx.restore();}
function drawEnemy(e){ctx.save();ctx.translate(e.x,e.y);const colors={auditor:'#ff7f9c',fork:'#ffb96b',leech:'#b4ed79',wraith:'#bc9aff',turret:'#67d9ff'},c=e.stun>0?'#677e92':colors[e.type];ctx.strokeStyle=c;ctx.fillStyle=c+'25';ctx.lineWidth=2;
 if(e.type==='wraith'){ctx.globalAlpha=e.stun>0?.45:.6+Math.sin(e.phase*2)*.3;ctx.beginPath();ctx.arc(0,-3,13,Math.PI,0);ctx.lineTo(13,15);ctx.lineTo(6,10);ctx.lineTo(0,16);ctx.lineTo(-7,9);ctx.lineTo(-13,15);ctx.closePath();ctx.fill();ctx.stroke();circle(-4,-3,2,c);circle(4,-3,2,c);}
 else if(e.type==='leech'){circle(0,0,70,null,c+'24');ctx.rotate(e.angle);ctx.beginPath();ctx.ellipse(0,0,18,9,0,0,TAU);ctx.fill();ctx.stroke();for(let i=-9;i<10;i+=6){ctx.beginPath();ctx.moveTo(i,-6);ctx.lineTo(i,6);ctx.stroke();}circle(14,0,4,c);}
 else if(e.type==='fork'){ctx.rotate(e.angle);ctx.beginPath();ctx.moveTo(18,0);ctx.lineTo(-9,-11);ctx.lineTo(-13,0);ctx.lineTo(-9,11);ctx.closePath();ctx.fill();ctx.stroke();circle(-3,-10,5,c+'66',c);circle(-3,10,5,c+'66',c);ctx.beginPath();ctx.moveTo(-11,0);ctx.lineTo(-22,7);ctx.lineTo(-25,-5);ctx.stroke();}
 else if(e.type==='turret'){ctx.rotate(e.angle);rr(-14,-14,28,28,4);ctx.fill();ctx.stroke();ctx.fillStyle=c;ctx.fillRect(6,-4,20,8);circle(0,0,5,'#12273a',c);}
 else {ctx.rotate(e.angle);rr(-13,-13,26,26,4);ctx.fill();ctx.stroke();ctx.fillStyle=c;ctx.fillRect(3,-7,4,14);ctx.strokeStyle=c+'33';ctx.beginPath();ctx.moveTo(15,0);ctx.lineTo(55,-22);ctx.lineTo(55,22);ctx.closePath();ctx.stroke();}
 ctx.restore();if(e.stun>0)text('✦',e.x,e.y-23,'#d4fa8a',15);}
function drawBoss(){if(!boss)return;const b=boss;ctx.save();ctx.translate(b.x,b.y);if(b.dead){circle(0,0,47,'#62efdc15','#62efdc77');text('DISMISSED',0,4,'#62efdc',11);ctx.restore();return;}
 ctx.save();ctx.rotate(-time*.15);ctx.strokeStyle='#ff7f9c44';ctx.setLineDash([7,10]);ctx.lineWidth=3;circle(0,0,72,null,ctx.strokeStyle);ctx.setLineDash([]);ctx.restore();
 ctx.fillStyle='#5d3157';ctx.strokeStyle='#ff7f9c';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,-40);ctx.lineTo(42,45);ctx.lineTo(-42,45);ctx.closePath();ctx.fill();ctx.stroke();
 circle(-21,-27,15,'#b68ea8','#ff7f9c');circle(21,-27,15,'#b68ea8','#ff7f9c');circle(0,-8,30,'#81647e','#ffb8c2');
 ctx.fillStyle='#172337';ctx.fillRect(-26,-20,52,13);circle(-12,-14,3,'#ffce77');circle(12,-14,3,'#ffce77');
 ctx.fillStyle='#ffce77';ctx.beginPath();ctx.moveTo(-20,-38);ctx.lineTo(-23,-54);ctx.lineTo(-7,-45);ctx.lineTo(0,-60);ctx.lineTo(7,-45);ctx.lineTo(23,-54);ctx.lineTo(20,-38);ctx.closePath();ctx.fill();
 for(let i=0;i<3;i++){ctx.fillStyle=i<b.hp?'#ffce77':'#392d44';rr(-28+i*20,22,16,12,2);ctx.fill();}ctx.strokeStyle='#ffce77';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(35,0);ctx.lineTo(56,20);ctx.stroke();ctx.fillStyle='#ffce77';ctx.fillRect(49,8,17,22);
 text('AUDITOR GENERAL',0,92,'#ff9eb2',11);text('PARALLEL PROOF REQUIRED',0,107,'#bfa4be',8);ctx.restore();}
function draw(){const viewW=canvas.width,viewH=canvas.height,mobile=viewW<1000,b=biome();ctx.clearRect(0,0,viewW,viewH);ctx.fillStyle=b.bg;ctx.fillRect(0,0,viewW,viewH);
 const camX=mobile&&player?clamp(player.x-320,0,360):0,camY=mobile?-40:0;
 ctx.save();ctx.translate(-camX+(Math.random()-.5)*shake,-camY+(Math.random()-.5)*shake);
 const gradient=ctx.createRadialGradient(480,350,20,480,350,650);gradient.addColorStop(0,b.floor);gradient.addColorStop(1,b.bg);ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);
 ctx.strokeStyle=b.grid+'55';ctx.lineWidth=1;ctx.beginPath();for(let x=40;x<W;x+=40){ctx.moveTo(x,60);ctx.lineTo(x,655);}for(let y=60;y<670;y+=40){ctx.moveTo(40,y);ctx.lineTo(960,y);}ctx.stroke();
 for(let i=0;i<26;i++){const x=(i*173+Math.sin(time*.2+i)*10)%920+40,y=(i*109)%550+80;circle(x,y,1.5,b.accent+'66');}
 ctx.strokeStyle=b.accent+'66';ctx.lineWidth=2;rr(31,64,W-62,H-132,14);ctx.stroke();
 ctx.strokeStyle=b.second+'33';ctx.lineWidth=4;line([{x:190,y:145},{x:220,y:145},{x:220,y:360},{x:900,y:360}],ctx.strokeStyle,3);
 drawWheel();text(b.name.toUpperCase()+' / '+String(level).padStart(2,'0'),500,83,b.accent+'99',10);
 if(!player){ctx.restore();return;}
 if(signalFlash>0){ctx.strokeStyle='#62efdc'+Math.round(signalFlash*100).toString(16).padStart(2,'0');ctx.lineWidth=2;circle(120,145,(1-signalFlash)*700,null,ctx.strokeStyle);}
 if(surgeTime>0){ctx.strokeStyle='#bc9aff55';ctx.lineWidth=2;circle(500,360,80+(time*130)%620,null,ctx.strokeStyle);}
 for(const w of walls){ctx.fillStyle='#050e1e88';rr(w.x+5,w.y+7,w.w,w.h,4);ctx.fill();ctx.fillStyle=b.wall;ctx.strokeStyle=b.accent+'88';ctx.lineWidth=1;rr(w.x,w.y,w.w,w.h,4);ctx.fill();ctx.stroke();ctx.fillStyle=b.accent;ctx.fillRect(w.x+6,w.y+5,12,3);for(let x=w.x+26;x<w.x+w.w-5;x+=12){ctx.strokeStyle=b.accent+'44';ctx.beginPath();ctx.moveTo(x,w.y+5);ctx.lineTo(x-7,w.y+w.h-5);ctx.stroke();}}
 for(const h of hazards){const active=hazardActive(h);ctx.save();ctx.translate(h.x,h.y);ctx.strokeStyle=active?'#ff7f9c':'#7d5e76';ctx.fillStyle=active?'#ff7f9c33':'#34243866';ctx.lineWidth=1;rr(-h.r,-h.r,h.r*2,h.r*2,4);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(-12,-12);ctx.lineTo(12,12);ctx.moveTo(-12,12);ctx.lineTo(12,-12);ctx.stroke();if(active)circle(0,0,h.r+7,null,'#ff7f9c44');ctx.restore();}
 for(const p of pickups){if(p.taken)continue;ctx.save();ctx.translate(p.x,p.y+Math.sin(time*3+p.x)*2);const c=itemColor(p.type);ctx.fillStyle=c;ctx.shadowColor=c;ctx.shadowBlur=9;
  if(p.type==='fragment'){ctx.rotate(Math.PI/4);ctx.fillRect(-4,-4,8,8);}else{circle(0,0,12,c+'22',c);text({repair:'+',battery:'ϟ',shield:'◇',overclock:'↑',purge:'✦'}[p.type],0,5,c,16);}ctx.restore();}
 for(const e of echoes){line(e.path,'#62efdc20',9);line(e.path,'#62efdc99',1,[5,7]);courier(e.x,e.y,e.angle,'#62efdc',true);text(Math.ceil(e.life)+'s',e.x,e.y-28,'#8affeb',9);}
 if(recording){line(route,'#ff7f9c33',8);line(route,'#ff7f9c',2,[5,4]);if(route.length)circle(route[0].x,route[0].y,7,null,'#ff7f9c');}
 for(let i=0;i<relays.length;i++){const r=relays[i],c=r.on?'#62efdc':r.paired?'#bc9aff':'#67d9ff';
  if(r.paired){const other=relays.find(v=>v!==r&&v.paired);if(other)line([r,other],r.on?'#62efdc66':'#bc9aff33',1,[4,9]);}
  ctx.save();ctx.translate(r.x,r.y);ctx.lineWidth=2;circle(0,0,41,c+'16',c);ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,33,-Math.PI/2,-Math.PI/2+TAU*clamp(r.on?1:r.charge,0,1));ctx.strokeStyle=c;ctx.stroke();ctx.save();ctx.rotate(time*.5);ctx.strokeStyle=c;ctx.lineWidth=2;ctx.strokeRect(-9,-9,18,18);ctx.restore();text(r.on?'ONLINE':r.paired?'PAIRED SEAL '+(i+1):'ECHO RELAY '+(i+1),0,61,c,9);ctx.restore();}
 const unlocked=relays.every(r=>r.on)&&(!boss||boss.dead);
 for(const v of vaults){ctx.save();ctx.translate(v.x,v.y);const c=v.taken?'#476b70':unlocked?'#ffce77':'#a4835f';ctx.shadowColor=c;ctx.shadowBlur=unlocked&&!v.taken?18:0;ctx.fillStyle=c+'22';ctx.strokeStyle=c;ctx.lineWidth=2;rr(-22,-24,44,48,5);ctx.fill();ctx.stroke();ctx.strokeRect(-13,-15,26,30);circle(0,0,5,null,c);ctx.fillStyle=c;ctx.fillRect(-2,-3,4,8);ctx.shadowBlur=0;text(v.taken?'RECOVERED':unlocked?'MEMORY / OPEN':'MEMORY / LOCKED',0,43,c,8);ctx.restore();}
 ctx.save();ctx.translate(935,360);const ready=unlocked&&vaults.every(v=>v.taken);ctx.fillStyle=ready?'#d4fa8a22':'#33505122';ctx.strokeStyle=ready?'#d4fa8a':'#547777';ctx.lineWidth=2;rr(-22,-40,44,80,8);ctx.fill();ctx.stroke();text('→',0,9,ready?'#d4fa8a':'#547777',29);text('UPLINK',0,58,ready?'#d4fa8a':'#718c98',8);if(ready)circle(0,0,50+Math.sin(time*3)*4,null,'#d4fa8a77');ctx.restore();
 enemies.forEach(drawEnemy);drawBoss();
 for(const bolt of bolts){circle(bolt.x,bolt.y,bolt.r+4,bolt.color+'22');circle(bolt.x,bolt.y,bolt.r,bolt.color);}
 if(player.shield>0)circle(player.x,player.y,26+Math.sin(time*3)*2,'#67d9ff18','#67d9ff');
 if(player.purgeFlash>0)circle(player.x,player.y,(1-player.purgeFlash)*(190+up.purge*45),null,'#bc9affbb');
 if(player.invuln<=0||Math.floor(time*14)%2===0)courier(player.x,player.y,Math.atan2(player.dy,player.dx),'#d4fa8a');
 if(player.dashTime>0)line([{x:player.x-player.dx*55,y:player.y-player.dy*55},player],'#d4fa8aaa',5);
 for(const p of particles){ctx.globalAlpha=clamp(p.life/.6,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,3,3);}ctx.globalAlpha=1;
 text(b.hazard.toUpperCase()+' / WATCH THE PULSE',500,674,b.accent+'99',8);ctx.restore();
 if(mobile){const x=viewW-156,y=38,s=.14;ctx.fillStyle='#0b142be8';rr(x,y,145,103,5);ctx.fill();ctx.strokeStyle='#52667b';ctx.stroke();for(const r of relays)circle(x+r.x*s,y+r.y*s,3,r.on?'#62efdc':'#bc9aff');for(const v of vaults)if(!v.taken)circle(x+v.x*s,y+v.y*s,3,'#ffce77');circle(x+player.x*s,y+player.y*s,3,'#fff');text('BURROW MAP',x+74,y+97,'#94aabc',7);
  const target=relays.find(r=>!r.on)||vaults.find(v=>!v.taken)||{x:935,y:360};if(target.x<camX+20||target.x>camX+620){text(target.x<camX?'← RELAY / VAULT':'RELAY / VAULT →',viewW/2,viewH-85,'#ffce77',12);}}
}
function updateNetwork(){const w=feed.wheel;const badge=$('liveBadge');badge.textContent=feed.live?'LIVE':'SIMULATED';badge.className='badge '+(feed.live?'live':'simulated');
 $('wheelStat').replaceChildren(document.createTextNode(w.active?'ACTIVE ':'IDLE '));const rpm=document.createElement('b');rpm.textContent=w.rpm.toFixed(1)+' RPM';$('wheelStat').append(rpm);
 $('anchorStat').textContent=w.anchor.toLocaleString()+(feed.live?'':' SIM');$('projectedStat').textContent=w.projected.toLocaleString()+(feed.live?'':' SIM');$('distanceStat').textContent=w.distance.toLocaleString(undefined,{maximumFractionDigits:1})+' m';
 let supply='—';try{if(feed.economy?.supply?.liveSupplyBaseUnits)supply=(Number(BigInt(feed.economy.supply.liveSupplyBaseUnits)/1000000000000n)/1e6).toLocaleString(undefined,{maximumFractionDigits:0});}catch(_){}
 $('supplyStat').textContent=supply;
 $('signalEffect').textContent=(feed.live?'Hardware online':'Simulation: '+feed.reason)+'. '+(w.active?'Wheel work boosts':'Idle reserve supplies')+' echo energy +'+regen().toFixed(1)+'/s. '+(feed.live?'Real':'Practice')+' settlements → 12s Surges. Settled height tunes vent rhythms. Real distance → lore & +'+archiveBonus()+'% vault score. Projected height is optimistic.';
 if(feed.realDistance>progress.maxDistance){progress.maxDistance=feed.realDistance;persist();}
 lore.forEach((chapter,index)=>{if(chapter.meters&&progress.maxDistance>=chapter.meters)unlockLore(index,false);});if(progress.maxDistance>=1000)achieve('distance',false);
 if(player&&state==='play'&&feed.live){const currentWork=Number(feed.status.measurement.cumulativeWorkUnits);if(lastWork!==null&&currentWork>lastWork){const gain=Math.min(12,(currentWork-lastWork)*.1);player.energy=Math.min(maxEnergy(),player.energy+gain);signalFlash=1;}lastWork=currentWork;const currentAnchor=feed.wheel.anchor;if(lastAnchor!==null&&currentAnchor>lastAnchor){player.energy=Math.min(maxEnergy(),player.energy+8);signalFlash=1;toast('Settled beacon #'+currentAnchor+' / +8 energy. Burrow vent rhythms recalibrated.');}lastAnchor=currentAnchor;}
 if(feed.live&&!liveWas&&player&&state==='play')toast('Squeektoshi connected. Real wheel work now drives your echo energy.');liveWas=feed.live;
 if(player)updateHud();else $('regenText').textContent='+'+regen().toFixed(1)+'/s · '+(w.active?'wheel boost':'idle reserve');
 updateCodexCount();}
function renderLedger(){const container=$('ledgerFeed');container.replaceChildren();const liveRows=feed.settlements;
 $('feedSource').textContent=liveRows.length?(feed.source==='live'?'LIVE / SEPOLIA':'CACHED / SEPOLIA'):'SIMULATED PRACTICE';
 if(liveRows.length){for(const s of liveRows.slice(0,6)){const a=document.createElement('a');a.className='ledger-entry';a.href='https://sepolia.etherscan.io/tx/'+s.transactionHash;a.target='_blank';a.rel='noopener noreferrer';
 const head=document.createElement('strong');head.textContent='ROUND '+String(Number(s.settledThroughRound));const b=document.createElement('b');b.textContent='+'+Number(s.completedBlockCount)+' BLOCKS';head.append(b);
 const span=document.createElement('span');span.textContent='Work +'+Number(s.workAdded)+' · Height '+Number(s.blockHeight);
 const note=document.createElement('small');const date=new Date(s.blockTimestamp);note.textContent=(Number.isFinite(date.getTime())?new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',hour12:false}).format(date)+' JST':'Timestamp unavailable')+' · '+String(s.confirmationStatus).toUpperCase()+' · VIEW TX ↗';a.append(head,span,note);container.append(a);}
 $('feedNote').textContent='Real Sepolia receipts. Only newly confirmed settlements trigger live Surges; initial history does not.';
 }else{for(let i=0;i<3;i++){const card=document.createElement('div');card.className='ledger-entry';const h=document.createElement('strong');h.textContent='SIMULATED LEDGER';const s=document.createElement('span');s.textContent=['A practice Surge arrives every 45s.','Real receipts will appear when the API recovers.','No fake transaction links. No wallet needed.'][i];const n=document.createElement('small');n.textContent='PRACTICE DATA / NOT ON CHAIN';card.append(h,s,n);container.append(card);}
 $('feedNote').textContent='Simulation is not chain data. Hardware and ledger are checked again every 10 seconds.';}}
feed.addEventListener('update',updateNetwork);feed.addEventListener('ledger',renderLedger);
function renderCodex(){const container=$('codexContent');container.replaceChildren();
 const cards=infoTab==='lore'?lore.map((l,i)=>({title:progress.lore.includes(i)?l.title:'LOCKED / '+l.title,text:progress.lore.includes(i)?l.text:l.unlock,note:progress.lore.includes(i)?l.note:'Only real cumulative distance counts for distance chapters.',locked:!progress.lore.includes(i)})):
 infoTab==='enemies'?threats.map(([title,text])=>({title,text,note:'COURIER INTELLIGENCE / SQUEEKCHAIN BURROW'})):
 feats.map(([id,title,text])=>({title:(progress.feats.includes(id)?'✓ ':'○ ')+title,text,note:progress.feats.includes(id)?'EARNED ON THIS DEVICE':'NOT YET EARNED',earned:progress.feats.includes(id)}));
 for(const c of cards){const card=document.createElement('article');card.className='codex-card'+(c.locked?' locked':'')+(c.earned?' earned':'');const h=document.createElement('h3');h.textContent=c.title;const p=document.createElement('p');p.textContent=c.text;const s=document.createElement('small');s.textContent=c.note;card.append(h,p,s);container.append(card);}
 ['lore','enemy','feat'].forEach(t=>$(t+'Tab').classList.toggle('selected',infoTab===(t==='enemy'?'enemies':t==='feat'?'feats':'lore')));}
let activeInfo=null;
function openInfo(id){if(state==='info')return;previousState=state;state='info';activeInfo=id;resetInput();if(id==='codex')renderCodex();$(id).classList.remove('hidden');}
function closeInfo(){if(!activeInfo)return;$(activeInfo).classList.add('hidden');state=previousState;activeInfo=null;}
function pause(){if(state==='play'){state='pause';resetInput();$('pause').classList.remove('hidden');}else if(state==='pause'){state='play';$('pause').classList.add('hidden');}}
function toggleSound(){muted=!muted;save('echo-ledger-v2-muted',muted);$('soundBtn').textContent='Sound '+(muted?'OFF':'ON');if(!muted)sound(660,'sine',.15);}
$('startBtn').onclick=start;$('againBtn').onclick=start;$('restartBtn').onclick=start;
$('nextBtn').onclick=()=>{level++;clearOverlays();generate();state='play';toast(biome().name+' / '+biome().detail);};
$('pauseBtn').onclick=pause;$('resumeBtn').onclick=pause;$('retireBtn').onclick=()=>endRun(true);
$('summaryHome').onclick=()=>{clearOverlays();player=null;state='title';$('title').classList.remove('hidden');$('bossHud').classList.add('hidden');};
$('helpBtn').onclick=()=>openInfo('guide');$('titleHelp').onclick=()=>openInfo('guide');$('codexBtn').onclick=()=>openInfo('codex');$('closeGuide').onclick=closeInfo;$('closeCodex').onclick=closeInfo;
$('home').onclick=e=>{e.preventDefault();if(state==='play'||state==='pause')pause();else if(state==='info')closeInfo();};
$('soundBtn').onclick=toggleSound;$('soundBtn').textContent='Sound '+(muted?'OFF':'ON');
$('retryBtn').onclick=()=>feed.poll();
$('storyMode').onclick=()=>{shared=false;$('storyMode').classList.add('selected');$('sharedMode').classList.remove('selected');};
$('sharedMode').onclick=()=>{shared=true;$('sharedMode').classList.add('selected');$('storyMode').classList.remove('selected');};
$('loreTab').onclick=()=>{infoTab='lore';renderCodex();};$('enemyTab').onclick=()=>{infoTab='enemies';renderCodex();};$('featTab').onclick=()=>{infoTab='feats';renderCodex();};
addEventListener('keydown',e=>{if(e.target instanceof HTMLButtonElement&&(e.code==='Space'||e.code==='Enter'))return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Escape'].includes(e.code))e.preventDefault();if(e.repeat)return;keys[e.code]=true;
 if(e.code==='Space'||e.code==='KeyR')toggleRecord();if(e.code==='ShiftLeft'||e.code==='ShiftRight')dash();if(e.code==='KeyE')purge();
 if(e.code==='Escape'||e.code==='KeyP'){if(state==='info')closeInfo();else pause();}
 if(e.code==='KeyC'){if(state==='info'&&activeInfo==='codex')closeInfo();else openInfo('codex');}if(e.code==='KeyM')toggleSound();});
addEventListener('keyup',e=>{keys[e.code]=false;});addEventListener('blur',()=>{resetInput();if(state==='play')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='play')pause();});
$('touchRecord').onpointerdown=e=>{e.preventDefault();toggleRecord();};$('touchDash').onpointerdown=e=>{e.preventDefault();dash();};$('touchPurge').onpointerdown=e=>{e.preventDefault();purge();};
const joy=$('joystick');function drag(e){if(e.pointerId!==pointer)return;const box=joy.getBoundingClientRect();let x=(e.clientX-box.left-box.width/2)/34,y=(e.clientY-box.top-box.height/2)/34;const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}stick={x,y};$('stick').style.transform='translate('+x*25+'px,'+y*25+'px)';}
joy.onpointerdown=e=>{e.preventDefault();pointer=e.pointerId;joy.setPointerCapture(pointer);drag(e);};joy.onpointermove=drag;
function releaseStick(){pointer=null;stick={x:0,y:0};$('stick').style.transform='';}joy.onpointerup=releaseStick;joy.onpointercancel=releaseStick;
function resize(){if(innerWidth<=700){canvas.width=640;canvas.height=800;}else{canvas.width=W;canvas.height=H;}}addEventListener('resize',resize);resize();
function snapshot(){return copy({state,level,score,money,recording,recordTime,seed,seedHeight,shared,practice,biome:biome().name,player,relays,vaults,walls,enemies:enemies.map(e=>({x:e.x,y:e.y,type:e.type,stun:e.stun})),hazards,pickups,echoes:echoes.map(e=>({x:e.x,y:e.y,life:e.life})),upgrades:up,echoLimit:echoLimit(),regen:regen(),boss,stats,surgeTime,progress,telemetry:feed.snapshot()});}
const diagnostics={snapshot};
if(testMode)diagnostics.debug={teleport:(x,y)=>{if(player){player.x=clamp(x,48,952);player.y=clamp(y,90,635);}},protect:()=>{if(player)player.invuln=9999;},clearThreats:()=>{enemies=[];hazards=[];bolts=[];},surge:()=>{if(state==='play')applySurge({simulated:true,blocks:3,rows:[]});},fragments:n=>{money=Math.max(0,Math.floor(n));if(state==='shop')renderShop();}};
Object.defineProperty(window,'echoLedger',{value:Object.freeze(diagnostics),writable:false});
$('bestTitle').textContent='PERSONAL BEST / '+String(progress.best).padStart(5,'0');updateNetwork();renderLedger();updateCodexCount();
function frame(t){const dt=Math.min((t-last)/1000,.04)||.016;last=t;update(dt);draw();requestAnimationFrame(frame);}requestAnimationFrame(frame);
})();
