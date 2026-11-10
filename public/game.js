const socket = io({ auth: { playerId: localStorage.getItem("hfo-player") || "" } });
const $ = id => document.getElementById(id);
let me = null, farm = null, farmOwner = null, world = null, tab = "farm", selectedCrop = "carrot", selectedTile = null;
let chat = [];
const canvas = $("farm"), ctx = canvas.getContext("2d");
const TILE = 76, OX = 70, OY = 30;
const crops = {
 carrot:{name:"Cà rốt",emoji:"🥕",seed:8,sell:22,grow:45}, wheat:{name:"Lúa mì",emoji:"🌾",seed:5,sell:14,grow:30},
 corn:{name:"Bắp",emoji:"🌽",seed:14,sell:38,grow:75}, tomato:{name:"Cà chua",emoji:"🍅",seed:18,sell:48,grow:95},
 watermelon:{name:"Dưa hấu",emoji:"🍉",seed:30,sell:85,grow:150}
};
const animals = {chicken:{name:"Gà",emoji:"🐔",price:120,product:"Trứng",every:90},cow:{name:"Bò",emoji:"🐮",price:320,product:"Sữa",every:150},sheep:{name:"Cừu",emoji:"🐑",price:260,product:"Len",every:180},duck:{name:"Vịt",emoji:"🦆",price:180,product:"Trứng vịt",every:110}};
const fish = {goldfish:{name:"Cá vàng",emoji:"🐠",price:45},koi:{name:"Cá koi",emoji:"🐟",price:110},bluefish:{name:"Cá xanh",emoji:"🐟",price:75}};
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove("show"),2400)}
socket.on("connect",()=>{});
socket.on("welcome",d=>{me=d.player;localStorage.setItem("hfo-player",d.playerId);world=d.world;renderWorld();});
socket.on("farm:data",d=>{farm=d.farm;farmOwner=d.owner; $("coins").textContent=farm.coins;$("level").textContent=farm.level;$("farm-title").textContent=farm.name;$("owner-label").textContent=d.isMine?"Nông trại của bạn":`Đang thăm ${d.owner.name}`;$("home-btn").classList.toggle("hidden",d.isMine);$("player-name").textContent=me?.name||d.owner.name;$("farm-level").textContent=`Cấp ${farm.level} · ${farm.xp} XP`;$("xp-bar").style.width=Math.min(100,farm.xp/(farm.level*100)*100)+"%";draw();renderPanel();});
socket.on("world:update",d=>{world=d;renderWorld();});
socket.on("notice",d=>toast(d.message));
socket.on("chat:message",m=>{chat.push(m);chat=chat.slice(-50);renderChat();});
$("join-btn").onclick=()=>{const name=$("name-input").value.trim()||"Nông dân";socket.emit("join",{name});$("join-modal").classList.add("hidden");};
socket.on("connect",()=>{if(localStorage.getItem("hfo-player")){socket.emit("join",{name:localStorage.getItem("hfo-name")||"Nông dân"});$("join-modal").classList.add("hidden");}});
$("name-input").addEventListener("change",e=>localStorage.setItem("hfo-name",e.target.value));
$("home-btn").onclick=()=>socket.emit("home");
function renderWorld(){if(!world)return;$("online").textContent=world.players.length;$("players").innerHTML=world.players.map(p=>`<div class="player"><span>🧑‍🌾 ${esc(p.name)} <small>Lv.${p.level}</small></span>${p.id===me?.id?"<b>Đây là bạn</b>":`<button data-visit="${p.id}">Thăm</button>`}</div>`).join("")||"Chưa có ai online";$("feed").innerHTML=world.feed.map(f=>`<div class="feed-line">${esc(f.message)}</div>`).join("");document.querySelectorAll("[data-visit]").forEach(b=>b.onclick=()=>socket.emit("visit",{id:b.dataset.visit}));}
function renderChat(){$("chat-log").innerHTML=chat.map(m=>`<div class="chat-line"><b>${esc(m.name)}:</b> ${esc(m.message)}</div>`).join("");$("chat-log").scrollTop=$("chat-log").scrollHeight;}
$("chat-form").onsubmit=e=>{e.preventDefault();const v=$("chat-input").value.trim();if(v)socket.emit("chat",{message:v});$("chat-input").value="";};
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
document.querySelectorAll(".tool").forEach(b=>b.onclick=()=>{tab=b.dataset.tab;document.querySelectorAll(".tool").forEach(x=>x.classList.toggle("active",x===b));renderPanel();});
function button(label,action,disabled=false){return `<button data-action="${action}" ${disabled?"disabled":""}>${label}</button>`;}
function bindActions(){document.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>{const [a,v]=b.dataset.action.split(":");if(a==="seed")socket.emit("buySeed",{crop:v,qty:1});if(a==="select")selectedCrop=v;if(a==="plant"&&selectedTile)socket.emit("plant",{...selectedTile,crop:selectedCrop});if(a==="animal")socket.emit("buyAnimal",{animal:v});if(a==="fish")socket.emit("buyFish",{fish:v});if(a==="pond"||a==="barn")socket.emit("upgrade",{kind:a});if(a==="sell")socket.emit("sellNpc",{item:v,qty:1});if(a==="water"&&selectedTile)socket.emit("water",selectedTile);if(a==="market")listMarket(v);if(a==="buy-market")socket.emit("buyMarket",{id:v});if(a==="harvest"&&selectedTile)socket.emit("harvest",selectedTile);});}
function renderPanel(){if(!farm)return;let html="";
if(tab==="farm"){html=`<div class="panel-title">🌱 Hạt giống & kho nông sản</div><div class="items">${Object.entries(crops).map(([k,c])=>`<div class="item"><b>${c.emoji} ${c.name}</b><small>Hạt giống ${c.seed} xu · Bán ${c.sell} xu</small>${button("Chọn trồng",`select:${k}`,!farm.inventory[k])}${button("Mua 1 hạt",`seed:${k}`,farm.coins<c.seed)}</div>`).join("")}</div><p class="hint">Chọn hạt giống, sau đó chạm một ô đất trống. Chạm cây đã lớn để thu hoạch.</p><div class="items">${inventoryHtml()}</div>`;}
if(tab==="animals"){html=`<div class="panel-title">🐮 Chuồng trại · ${farm.animals.length}/${farm.barnLevel*4} chỗ</div><div class="items">${Object.entries(animals).map(([k,a])=>`<div class="item"><b>${a.emoji} ${a.name}</b><small>${a.product} · ${a.price} xu</small>${button("Mua vật nuôi",`animal:${k}`,farm.coins<a.price||farm.animals.length>=farm.barnLevel*4)}</div>`).join("")}</div><div class="items">${farm.animals.map((a,i)=>{const d=animals[a.type],ready=Date.now()-a.lastProduct>=d.every*1000;return `<div class="item"><b>${d.emoji} ${d.name}</b><small>${ready?"Đã có sản phẩm!":"Đang tạo "+d.product}</small><button data-collect="${i}" ${ready?"":"disabled"}>Thu ${d.product}</button></div>`}).join("")}</div><p>🪵 Nâng cấp chuồng: cấp ${farm.barnLevel} · ${farm.barnLevel*300} xu ${button("Nâng cấp","barn",farm.coins<farm.barnLevel*300)}</p>`;}
if(tab==="pond"){html=`<div class="panel-title">🐠 Ao cá · ${farm.fish.length}/${farm.pondLevel*5} cá</div><div class="items">${Object.entries(fish).map(([k,f])=>`<div class="item"><b>${f.emoji} ${f.name}</b><small>${f.price} xu</small>${button("Thả cá",`fish:${k}`,farm.coins<f.price||farm.fish.length>=farm.pondLevel*5)}</div>`).join("")}</div><div class="items">${farm.fish.map(f=>`<div class="item"><b>${fish[f.type].emoji} ${fish[f.type].name}</b><small>Đang bơi tung tăng</small></div>`).join("")}</div><p>💧 Nâng cấp ao: cấp ${farm.pondLevel} · ${farm.pondLevel*250} xu ${button("Nâng cấp","pond",farm.coins<farm.pondLevel*250)}</p>`;}
if(tab==="shop"){html=`<div class="panel-title">🛒 Cửa hàng của bác Nông Dân</div><p>Mua hạt giống, vật nuôi và cá ở các mục tương ứng. Bán nông sản trực tiếp cho cửa hàng để nhận xu.</p><div class="items">${inventoryHtml(true)}</div>`;}
if(tab==="market"){html=`<div class="panel-title">🤝 Chợ nông sản toàn thế giới</div><p>Đăng bán sản phẩm từ kho hoặc mua hàng do người chơi khác đăng.</p><div class="items">${world?.market?.map(m=>`<div class="item"><b>📦 ${esc(m.itemName)} ×${m.qty}</b><small>${esc(m.seller)} · ${m.price} xu</small>${button("Mua hàng","buy-market:"+m.id,farm.coins<m.price)}</div>`).join("")||"<p>Chưa có tin đăng nào.</p>"}</div><div class="items">${inventoryHtml(false,true)}</div>`;}
$("action-panel").innerHTML=html;bindActions();document.querySelectorAll("[data-collect]").forEach(b=>b.onclick=()=>socket.emit("collectAnimal",{index:Number(b.dataset.collect)}));}
function inventoryHtml(canSell=false,canList=false){const names={...Object.fromEntries(Object.entries(crops).map(([k,v])=>[k,v.name])),egg:"Trứng",milk:"Sữa",wool:"Len",duckEgg:"Trứng vịt"};return Object.entries(farm.inventory).filter(([k,v])=>v>0).map(([k,v])=>`<div class="item"><b>📦 ${names[k]||k} ×${v}</b>${canSell?button("Bán 1","sell:"+k):""}${canList?button("Đăng bán 1","market:"+k):""}</div>`).join("")||"<p>Kho đang trống.</p>";}
function listMarket(item){const price=prompt("Nhập giá bán (xu):","30");if(price!==null)socket.emit("listMarket",{item,qty:1,price:Number(price)});}
function roundedRect(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function draw(){if(!farm)return;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle="#bce7a7";ctx.fillRect(0,0,900,620);
 // decorative lawn
 for(let i=0;i<55;i++){let x=(i*137)%890,y=(i*83)%610;ctx.fillStyle=i%2?"#a9dc98":"#c8edb3";ctx.beginPath();ctx.arc(x,y,2,0,Math.PI*2);ctx.fill();}
 // paths and plot grid
 for(let y=0;y<8;y++)for(let x=0;x<10;x++){let px=OX+x*TILE,py=OY+y*TILE;roundedRect(px,py,TILE-5,TILE-5,10,"#9b704c");roundedRect(px+4,py+4,TILE-13,TILE-13,8,"#a97d55");const p=farm.plots[y][x];if(p){let def=crops[p.crop],age=(Date.now()-p.plantedAt)/1000,progress=Math.min(1,age/def.grow);ctx.font="30px serif";ctx.textAlign="center";ctx.fillText(progress>=1?def.emoji:progress>.5?"🌿":"🌱",px+34,py+48);if(progress>=1){ctx.fillStyle="#fff";ctx.font="10px Nunito";ctx.fillText("THU HOẠCH",px+34,py+62);}}else{ctx.fillStyle="#d0a477";ctx.beginPath();ctx.arc(px+34,py+35,3,0,6.28);ctx.fill();}}
 // farmhouse and pond
 roundedRect(10,40,48,130,12,"#83c98b");ctx.font="35px serif";ctx.fillText("🏡",33,95);
 roundedRect(800,45,82,112,18,"#70c5d5");ctx.font="29px serif";ctx.fillText("🐟",840,105);ctx.font="11px Nunito";ctx.fillStyle="#fff";ctx.fillText("AO CÁ",840,140);
 // animal yard
 roundedRect(790,390,100,180,16,"#e8d39c");ctx.font="26px serif";farm.animals.slice(0,6).forEach((a,i)=>ctx.fillText(animals[a.type].emoji,810+(i%2)*43,430+Math.floor(i/2)*42));
 // fish in pond
 farm.fish.slice(0,6).forEach((f,i)=>{ctx.font="17px serif";ctx.fillText(fish[f.type].emoji,815+(i%3)*22,75+Math.floor(i/3)*28);});
 // avatar
 if(farmOwner){ctx.font="34px serif";ctx.fillText("🧑‍🌾",OX+Math.max(0,Math.min(9,farmOwner.x))*TILE+30,OY+Math.max(0,Math.min(7,farmOwner.y))*TILE+37);}
 // frame
 ctx.strokeStyle="#f7e8bd";ctx.lineWidth=5;ctx.strokeRect(2,2,896,616);
}
canvas.addEventListener("click",e=>{if(!farm||$("home-btn").classList.contains("hidden")===false)return;const r=canvas.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)*canvas.width/r.width),y=Math.floor((e.clientY-r.top)*canvas.height/r.height);const tx=Math.floor((x-OX)/TILE),ty=Math.floor((y-OY)/TILE);if(tx<0||tx>=10||ty<0||ty>=8)return;selectedTile={x:tx,y:ty};const plot=farm.plots[ty][tx];if(plot){const ready=Date.now()-plot.plantedAt>=crops[plot.crop].grow*1000;if(ready)socket.emit("harvest",selectedTile);else socket.emit("water",selectedTile);}else socket.emit("plant",{...selectedTile,crop:selectedCrop});});
function move(dx,dy){if(!farmOwner)return;socket.emit("move",{x:farmOwner.x+dx,y:farmOwner.y+dy});}
document.querySelectorAll("[data-move]").forEach(b=>b.onclick=()=>{const m=b.dataset.move;move(m==="left"?-1:m==="right"?1:0,m==="up"?-1:m==="down"?1:0);});
document.addEventListener("keydown",e=>{if(["w","a","s","d","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)){const k=e.key.toLowerCase();move(k==="a"||k==="arrowleft"?-1:k==="d"||k==="arrowright"?1:0,k==="w"||k==="arrowup"?-1:k==="s"||k==="arrowdown"?1:0);}});
setInterval(()=>{if(farm)draw();},1000);
