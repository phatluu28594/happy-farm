# 🌻 Happy Farm Online

Game nông trại 2D hoạt hình dễ thương, chơi trên PC và điện thoại, có nhiều người chơi online.

## Có sẵn trong bản 1.0
- Nông trại cá nhân cho từng người; có thể thăm nông trại của người đang online.
- Bản đồ chung, avatar di chuyển, chat thế giới và bảng người chơi online.
- Trồng 5 loại cây, cây lớn theo thời gian, tưới cây và thu hoạch.
- Chuồng gà/bò/cừu/vịt, thu sản phẩm theo thời gian; nâng cấp chuồng.
- Ao cá, thả cá và nâng cấp ao.
- Cửa hàng NPC mua hạt giống, bán nông sản; chợ chung để người chơi đăng bán/mua hàng.
- Xu, XP, lên cấp, lưu trạng thái thế giới vào JSON.
- Giao diện responsive, hỗ trợ thao tác cảm ứng.

## Chạy trên máy tính
1. Cài Node.js 18 trở lên: https://nodejs.org/
2. Giải nén ZIP.
3. Mở Terminal/CMD trong thư mục dự án và chạy:
   ```bash
   npm install
   npm start
   ```
4. Mở http://localhost:3000

## Đưa game lên mạng
- Đẩy toàn bộ thư mục lên GitHub.
- Tạo Web Service trên Render (hoặc hosting Node.js hỗ trợ WebSocket).
- Build command: `npm install`
- Start command: `npm start`
- Nếu nền tảng hỗ trợ persistent disk, gắn disk và đặt biến môi trường `SAVE_FILE=/var/data/world.json`.
- Không dùng GitHub Pages để chạy game online: Pages chỉ host file tĩnh, không chạy máy chủ Socket.IO.

## Lưu ý quan trọng trước khi mở cho nhiều người chơi thật
Đây là bản MVP chơi được để thử nghiệm, chưa phải bản thương mại quy mô lớn. File JSON phù hợp thử nghiệm một instance; production nên chuyển dữ liệu sang PostgreSQL, dùng đăng nhập tài khoản, xác thực giao dịch/chống gian lận, giới hạn chat, kiểm duyệt nội dung, backup và kiểm thử tải. Nhiều instance cần Redis/adapter cho Socket.IO và cơ chế đồng bộ dữ liệu.

## Cấu trúc
- `server.js`: máy chủ, luật chơi, multiplayer, giao dịch và lưu dữ liệu.
- `public/index.html`: giao diện.
- `public/style.css`: đồ họa responsive.
- `public/game.js`: canvas 2D và tương tác.
