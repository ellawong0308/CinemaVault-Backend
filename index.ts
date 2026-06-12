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

const app = new Koa();

// 1. 啟用 CORS 跨來源連線
app.use(cors());

// 2. 基本基礎中間件
app.use(logger());
app.use(json());
app.use(bodyParser());

// 3. 🌟 啟用前端網頁託管 (Static Files Hosting)
// 直接定位到你的前端專案資料夾路徑
const frontendPath = "C:\\Users\\User\\OneDrive\\Desktop\\Shape\\Sem 2\\WebAPI\\CinemaVault-Frontend";
app.use(serve(frontendPath));

// 4. 設定後端路由 (APIs Routes)
const router = new Router();

// 根路由測試
router.get('/', async (ctx, next) => {
    ctx.body = { message: "Welcome to CinemaVault API Server！(SQLite archive database is now fully enabled)" };
    await next();
});

// 註冊根路由 (/)
app.use(router.routes()).use(router.allowedMethods());

// 註冊電影路由 (/api/v1/movies)
app.use(movieRouter.routes()).use(movieRouter.allowedMethods());

// 註冊認證路由 (/api/v1/auth/register & /api/v1/auth/login & /api/v1/auth/google-login)
app.use(authRouter.routes()).use(authRouter.allowedMethods());

// 5. 🛑 404 安全防禦攔截器 (必須放在最底部)
// 如果前面的 API 路由沒對到，且前端資料夾也找不到對應的檔案，才會觸發這裡
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
    console.log(`🎨 Hosted Frontend UI : http://localhost:${PORT}/index.html 🌟`);
});