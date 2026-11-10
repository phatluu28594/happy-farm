const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 3000;
const SAVE_FILE = process.env.SAVE_FILE || path.join(__dirname, "data", "world.json");
app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_, res) => res.json({ ok: true, game: "Happy Farm Online" }));

const W = 10, H = 8;
const cropDefs = {
  carrot: { name: "Cà rốt", seed: 8, sell: 22, grow: 45, emoji: "🥕", color: "#f59b45" },
  wheat: { name: "Lúa mì", seed: 5, sell: 14, grow: 30, emoji: "🌾", color: "#e8c75a" },
  corn: { name: "Bắp", seed: 14, sell: 38, grow: 75, emoji: "🌽", color: "#f4c542" },
  tomato: { name: "Cà chua", seed: 18, sell: 48, grow: 95, emoji: "🍅", color: "#ef6661" },
  watermelon: { name: "Dưa hấu", seed: 30, sell: 85, grow: 150, emoji: "🍉", color: "#5bbd72" }
};
const animalDefs = {
  chicken: { name: "Gà", price: 120, product: "egg", productName: "Trứng", every: 90, sell: 28, emoji: "🐔" },
  cow: { name: "Bò", price: 320, product: "milk", productName: "Sữa", every: 150, sell: 55, emoji: "🐮" },
  sheep: { name: "Cừu", price: 260, product: "wool", productName: "Len", every: 180, sell: 48, emoji: "🐑" },
  duck: { name: "Vịt", price: 180, product: "duckEgg", productName: "Trứng vịt", every: 110, sell: 35, emoji: "🦆" }
};
const fishDefs = {
  goldfish: { name: "Cá vàng", price: 45, sell: 18, every: 120, emoji: "🐠" },
  koi: { name: "Cá koi", price: 110, sell: 48, every: 180, emoji: "🐟" },
  bluefish: { name: "Cá xanh", price: 75, sell: 30, every: 150, emoji: "🐟" }
};
let world = { players: {}, market: [], feed: [], version: 1 };
const sockets = new Map();

function newFarm() {
  return {
    plots: Array.from({ length: H }, () => Array.from({ length: W }, () => null)),
    animals: [], fish: [], coins: 500, inventory: { carrot: 3, wheat: 4, corn: 0, tomato: 0, watermelon: 0, egg: 0, milk: 0, wool: 0, duckEgg: 0 },
    pondLevel: 1, barnLevel: 1, level: 1, xp: 0, name: "Nông trại vui vẻ", createdAt: Date.now()
  };
}
function safeName(s) { return String(s || "Nông dân").replace(/[<>]/g, "").trim().slice(0, 18) || "Nông dân"; }
function publicPlayer(p) {
  return { id: p.id, name: p.name, farmName: p.farm.farmName || p.farm.name, x: p.x, y: p.y, outfit: p.outfit, online: p.online, level: p.farm.level };
}
function ensurePlayer(id, name) {
  if (!world.players[id]) {
    world.players[id] = { id, name, farm: newFarm(), x: 4, y: 4, outfit: Math.floor(Math.random()*5), online: false };
    addFeed(`${name} vừa gia nhập Happy Farm!`);
  } else world.players[id].name = name;
  return world.players[id];
}
function addFeed(message) {
  world.feed.unshift({ id: Date.now() + Math.random(), message, at: Date.now() });
  world.feed = world.feed.slice(0, 20);
}
function save() {
  try {
    fs.mkdirSync(path.dirname(SAVE_FILE), { recursive: true });
    fs.writeFileSync(SAVE_FILE, JSON.stringify(world));
  } catch (e) { console.error("Save failed:", e.message); }
}
function load() {
  try { if (fs.existsSync(SAVE_FILE)) world = { ...world, ...JSON.parse(fs.readFileSync(SAVE_FILE, "utf8")) }; }
  catch (e) { console.error("Load failed:", e.message); }
}
function snapshot() {
  return {
    players: Object.values(world.players).filter(p => p.online).map(publicPlayer),
    market: world.market.slice(-30).reverse(),
    feed: world.feed,
    crops: cropDefs, animals: animalDefs, fishDefs
  };
}
function sendFarm(socket, ownerId) {
  const p = world.players[ownerId];
  if (!p) return;
  socket.emit("farm:data", { owner: publicPlayer(p), farm: p.farm, isMine: socket.data.playerId === ownerId, cropDefs, animalDefs, fishDefs });
}
function broadcast() { io.emit("world:update", snapshot()); }
function gainXp(p, amount) {
  p.farm.xp += amount;
  while (p.farm.xp >= p.farm.level * 100) {
    p.farm.xp -= p.farm.level * 100; p.farm.level++;
    p.farm.coins += 100;
    addFeed(`${p.name} lên cấp ${p.farm.level} và nhận 100 xu!`);
  }
}
function actionError(socket, message) { socket.emit("notice", { type: "error", message }); }
function getMine(socket) { return world.players[socket.data.playerId]; }
function ownFarm(socket) {
  const p = getMine(socket);
  if (!p) return null;
  if (socket.data.viewing && socket.data.viewing !== p.id) { actionError(socket, "Bạn đang tham quan nông trại. Hãy quay về nông trại của mình nhé!"); return null; }
  return p;
}
function pay(p, amount) {
  if (p.farm.coins < amount) return false;
  p.farm.coins -= amount; return true;
}
function marketItem(item) {
  const p = world.players[item.sellerId];
  return { id: item.id, seller: p ? p.name : "Nông dân", item: item.item, itemName: item.itemName, qty: item.qty, price: item.price, createdAt: item.createdAt };
}

io.on("connection", socket => {
  socket.on("join", ({ name }) => {
    const playerId = socket.handshake.auth.playerId || socket.id;
    socket.data.playerId = playerId;
    socket.data.viewing = playerId;
    const p = ensurePlayer(playerId, safeName(name));
    p.online = true; sockets.set(playerId, socket.id);
    socket.emit("welcome", { playerId, player: publicPlayer(p), world: snapshot() });
    sendFarm(socket, playerId); broadcast();
  });
  socket.on("move", ({ x, y }) => {
    const p = getMine(socket); if (!p || socket.data.viewing !== p.id) return;
    p.x = Math.max(0, Math.min(9, Math.round(Number(x)||0)));
    p.y = Math.max(0, Math.min(7, Math.round(Number(y)||0)));
    broadcast();
  });
  socket.on("visit", ({ id }) => {
    const target = world.players[id];
    if (!target || !target.online) return actionError(socket, "Nông trại này hiện không có chủ online.");
    socket.data.viewing = id; sendFarm(socket, id);
  });
  socket.on("home", () => { socket.data.viewing = socket.data.playerId; sendFarm(socket, socket.data.playerId); });
  socket.on("plant", ({ x, y, crop }) => {
    const p = ownFarm(socket); if (!p) return;
    const def = cropDefs[crop], plot = p.farm.plots?.[y]?.[x];
    if (!def || !plot && plot !== null) return;
    if (plot) return actionError(socket, "Ô đất này đã có cây.");
    if ((p.farm.inventory[crop] || 0) < 1) return actionError(socket, "Bạn không còn hạt giống này.");
    p.farm.inventory[crop]--; p.farm.plots[y][x] = { crop, plantedAt: Date.now(), watered: false };
    gainXp(p, 3); sendFarm(socket, p.id);
  });
  socket.on("buySeed", ({ crop, qty = 1 }) => {
    const p = ownFarm(socket); if (!p) return;
    const def = cropDefs[crop]; qty = Math.max(1, Math.min(20, Math.floor(qty)));
    if (!def || !pay(p, def.seed * qty)) return actionError(socket, "Không đủ xu hoặc hạt giống không hợp lệ.");
    p.farm.inventory[crop] = (p.farm.inventory[crop] || 0) + qty; sendFarm(socket, p.id);
  });
  socket.on("harvest", ({ x, y }) => {
    const p = ownFarm(socket); if (!p) return;
    const plot = p.farm.plots?.[y]?.[x]; if (!plot) return actionError(socket, "Ô đất đang trống.");
    const def = cropDefs[plot.crop];
    if (Date.now() - plot.plantedAt < def.grow * 1000) return actionError(socket, "Cây chưa lớn, hãy chờ thêm nhé!");
    p.farm.inventory[plot.crop] = (p.farm.inventory[plot.crop] || 0) + 1;
    p.farm.plots[y][x] = null; gainXp(p, 12); sendFarm(socket, p.id);
    socket.emit("notice", { type: "success", message: `Thu hoạch ${def.name} thành công!` });
  });
  socket.on("water", ({ x, y }) => {
    const p = ownFarm(socket); if (!p) return;
    const plot = p.farm.plots?.[y]?.[x]; if (!plot) return actionError(socket, "Ô đất chưa trồng cây.");
    if (plot.watered) return actionError(socket, "Cây đã được tưới hôm nay rồi.");
    plot.watered = true; plot.plantedAt -= 10000; gainXp(p, 2); sendFarm(socket, p.id);
  });
  socket.on("buyAnimal", ({ animal }) => {
    const p = ownFarm(socket); if (!p) return;
    const def = animalDefs[animal]; if (!def || p.farm.animals.length >= p.farm.barnLevel * 4) return actionError(socket, "Chuồng đã đầy hoặc vật nuôi không hợp lệ.");
    if (!pay(p, def.price)) return actionError(socket, "Bạn không đủ xu.");
    p.farm.animals.push({ type: animal, lastProduct: Date.now() }); gainXp(p, 5); sendFarm(socket, p.id);
  });
  socket.on("collectAnimal", ({ index }) => {
    const p = ownFarm(socket); if (!p) return;
    const a = p.farm.animals[index], def = a && animalDefs[a.type]; if (!def) return;
    if (Date.now() - a.lastProduct < def.every * 1000) return actionError(socket, "Vật nuôi chưa tạo ra sản phẩm.");
    p.farm.inventory[def.product] = (p.farm.inventory[def.product] || 0) + 1;
    a.lastProduct = Date.now(); gainXp(p, 6); sendFarm(socket, p.id);
  });
  socket.on("buyFish", ({ fish }) => {
    const p = ownFarm(socket); if (!p) return;
    const def = fishDefs[fish]; if (!def || p.farm.fish.length >= p.farm.pondLevel * 5) return actionError(socket, "Ao cá đã đầy hoặc loài cá không hợp lệ.");
    if (!pay(p, def.price)) return actionError(socket, "Bạn không đủ xu.");
    p.farm.fish.push({ type: fish, addedAt: Date.now() }); gainXp(p, 3); sendFarm(socket, p.id);
  });
  socket.on("upgrade", ({ kind }) => {
    const p = ownFarm(socket); if (!p) return;
    const cost = kind === "pond" ? p.farm.pondLevel * 250 : kind === "barn" ? p.farm.barnLevel * 300 : 0;
    if (!cost || !pay(p, cost)) return actionError(socket, "Không đủ xu hoặc hạng mục không hợp lệ.");
    if (kind === "pond") p.farm.pondLevel++; else p.farm.barnLevel++;
    sendFarm(socket, p.id);
  });
  socket.on("sellNpc", ({ item, qty = 1 }) => {
    const p = ownFarm(socket); if (!p) return;
    const def = cropDefs[item] || Object.values(animalDefs).find(a => a.product === item);
    const qtyN = Math.max(1, Math.min(99, Math.floor(qty)));
    const price = cropDefs[item]?.sell || def?.sell;
    if (!price || (p.farm.inventory[item] || 0) < qtyN) return actionError(socket, "Không đủ sản phẩm để bán.");
    p.farm.inventory[item] -= qtyN; p.farm.coins += price * qtyN; gainXp(p, qtyN * 2); sendFarm(socket, p.id);
  });
  socket.on("listMarket", ({ item, qty = 1, price }) => {
    const p = ownFarm(socket); if (!p) return;
    const qtyN = Math.max(1, Math.min(50, Math.floor(qty))), priceN = Math.max(1, Math.min(10000, Math.floor(price)));
    const def = cropDefs[item] || Object.values(animalDefs).find(a => a.product === item);
    if (!def || (p.farm.inventory[item] || 0) < qtyN) return actionError(socket, "Không đủ hàng hoặc mặt hàng không hợp lệ.");
    p.farm.inventory[item] -= qtyN;
    world.market.push({ id: `${Date.now()}-${Math.random()}`, sellerId: p.id, item, itemName: cropDefs[item]?.name || def.productName, qty: qtyN, price: priceN, createdAt: Date.now() });
    world.market = world.market.slice(-100); broadcast(); sendFarm(socket, p.id);
  });
  socket.on("buyMarket", ({ id }) => {
    const p = ownFarm(socket); if (!p) return;
    const i = world.market.findIndex(x => x.id === id);
    if (i < 0) return actionError(socket, "Tin đăng không còn tồn tại.");
    const listing = world.market[i]; if (listing.sellerId === p.id) return actionError(socket, "Bạn không thể mua hàng của chính mình.");
    if (!pay(p, listing.price)) return actionError(socket, "Bạn không đủ xu.");
    p.farm.inventory[listing.item] = (p.farm.inventory[listing.item] || 0) + listing.qty;
    const seller = world.players[listing.sellerId]; if (seller) seller.farm.coins += listing.price;
    world.market.splice(i, 1); gainXp(p, 4); sendFarm(socket, p.id);
    const sellerSocket = sockets.get(listing.sellerId); if (sellerSocket) { const s = io.sockets.sockets.get(sellerSocket); if (s) sendFarm(s, listing.sellerId); }
    broadcast();
  });
  socket.on("chat", ({ message }) => {
    const p = getMine(socket), msg = String(message || "").trim().slice(0, 180);
    if (!p || !msg) return;
    io.emit("chat:message", { name: p.name, message: msg, at: Date.now() });
  });
  socket.on("disconnect", () => {
    const id = socket.data.playerId, p = id && world.players[id];
    if (p && sockets.get(id) === socket.id) { p.online = false; sockets.delete(id); addFeed(`${p.name} đã rời nông trại.`); broadcast(); }
  });
});

load();
setInterval(() => {
  // Gentle passive progression: animal goods are produced on demand; persist the shared world.
  save();
}, 15000);
server.listen(PORT, () => console.log(`Happy Farm Online running on ${PORT}`));
process.on("SIGTERM", () => { save(); process.exit(0); });
process.on("SIGINT", () => { save(); process.exit(0); });
