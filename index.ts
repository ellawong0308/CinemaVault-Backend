import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import json from 'koa-json';
import logger from 'koa-logger';
import cors from '@koa/cors';
import serve from 'koa-static'; // 引入靜態資源託管套件
import path from 'path';        // 引入 Node.js 內建的路徑處理模組
import './database';            // 1. 引入並直接觸發 SQLite 初始化
import movieRouter from './movies';
import authRouter from './auth';   // 引入 Auth 路由
import uploadRouter from './upload'; // 引入上傳路由

const app = new Koa();

// 1. 啟用 CORS 跨來源連線
app.use(cors());

// 2. 基本基礎中間件 (必須最先執行)
app.use(logger());
app.use(json());
app.use(bodyParser());


// ============================================================
// 3. 🌟 優先權核心修正：將所有「後端 API 路由」推到最上方執行！
// ============================================================
const router = new Router();

// 根路由測試
router.get('/', async (ctx, next) => {
    ctx.body = { message: "Welcome to CinemaVault API Server！(SQLite archive database is now fully enabled)" };
    await next();
});

// A. 註冊根路由 (/)
app.use(router.routes()).use(router.allowedMethods());

// B. 註冊電影路由 (/api/v1/movies) -> 這樣 /favorites 才能第一時間被命中！
app.use(movieRouter.routes()).use(movieRouter.allowedMethods());

// C. 註冊認證路由 (/api/v1/auth/...)
app.use(authRouter.routes()).use(authRouter.allowedMethods());

// D. 註冊上傳路由
app.use(uploadRouter.routes()).use(uploadRouter.allowedMethods());


// ============================================================
// 4. 🌟 靜態資源託管區 (當路由全部比對不到時，才由這裡接手)
// ============================================================

// 開放伺服器本地的大頭貼 uploads 資料夾 (例如: http://localhost:10888/uploads/xxx.jpg)
app.use(serve(path.join(__dirname, '../'))); 

// 託管舊的前端靜態網頁檔案 (降級防禦線)
const frontendPath = "C:\\Users\\User\\OneDrive\\Desktop\\Shape\\Sem 2\\WebAPI\\CinemaVault-Frontend";
app.use(serve(frontendPath));


// ============================================================
// 5. 🛑 404 安全防禦攔截器 (必須放在最最最底部)
// ============================================================
app.use(async (ctx, next) => {
    await next();
    if (ctx.status === 404 && !ctx.body) {
        ctx.status = 404;
        ctx.body = { err: "No such endpoint existed" };
    }
});

const PORT = 10888;
app.listen(PORT, () => {
    console.log(`🚀 CinemaVault Started Successfully！`);
    console.log(`🔗 Backend API Server: http://localhost:${PORT}`);
    console.log(`🎨 Hosted Frontend UI : http://localhost:5173 🌟`);
});