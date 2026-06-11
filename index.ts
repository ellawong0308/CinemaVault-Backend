import Koa from 'koa';
import Router from 'koa-router';
import bodyParser from 'koa-bodyparser';
import json from 'koa-json';
import logger from 'koa-logger';
import './database'; // 1. 引入並直接觸發 SQLite 初始化
import movieRouter from './movies';

const app = new Koa();
const router = new Router();

app.use(logger());
app.use(json());
app.use(bodyParser());

// 根路由測試
router.get('/', async (ctx, next) => {
    ctx.body = { message: "Welcome to CinemaVault API Server！(SQLite archive database is now fully enabled)" };
    await next();
});

// 1. 先註冊根路由 (/)
app.use(router.routes()).use(router.allowedMethods());

// 註冊電影路由
app.use(movieRouter.routes()).use(movieRouter.allowedMethods());

// 404 安全防禦
app.use(async (ctx, next) => {
    await next();
    if (ctx.status === 404) {
        ctx.status = 404;
        ctx.body = { err: "No such endpoint existed" };
    }
});

const PORT = 10888;
app.listen(PORT, () => {
    console.log(`🚀 CinemaVault Started Successfully！`);
    console.log(`🔗 Test Local URL: http://localhost:${PORT}`);
});