/*!
 * multiplayer.js — multijogador por salas WebSocket (relé itty.ws) + interpolação.
 * Sem dependências, um só ficheiro. Funciona em <script> normal ou com require().
 *
 * USO RÁPIDO
 *   const mp = new Multiplayer({ game: "meujogo", version: 1, angleKeys: ["heading"] });
 *   mp.on("status", s => console.log(s.message));          // ligação / nº de jogadores
 *   mp.on("join",   p => console.log("entrou", p.alias));
 *   mp.on("leave",  p => console.log("saiu", p.alias));
 *   mp.on("chat",   m => console.log(m.alias + ": " + m.data.text));
 *   mp.join("sala1", "Daniel");
 *
 *   // no teu loop de jogo (todos os frames):
 *   mp.sendState({ x, y, heading, speed });                 // envia só o necessário (~20 Hz)
 *   for (const p of mp.list()) draw(p.uid, p.alias, p.state); // estado já interpolado
 *
 *   mp.send("chat", { text: "olá" });                       // mensagem para a sala
 *   mp.send("golo", { n: 1 }, uidDoJogador);                // mensagem só para um jogador
 *
 * PROTOCOLO (relé itty.ws, como no Planet-0 Drive)
 *   URL:      wss://itty.ws/c/<canal>?as=<nome>&announce=true&list=true
 *   Enviar:   JSON.stringify({ type, ... })  — para um jogador: "\u001f<uid>\u001f" + JSON
 *   Receber:  eventos do servidor {type:"join"|"leave", uid, alias, self, users, total}
 *             mensagens de jogadores {message:{type,...}, uid, alias}
 *
 * Para usar o teu próprio servidor: new Multiplayer({ server: "wss://o-teu-servidor/sala/" }).
 */
(function (root) {
  "use strict";

  var US = "\u001f";

  function clean(s, max) {
    return String(s == null ? "" : s).replace(/[^a-zA-Z0-9:_-]+/g, "-").slice(0, max);
  }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function lerpAngle(a, b, k) {
    var d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; // caminho mais curto
    return a + d * k;
  }

  function Multiplayer(opts) {
    opts = opts || {};
    this.game = clean(opts.game || "game", 24);          // prefixo único do teu projeto
    this.version = clean(String(opts.version == null ? 1 : opts.version), 12); // versões diferentes não se cruzam
    this.server = opts.server || "wss://itty.ws/c/";
    this.sendHz = opts.sendHz || 20;                     // máx. envios de estado por segundo
    this.heartbeat = opts.heartbeat || 1000;             // com o estado parado, reenvia a cada X ms
    this.interpDelay = opts.interpDelay == null ? 120 : opts.interpDelay; // ms de atraso para suavizar
    this.timeout = opts.timeout || 10000;                // remove jogadores sem notícias há X ms
    this.angleKeys = opts.angleKeys || [];               // campos em radianos (ex.: "heading")
    this.teleportKey = opts.teleportKey || null;         // se este campo mudar, não interpola (teleporte)
    this.now = opts.now || function () { return (typeof performance !== "undefined" ? performance.now() : Date.now()); };
    this.WS = opts.WebSocket || root.WebSocket;

    this.players = new Map();                            // uid -> { uid, alias, buf:[{t,s}], last }
    this.selfUid = null;
    this.alias = "Jogador";
    this.room = "";
    this.status = { connected: false, connecting: false, online: 0, room: "", message: "Desligado" };

    this._handlers = {};
    this._queue = [];
    this._ws = null;
    this._closing = false;
    this._retry = 0;
    this._retryTimer = 0;
    this._sweepTimer = 0;
    this._lastSend = -Infinity;
    this._lastState = null;
  }

  var P = Multiplayer.prototype;

  /* ---------- eventos ---------- */
  P.on = function (type, fn) {
    (this._handlers[type] = this._handlers[type] || []).push(fn);
    var self = this;
    return function () { self.off(type, fn); };
  };
  P.off = function (type, fn) {
    this._handlers[type] = (this._handlers[type] || []).filter(function (f) { return f !== fn; });
  };
  P._emit = function (type, payload) {
    var list = this._handlers[type] || [];
    for (var i = 0; i < list.length; i++) {
      try { list[i](payload); } catch (e) { console.error("[multiplayer] handler", type, e); }
    }
  };
  P._status = function (patch) {
    for (var k in patch) this.status[k] = patch[k];
    this._emit("status", this.status);
  };

  /* ---------- ligação ---------- */
  P.join = function (room, alias) {
    this.disconnect();
    this._closing = false;
    this.room = clean(room, 48) || "public";
    this.alias = String(alias || "Jogador").trim().slice(0, 24) || "Jogador";
    this._retry = 0;
    this._open();
    var self = this;
    this._sweepTimer = setInterval(function () { self._sweep(); }, 2000);
  };

  P._url = function () {
    var base = /^wss?:/.test(this.server) ? this.server : "wss://itty.ws/c/";
    var channel = this.game + ":" + this.version + ":" + this.room;
    return base + channel + "?" + new URLSearchParams({ as: this.alias, announce: true, list: true });
  };

  P._open = function () {
    var self = this, ws;
    this._status({ connected: false, connecting: true, message: "A ligar a " + this.room + "…" });
    try { ws = new this.WS(this._url()); }
    catch (e) { this._status({ connecting: false, message: "Erro: " + e.message }); return this._reconnect(); }
    this._ws = ws;

    ws.onopen = function () {
      if (self._ws !== ws) return;
      self._retry = 0;
      self._status({ connecting: false, message: "A entrar em " + self.room + "…" });
      var q = self._queue.splice(0);
      for (var i = 0; i < q.length; i++) ws.send(q[i]);
    };
    ws.onmessage = function (e) { if (self._ws === ws) self._onData(e.data); };
    ws.onerror = function () { /* o onclose trata do resto */ };
    ws.onclose = function () {
      if (self._ws !== ws) return;
      self._ws = null;
      self._status({ connected: false, connecting: false, online: 0, message: self._closing ? "Desligado" : "Ligação perdida" });
      if (!self._closing) self._reconnect();
    };
  };

  P._reconnect = function () {
    var self = this, wait = Math.min(15000, 1000 * Math.pow(2, this._retry++));
    this._status({ message: "A voltar a ligar em " + Math.round(wait / 1000) + "s…" });
    clearTimeout(this._retryTimer);
    this._retryTimer = setTimeout(function () { if (!self._closing) self._open(); }, wait);
  };

  P.disconnect = function () {
    this._closing = true;
    clearTimeout(this._retryTimer);
    clearInterval(this._sweepTimer);
    var ws = this._ws; this._ws = null;
    if (ws) { try { ws.close(); } catch (e) {} }
    this.players.clear();
    this._queue.length = 0;
    this._lastState = null;
    this.selfUid = null;
    this.status = { connected: false, connecting: false, online: 0, room: this.room, message: "Desligado" };
  };

  /* ---------- receber ---------- */
  P._addPlayer = function (uid, alias) {
    if (!uid || uid === this.selfUid) return null;
    var p = this.players.get(uid);
    if (!p) {
      p = { uid: uid, alias: alias || "Jogador", buf: [], last: this.now() };
      this.players.set(uid, p);
      this._emit("join", p);
    } else if (alias) p.alias = alias;
    return p;
  };
  P._removePlayer = function (uid) {
    var p = this.players.get(uid);
    if (p) { this.players.delete(uid); this._emit("leave", p); }
  };

  P._onData = function (raw) {
    var d;
    try { d = JSON.parse(raw); } catch (e) { return; }
    if (!d || typeof d !== "object") return;

    if (d.type === "join") {                       // evento do servidor
      if (d.self) {
        this.selfUid = d.uid || (d.users && (d.users.find(function (u) { return u.self; }) || {}).uid) || this.selfUid;
        var us = d.users || [];
        for (var i = 0; i < us.length; i++) if (!us[i].self) this._addPlayer(us[i].uid, us[i].alias);
        this._status({ connected: true, connecting: false, online: d.total, room: this.room, message: d.total + " online" });
        this._emit("ready", { uid: this.selfUid });
      } else {
        this._addPlayer(d.uid, d.alias);
        this._status({ online: d.total, message: d.total + " online" });
      }
      return;
    }
    if (d.type === "leave") {
      if (d.uid) this._removePlayer(d.uid);
      this._status({ online: d.total, message: d.total + " online" });
      return;
    }
    if (d.type) { this._emit("server:" + d.type, d); return; } // outros eventos do servidor (erros, etc.)

    var m = d.message;                             // mensagem de outro jogador
    if (!m || typeof m !== "object" || !m.type || !d.uid || d.uid === this.selfUid) return;
    var p = this._addPlayer(d.uid, d.alias);
    if (!p) return;
    p.last = this.now();
    if (m.type === "pose") {
      if (m.s && typeof m.s === "object") {
        p.buf.push({ t: p.last, s: m.s });
        if (p.buf.length > 30) p.buf.shift();
      }
      return;
    }
    this._emit(m.type, { uid: d.uid, alias: p.alias, data: m });
  };

  /* ---------- enviar ---------- */
  // send("tipo", {dados}, uidOpcional)  ->  true se foi enviado já, false se ficou em fila
  P.send = function (type, data, to, noQueue) {
    var payload = { type: type };
    if (data) for (var k in data) if (k !== "type") payload[k] = data[k];
    var text = (to ? US + to + US : "") + JSON.stringify(payload);
    var ws = this._ws;
    if (ws && ws.readyState === 1) { ws.send(text); return true; }
    if (!noQueue && this._queue.length < 100) this._queue.push(text);
    return false;
  };

  // Chama todos os frames; só envia quando necessário (mudou + intervalo, ou heartbeat).
  P.sendState = function (state, force) {
    var now = this.now(), last = this._lastState, changed = !last;
    if (last) for (var k in state) if (state[k] !== last[k]) { changed = true; break; }
    var due = now - this._lastSend >= (changed ? 1000 / this.sendHz : this.heartbeat);
    if (!force && !due) return false;
    if (!this.send("pose", { s: state }, null, true)) return false;
    this._lastSend = now;
    this._lastState = Object.assign({}, state);
    return true;
  };

  /* ---------- ler jogadores (interpolados) ---------- */
  P._sample = function (p, renderT) {
    var b = p.buf, n = b.length;
    if (!n) return null;
    if (n === 1 || renderT <= b[0].t) return Object.assign({}, b[0].s);
    if (renderT >= b[n - 1].t) return Object.assign({}, b[n - 1].s);
    var i = 1;
    while (b[i].t < renderT) i++;
    var a = b[i - 1], c = b[i];
    if (this.teleportKey && a.s[this.teleportKey] !== c.s[this.teleportKey]) return Object.assign({}, c.s);
    var k = (renderT - a.t) / (c.t - a.t || 1), out = {};
    for (var key in c.s) {
      var av = a.s[key], cv = c.s[key];
      if (typeof cv === "number" && typeof av === "number")
        out[key] = this.angleKeys.indexOf(key) >= 0 ? lerpAngle(av, cv, k) : lerp(av, cv, k);
      else out[key] = av !== undefined ? av : cv;
    }
    return out;
  };

  P.list = function (now) {
    var t = (now == null ? this.now() : now) - this.interpDelay, out = [];
    this.players.forEach(function (p) {
      var s = this._sample(p, t);
      if (s) out.push({ uid: p.uid, alias: p.alias, state: s });
    }, this);
    return out;
  };

  P._sweep = function () {
    var now = this.now(), dead = [];
    this.players.forEach(function (p) { if (p.buf.length && now - p.last > this.timeout) dead.push(p.uid); }, this);
    for (var i = 0; i < dead.length; i++) this._removePlayer(dead[i]);
  };

  root.Multiplayer = Multiplayer;
  if (typeof module !== "undefined" && module.exports) module.exports = Multiplayer;
})(typeof window !== "undefined" ? window : globalThis);
