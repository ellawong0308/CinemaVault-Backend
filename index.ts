import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import json from 'koa-json';
import logger from 'koa-logger';
import movieRouter from './movies';

const app = new Koa();
const router = new Router();

// 載入 Koa 中間件（Middleware）
app.use(logger());       // 在終端機印出精美的 Request 日誌
app.use(json());         // 讓 JSON 回傳格式更美觀
app.use(bodyParser());   // 自動解析前端傳來的 JSON Payload

// 建立一個最基礎的根路徑測試
router.get('/', async (ctx, next) => {
    ctx.body = { message: "Welcome to CinemaVault API Server！" };
    await next();
});

app.use(movieRouter.routes()).use(movieRouter.allowedMethods());
// 將路由註冊到 Koa 實例中
app.use(router.routes()).use(router.allowedMethods());

// 設定學校 Lab 指定的 404 安全防禦（必須放在所有路由的最尾端）
app.use(async (ctx, next) => {
    await next();
    if (ctx.status === 404) {
        ctx.status = 404;
        ctx.body = { err: "No such endpoint existed" };
    }
});

// 啟動伺服器，監聽 10888 連接埠
const PORT = 10888;
app.listen(PORT, () => {
    console.log(`🚀 The CinemaVault server has started successfully.！`);
    console.log(`🔗 Test local URL: http://localhost:${PORT}`);
});