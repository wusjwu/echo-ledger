'use strict';
/* Public read-only Squeekchain telemetry. No wallet, credential, RPC or proxy. */
(() => {
  const API = 'https://api.squeekchain.com/v1/';
  const offline = new URLSearchParams(location.search).get('offline') === '1';
  const n = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  class SqueekFeed extends EventTarget {
    constructor() {
      super();
      this.live = false; this.reason = offline ? 'Offline practice selected' : 'Connecting to public telemetry';
      this.status = null; this.economy = null; this.settlements = []; this.source = 'connecting';
      this.lastSuccess = 0; this.requests = {}; this.seen = new Set(); this.baseline = false;
      this.realDistance = 0; this.simTime = 0; this.simHeight = 1200; this.simWork = 0;
      this.busy = false; this.pollNumber = 0; this.lastSimSurge = 0;
      this.timer = setInterval(() => this.tick(), 1000);
      this.pollTimer = setInterval(() => this.poll(), 10000);
      this.poll();
    }
    emit(type, detail) { this.dispatchEvent(new CustomEvent(type, {detail})); }
    async get(path) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      try {
        const res = await fetch(API + path, {mode:'cors', credentials:'omit', cache:'no-store', signal:controller.signal});
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json(); this.requests[path] = {ok:true, cors:res.type, at:Date.now()};
        return {data, source:res.headers.get('X-Squeek-Settlement-Source') || 'public API'};
      } catch (error) {
        this.requests[path] = {ok:false, error:error.name === 'AbortError' ? 'timeout' : error.message, at:Date.now()};
        throw error;
      } finally { clearTimeout(timer); }
    }
    async poll() {
      if (offline || this.busy) return;
      this.busy = true;
      const jobs = [this.get('status').then(({data}) => {
        const m = data.measurement, anchor = data.builder?.anchor;
        if (!m || !anchor || !Number.isFinite(Number(anchor.blockHeight))) throw new Error('Unsupported telemetry schema');
        const age = Date.now() - Date.parse(m.observedAt);
        if (m.freshness !== 'online' || !Number.isFinite(age) || age > n(m.staleAfterSeconds,120) * 1000) throw new Error('Hardware telemetry is stale');
        this.status = data; this.live = true; this.reason = ''; this.lastSuccess = Date.now();
        this.realDistance = Math.max(this.realDistance, n(m.distanceMm) / 1000);
        this.emit('update');
      }).catch(error => {
        this.live = false; this.reason = error.message === 'Failed to fetch' ? 'Network or CORS unavailable' : error.message;
        this.emit('update');
      }), this.get('settlements').then(({data,source}) => {
        if (!Array.isArray(data.recentSettlements)) throw new Error('Unsupported ledger schema');
        const safe = data.recentSettlements.filter(s => ['safe','confirmed','finalized'].includes(s.confirmationStatus) && /^0x[0-9a-f]{64}$/i.test(s.transactionHash));
        const fresh = safe.filter(s => !this.seen.has(s.transactionHash + ':' + s.logIndex));
        const hadBaseline = this.baseline;
        safe.forEach(s => this.seen.add(s.transactionHash + ':' + s.logIndex));
        this.baseline = true; this.settlements = safe.slice(0,8); this.source = source;
        // Initial history is not a new settlement. Coalesce batches into one tactical event.
        if (hadBaseline && fresh.length && this.live && source === 'live') this.emit('settlement', {simulated:false, rows:fresh, blocks:fresh.reduce((sum,s) => sum+n(s.completedBlockCount),0)});
        this.emit('ledger');
      }).catch(() => { this.source = this.settlements.length ? 'cached / unavailable' : 'unavailable'; this.emit('ledger'); })];
      if (this.pollNumber++ % 3 === 0 || !this.economy) jobs.push(this.get('economy/state').then(({data}) => {
        if (data.asset?.symbol === 'SQK') this.economy = data;
        this.emit('update');
      }).catch(() => {}));
      await Promise.all(jobs); this.busy = false;
    }
    tick() {
      if (this.live && Date.now() - this.lastSuccess > 22000) { this.live = false; this.reason = 'Telemetry timed out'; }
      if (!this.live) {
        this.simTime++;
        this.simWork += this.simTime % 40 < 28 ? 3 : 0;
        if (this.simTime - this.lastSimSurge >= 45) {
          this.lastSimSurge = this.simTime; this.simHeight += 3;
          this.emit('settlement', {simulated:true, blocks:3, rows:[]});
        }
      }
      this.emit('update');
    }
    get wheel() {
      if (this.live && this.status) {
        const m = this.status.measurement;
        return {active:m.coreStatus === 'ACTIVE', rpm:Math.max(0,n(m.rpmMilli)/1000), distance:n(m.distanceMm)/1000,
          work:n(m.cumulativeWorkUnits), anchor:n(this.status.builder.anchor.blockHeight), projected:n(this.status.builder.projected?.blockHeight)};
      }
      const active = this.simTime % 40 < 28;
      return {active, rpm:active ? 35 + Math.sin(this.simTime/5)*16 : 0, distance:500 + this.simWork*.3, work:this.simWork,
        anchor:this.simHeight, projected:this.simHeight + (active?2:0)};
    }
    snapshot() { return {live:this.live, reason:this.reason, wheel:this.wheel, realDistance:this.realDistance, source:this.source,
      requests:JSON.parse(JSON.stringify(this.requests)), settlements:this.settlements.length}; }
  }
  window.squeekFeed = new SqueekFeed();
})();
