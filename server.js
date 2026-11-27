const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const WorldMap = require("./world-map.js");

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 10;
const DAY_MS = Number(process.env.DAY_MS) || 20000;
const HOURS_PER_DAY = 10;
const ADJ_THRESHOLD = 34;
const WIN_PROVINCES = 150;

const { nations, provinces: BASE_PROVINCES, RESOURCE_TYPES, RESOURCE_NAMES } = WorldMap;

const UNIT_LABELS = { infantry: "Infanterie", artillery: "Artillerie", tanks: "Chars", aircraft: "Avions", ships: "Navires" };
const UNIT_POWER = { infantry: 1, artillery: 6, tanks: 15, aircraft: 12, ships: 10 };
const UNIT_COSTS = {
  infantry: { money: 3, food: 2 },
  artillery: { money: 12, iron: 4 },
  tanks: { money: 40, iron: 15, oil: 5 },
  aircraft: { money: 50, iron: 10, oil: 8 },
  ships: { money: 120, wood: 40, oil: 12 }
};
const BUILD_LABELS = { barracks: "Caserne", factory: "Usine", port: "Port", railway: "Gare", fort: "Fort" };
const BUILD_COSTS = {
  barracks: { money: 300, wood: 100 },
  factory: { money: 600, iron: 200 },
  port: { money: 400, wood: 250 },
  railway: { money: 350, wood: 150 },
  fort: { money: 500, iron: 300 }
};

function computeAdjacency() {
  const adj = {};
  for (const p of BASE_PROVINCES) {
    adj[p.id] = BASE_PROVINCES
      .filter(q => q.id !== p.id && Math.hypot(p.x - q.x, p.y - q.y) <= ADJ_THRESHOLD)
      .map(q => q.id);
  }
  return adj;
}
const ADJACENCY = computeAdjacency();

function cloneProvinces() {
  return BASE_PROVINCES.map(p => ({
    ...p,
    owner: p.nation,
    units: { ...p.units },
    buildings: { ...p.buildings },
    resources: { ...p.resources },
    production: { ...p.production }
  }));
}
function treasury(room, nationId) {
  const t = {};
  for (const k of RESOURCE_TYPES) t[k] = 0;
  for (const p of room.provinces) {
    if (p.owner !== nationId) continue;
    for (const k of RESOURCE_TYPES) t[k] += p.resources[k] || 0;
  }
  return t;
}
function nationProvinces(room, nationId) { return room.provinces.filter(p => p.owner === nationId); }
function canPay(res, cost, mult = 1) { return Object.entries(cost).every(([k, v]) => (res[k] || 0) >= v * mult); }
function pay(res, cost, mult = 1) { for (const [k, v] of Object.entries(cost)) res[k] -= v * mult; }
function garrisonPower(p) { return Object.entries(p.units).reduce((a, [k, v]) => a + v * (UNIT_POWER[k] || 1), 0); }
function defenseBonus(p) { return (p.buildings.fort > 0 ? 1.4 : 1) * (p.buildings.barracks > 1 ? 1 + (p.buildings.barracks - 1) * 0.1 : 1); }
function addLog(room, msg) { room.log.push({ time: Date.now(), msg }); if (room.log.length > 300) room.log.shift(); }
function rnd(a, b) { return a + Math.random() * (b - a); }

function initialTreasury(room, nationId) {
  const t = {};
  for (const k of RESOURCE_TYPES) t[k] = 0;
  for (const p of nationProvinces(room, nationId)) for (const k of RESOURCE_TYPES) t[k] += p.resources[k] || 0;
  return t;
}
function newRoom(code, hostPlayer, cheats, settings) {
  const provinces = cloneProvinces();
  const room = {
    code, hostToken: code + "-" + Math.random().toString(36).slice(2, 10),
    day: 1, started: false, cheats: !!cheats, settings: settings || null, over: false, winner: null,
    players: [hostPlayer],
    nations: nations.map(n => ({ id: n.id, name: n.name, flag: n.flag, color: n.color, player: null })),
    provinces, adjacency: ADJACENCY, log: [], treasury: {}
  };
  room.provById = Object.fromEntries(provinces.map(p => [p.id, p]));
  return room;
}
function publicState(room) {
  return {
    code: room.code, day: room.day, started: room.started, cheats: room.cheats,
    over: room.over || false, winner: room.winner || null,
    winTarget: WIN_PROVINCES,
    players: room.players.map(p => ({ id: p.id, name: p.name, host: p.host, online: p.online, nation: p.nation, bot: !!p.bot })),
    nations: room.nations,
    treasury: room.treasury,
    provinces: room.provinces.map(p => ({
      id: p.id, name: p.name, nation: p.nation, owner: p.owner, x: p.x, y: p.y,
      flag: p.flag, population: p.population, units: p.units, buildings: p.buildings, production: p.production, resources: p.resources
    })),
    adjacency: room.adjacency, log: room.log
  };
}
function broadcast(io, room) { io.to(room.code).emit("state", publicState(room)); }
function playerNation(room, playerId) {
  const p = room.players.find(x => x.id === playerId);
  return p ? p.nation : null;
}
function checkVictory(io, room) {
  if (room.over) return;
  const counts = {};
  for (const p of room.provinces) counts[p.owner] = (counts[p.owner] || 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= WIN_PROVINCES) {
    room.over = true;
    const nation = room.nations.find(n => n.id === top[0]);
    room.winner = nation ? nation.name : top[0];
    addLog(room, `🏆 ${room.winner} contrôle ${top[1]} provinces et remporte la partie !`);
    broadcast(io, room);
  }
}

function sendUnits(src, fraction) {
  const sent = {};
  for (const [k, v] of Object.entries(src.units)) {
    const n = Math.floor(v * fraction);
    if (n > 0) sent[k] = n;
  }
  return sent;
}
function subtractUnits(p, units) { for (const [k, v] of Object.entries(units)) p.units[k] -= v; }
function addUnits(p, units) { for (const [k, v] of Object.entries(units)) p.units[k] = (p.units[k] || 0) + v; }
function unitsPower(units) { return Object.entries(units).reduce((a, [k, v]) => a + v * (UNIT_POWER[k] || 1), 0); }
function unitsCount(units) { return Object.values(units).reduce((a, b) => a + b, 0); }
function scaleUnits(units, factor) {
  const r = {};
  for (const [k, v] of Object.entries(units)) { const n = Math.floor(v * factor); if (n > 0) r[k] = n; }
  return r;
}

function resolveCombat(room, attackerId, src, dst, fraction) {
  const attacker = room.nations.find(n => n.id === attackerId);
  const defenderId = dst.owner;
  const defender = room.nations.find(n => n.id === defenderId);
  const sent = sendUnits(src, fraction);
  if (unitsCount(sent) === 0) return false;
  subtractUnits(src, sent);
  const atkPower = unitsPower(sent) * rnd(0.8, 1.25);
  const defPower = garrisonPower(dst) * defenseBonus(dst) * rnd(0.8, 1.25);
  const defLabel = defender ? defender.flag + " " + defender.name : defenderId;
  if (atkPower > defPower) {
    const survivors = scaleUnits(sent, Math.max(0.15, 1 - defPower / (atkPower * 1.8)));
    dst.owner = attackerId;
    dst.units = Object.fromEntries(Object.keys(dst.units).map(k => [k, survivors[k] || 0]));
    addLog(room, `⚔️ ${attacker.flag} ${attacker.name} s'empare de ${dst.name} (tenue par ${defLabel}) — ${unitsCount(survivors)} soldats survivants.`);
    return true;
  }
  const defLosses = scaleUnits(dst.units, Math.max(0, 1 - atkPower / (defPower * 1.8)));
  dst.units = defLosses;
  const survivors = scaleUnits(sent, 0.5);
  addUnits(src, survivors);
  addLog(room, `🛡️ L'assaut de ${attacker.flag} ${attacker.name} sur ${dst.name} (${defLabel}) est repoussé — ${unitsCount(survivors)} soldats rentrent à ${src.name}.`);
  return false;
}

function botTurn(io, room, bot) {
  const nationId = bot.nation;
  if (!nationId) return;
  const mine = nationProvinces(room, nationId);
  if (!mine.length) return;
  const byId = room.provById;
  const borderProvs = mine.filter(p => room.adjacency[p.id].some(t => byId[t].owner !== nationId));
  const pool = borderProvs.length ? borderProvs : mine;
  const tres = room.treasury[bot.id];
  if (tres) {
    const prov = pool.reduce((a, p) => (garrisonPower(p) > garrisonPower(a) ? p : a), pool[0]);
    const order = ["infantry", "infantry", "artillery", "tanks"];
    const unit = order[Math.floor(Math.random() * order.length)];
    const cost = UNIT_COSTS[unit];
    let n = 0;
    while (n < 1000 && canPay(tres, cost, n + 50)) n += 50;
    if (n > 0 && canPay(tres, cost, n)) { pay(tres, cost, n); prov.units[unit] += n; }
  }
  const src = pool.reduce((a, p) => (garrisonPower(p) > garrisonPower(a) ? p : a), pool[0]);
  const targets = room.adjacency[src.id].map(t => byId[t]).filter(t => t.owner !== nationId);
  if (!targets.length) return;
  targets.sort((a, b) => garrisonPower(a) - garrisonPower(b));
  const tgt = targets[0];
  const fraction = 0.7;
  const sent = sendUnits(src, fraction);
  if (unitsPower(sent) * 1.15 > garrisonPower(tgt) * defenseBonus(tgt)) resolveCombat(room, nationId, src, tgt, fraction);
  checkVictory(io, room);
}

const rooms = new Map();
function genCode() {
  let c;
  do { c = Array.from({ length: 5 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join(""); } while (rooms.has(c));
  return c;
}

const server = http.createServer((req, res) => {
  if (req.url === "/" || req.url.startsWith("/index")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(fs.readFileSync(path.join(__dirname, "index.html")));
  } else if (req.url === "/world-map.js") {
    res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
    res.end(fs.readFileSync(path.join(__dirname, "world-map.js")));
  } else { res.writeHead(404); res.end("Not found"); }
});
const io = new Server(server);
io.serveClient(true);

io.on("connection", socket => {
  let room = null;

  socket.on("createGame", ({ name, cheats, settings } = {}) => {
    if (room) return;
    const id = socket.id;
    const player = { id, name: String(name || "Commandant").slice(0, 22), host: true, online: true, nation: null };
    const code = genCode();
    room = newRoom(code, player, cheats, settings);
    rooms.set(code, room);
    socket.join(code);
    addLog(room, `${player.name} a créé la partie ${code}${room.cheats ? " (triche activée)" : ""}.`);
    socket.emit("created", { code, hostToken: room.hostToken });
    broadcast(io, room);
  });

  socket.on("joinGame", ({ name, code } = {}) => {
    const r = rooms.get(String(code || "").toUpperCase());
    if (!r) return socket.emit("errorMessage", "Partie introuvable. Vérifie le code d'invitation.");
    if (r.over) return socket.emit("errorMessage", "Cette partie est terminée.");
    if (r.players.filter(p => !p.bot).length >= MAX_PLAYERS) return socket.emit("errorMessage", "Cette partie est complète (10 joueurs max).");
    if (r.players.some(p => p.name === name)) return socket.emit("errorMessage", "Ce nom de commandant est déjà pris.");
    const player = { id: socket.id, name: String(name || "Commandant").slice(0, 22), host: false, online: true, nation: null };
    r.players.push(player);
    r.treasury[player.id] = { food: 500, wood: 300, iron: 200, oil: 100, coal: 200, money: 1500 };
    room = r;
    socket.join(r.code);
    addLog(r, `${player.name} a rejoint la partie.`);
    broadcast(io, r);
  });

  socket.on("chooseNation", ({ nationId } = {}) => {
    if (!room || !room.players.some(p => p.id === socket.id)) return;
    if (room.started) return socket.emit("errorMessage", "La partie a déjà commencé.");
    const n = room.nations.find(x => x.id === nationId);
    if (!n) return socket.emit("errorMessage", "Nation inconnue.");
    if (n.player !== null) return socket.emit("errorMessage", "Cette nation est déjà commandée.");
    const me = room.players.find(p => p.id === socket.id);
    if (me.nation !== null) room.nations.find(x => x.id === me.nation).player = null;
    me.nation = n.id; n.player = socket.id;
    addLog(room, `${me.name} commande désormais ${n.flag} ${n.name}.`);
    broadcast(io, room);
  });

  socket.on("startGame", ({ hostToken, bots } = {}) => {
    if (!room || hostToken !== room.hostToken) return socket.emit("errorMessage", "Seul le créateur peut lancer la partie.");
    if (room.started) return;
    if (room.players.some(p => !p.bot && p.nation === null)) return socket.emit("errorMessage", "Chaque joueur doit d'abord choisir une nation.");
    room.started = true;
    if (bots) {
      for (const n of room.nations) {
        if (n.player === null) {
          const bot = { id: "bot:" + n.id, name: "IA " + n.name, host: false, online: true, nation: n.id, bot: true };
          room.players.push(bot);
          n.player = bot.id;
          room.treasury[bot.id] = initialTreasury(room, n.id);
        }
      }
    }
    for (const p of room.players) if (!room.treasury[p.id] && p.nation) room.treasury[p.id] = initialTreasury(room, p.nation);
    const host = room.players.find(p => p.host);
    if (room.cheats && room.settings && host && host.nation) {
      const bonus = Number(room.settings.hostBonus) > 0 ? (Number(room.settings.hostBonus) === 2 ? 2 : 1.5) : 1;
      const t = room.treasury[host.id];
      const mine = nationProvinces(room, host.nation).length;
      for (const k of RESOURCE_TYPES) t[k] = Math.floor(t[k] * bonus);
      if (room.settings.startMoney) t.money += (Number(room.settings.startMoney) || 0) * mine;
      addLog(room, `[Triche] Le trésor du créateur reçoit des réserves supplémentaires.`);
    }
    const hostNation = room.nations.find(n => n.id === (host && host.nation));
    addLog(room, `La partie commence ! Jour 1. ${room.nations.filter(n => n.player).length} nations en lice. Objectif : ${WIN_PROVINCES} provinces.`);
    if (hostNation) addLog(room, `${hostNation.flag} ${hostNation.name} entre en guerre.`);
    broadcast(io, room);
  });

  socket.on("recruit", ({ unit, amount, provinceId } = {}) => {
    if (!room || !room.started || room.over) return socket.emit("errorMessage", "La partie n'a pas encore commencé.");
    const nationId = playerNation(room, socket.id);
    if (!nationId) return socket.emit("errorMessage", "Choisis d'abord une nation.");
    const cost = UNIT_COSTS[unit];
    if (!cost) return socket.emit("errorMessage", "Unité inconnue.");
    if (unit === "ships") {
      const prov = room.provinces.find(p => p.id === provinceId && p.owner === nationId);
      if (!prov || prov.buildings.port < 1) return socket.emit("errorMessage", "Les navires exigent un port dans la province.");
    }
    const n = Math.max(1, Math.min(1000, Math.floor(Number(amount) || 0)));
    const prov = room.provinces.find(p => p.id === provinceId && p.owner === nationId);
    if (!prov) return socket.emit("errorMessage", "Province invalide ou non contrôlée par vous.");
    const tres = room.treasury[socket.id];
    if (!canPay(tres, cost, n)) return socket.emit("errorMessage", `Trésor insuffisant pour ${n} ${UNIT_LABELS[unit]}.`);
    pay(tres, cost, n);
    prov.units[unit] += n;
    const pname = room.players.find(p => p.id === socket.id)?.name;
    addLog(room, `${pname} recrute ${n} ${UNIT_LABELS[unit]} à ${prov.name}.`);
    broadcast(io, room);
  });

  socket.on("build", ({ building, provinceId } = {}) => {
    if (!room || !room.started || room.over) return socket.emit("errorMessage", "La partie n'a pas encore commencé.");
    const nationId = playerNation(room, socket.id);
    if (!nationId) return socket.emit("errorMessage", "Choisis d'abord une nation.");
    const cost = BUILD_COSTS[building];
    if (!cost) return socket.emit("errorMessage", "Bâtiment inconnu.");
    const prov = room.provinces.find(p => p.id === provinceId && p.owner === nationId);
    if (!prov) return socket.emit("errorMessage", "Province invalide ou non contrôlée par vous.");
    const tres = room.treasury[socket.id];
    if (!canPay(tres, cost)) return socket.emit("errorMessage", `Trésor insuffisant pour un(e) ${BUILD_LABELS[building]}.`);
    pay(tres, cost);
    prov.buildings[building] += 1;
    addLog(room, `${BUILD_LABELS[building]} construit à ${prov.name}.`);
    broadcast(io, room);
  });

  socket.on("attack", ({ from, to, fraction } = {}) => {
    if (!room || !room.started || room.over) return socket.emit("errorMessage", "La partie n'a pas encore commencé.");
    const nationId = playerNation(room, socket.id);
    if (!nationId) return socket.emit("errorMessage", "Choisis d'abord une nation.");
    const src = room.provinces.find(p => p.id === from), dst = room.provinces.find(p => p.id === to);
    if (!src || !dst) return socket.emit("errorMessage", "Province inconnue.");
    if (src.owner !== nationId) return socket.emit("errorMessage", `Vous ne contrôlez pas ${src.name}.`);
    if (!room.adjacency[src.id] || !room.adjacency[src.id].includes(dst.id)) return socket.emit("errorMessage", `${dst.name} n'est pas adjacente à ${src.name}.`);
    if (dst.owner === nationId) return socket.emit("errorMessage", `${dst.name} vous appartient déjà.`);
    const f = Math.min(0.9, Math.max(0.1, Number(fraction) || 0.6));
    resolveCombat(room, nationId, src, dst, f);
    checkVictory(io, room);
    broadcast(io, room);
  });

  socket.on("adminAction", payload => {
    const { hostToken, kind, amount, targetId, resource, unit, building } = payload || {};
    if (!room || hostToken !== room.hostToken) return socket.emit("errorMessage", "Commande réservée au créateur.");
    if (room.cheats !== true) return socket.emit("errorMessage", "La triche est désactivée pour cette partie.");
    const target = room.players.find(p => p.id === targetId);
    if (!target || target.nation === null) return socket.emit("errorMessage", "Joueur cible introuvable ou sans nation.");
    const n = Math.max(1, Math.min(100000, Math.floor(Number(amount) || 0)));
    const provs = nationProvinces(room, target.nation);
    if (!provs.length) return socket.emit("errorMessage", "Cette nation ne contrôle plus aucune province.");
    if (kind === "resource") {
      const k = RESOURCE_TYPES.includes(resource) ? resource : "money";
      room.treasury[target.id][k] += n;
      addLog(room, `[Triche] +${n} ${RESOURCE_NAMES[k]} pour ${target.name}.`);
    } else if (kind === "troops" || kind === "vehicle") {
      const u = Object.keys(UNIT_COSTS).includes((unit || "").toLowerCase()) ? unit.toLowerCase() : "infantry";
      provs[0].units[u] += n;
      addLog(room, `[Triche] +${n} ${UNIT_LABELS[u]} pour ${target.name} à ${provs[0].name}.`);
    } else if (kind === "building") {
      const b = Object.keys(BUILD_COSTS).includes((building || "").toLowerCase()) ? building.toLowerCase() : "fort";
      provs[0].buildings[b] += 1;
      addLog(room, `[Triche] ${BUILD_LABELS[b]} offert à ${target.name} à ${provs[0].name}.`);
    } else if (kind === "province") {
      const others = room.provinces.filter(p => p.owner !== target.nation);
      const k = Math.min(others.length, n);
      for (let i = 0; i < k; i++) others[i].owner = target.nation;
      addLog(room, `[Triche] ${k} provinces transférées à ${target.name}.`);
      checkVictory(io, room);
    } else return socket.emit("errorMessage", "Commande inconnue.");
    broadcast(io, room);
  });

  socket.on("disconnect", () => {
    if (!room) return;
    const p = room.players.find(x => x.id === socket.id);
    if (p) { p.online = false; addLog(room, `${p.name} s'est déconnecté.`); broadcast(io, room); }
  });
});

setInterval(() => {
  for (const room of rooms.values()) {
    if (!room.started || room.over) continue;
    try {
    room.day++;
    for (const p of room.players) {
      const tres = room.treasury[p.id];
      if (!tres || p.nation === null) continue;
      for (const prov of nationProvinces(room, p.nation)) {
        for (const k of RESOURCE_TYPES) tres[k] += (prov.production[k] || 0) * HOURS_PER_DAY;
      }
    }
    for (const p of room.provinces) p.lastProduction = Date.now();
    for (const p of room.players) if (p.bot) botTurn(io, room, p);
    addLog(room, `— Jour ${room.day} : production et revenus versés (${HOURS_PER_DAY} h). —`);
    checkVictory(io, room);
    broadcast(io, room);
    } catch (e) { console.error("Erreur tick jour:", e); }
  }
}, DAY_MS);

server.listen(PORT, () => console.log("Supremacy World War lancé sur http://localhost:" + PORT));
