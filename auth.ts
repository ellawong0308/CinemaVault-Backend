import Router from 'koa-router';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from './database';
import { OAuth2Client } from 'google-auth-library'; // 引入 Google 驗證庫
import { JWT_SECRET } from './config';

const router = new Router({ prefix: '/api/v1/auth' });

// 🌟 核心安全性設定：請在這裡填入你在 Google API Console 申請到的真實 Client ID
const GOOGLE_CLIENT_ID = "479961485296-bc9qtqof14lj1jv3soqs07qqbqi46hoi.apps.googleusercontent.com";
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// ==========================================
// 1. POST: 原生使用者註冊
// ==========================================
router.post('/register', async (ctx, next) => {
    const { username, password } = ctx.request.body as any;
    if (!username || !password) {
        ctx.status = 400;
        ctx.body = { error: "Username and password are required" };
        return;
    }
    try {
        const userExists = await db('users').where({ username }).first();
        if (userExists) {
            ctx.status = 400;
            ctx.body = { error: "Username already exists" };
            return;
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await db('users').insert({
            username,
            password: hashedPassword,
            role: 'user' // 預設強制為普通用戶
        });
        ctx.status = 201;
        ctx.body = { message: "User registered successfully" };
    } catch (err) {
        ctx.status = 500;
        ctx.body = { error: "Database registration error" };
    }
    await next();
});

// ==========================================
// 2. POST: 原生帳密登入 (管理員與普通用戶通用)
// ==========================================
router.post('/login', async (ctx, next) => {
    const { username, password } = ctx.request.body as any;
    if (!username || !password) {
        ctx.status = 400;
        ctx.body = { error: "Username and password are required" };
        return;
    }
    try {
        const user = await db('users').where({ username }).first();
        if (!user) {
            ctx.status = 401;
            ctx.body = { error: "Invalid username or password" };
            return;
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            ctx.status = 401;
            ctx.body = { error: "Invalid username or password" };
            return;
        }
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '2h' }
        );
        ctx.body = {
            message: "Login successful",
            token: token,
            user: { id: user.id, username: user.username, role: user.role }
        };
    } catch (err) {
        ctx.status = 500;
        ctx.body = { error: "Database authentication error" };
    }
    await next();
});

// ==========================================
// 3. 🌟 實用功能 (Useful): Google OAuth 2.0 驗證路由
// ==========================================
router.post('/google-login', async (ctx, next) => {
    const { idToken } = ctx.request.body as any;

    if (!idToken) {
        ctx.status = 400;
        ctx.body = { error: "Google ID Token is required" };
        return;
    }

    try {
        // 向 Google 官方伺服器驗證前端傳過來的這張憑證
        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: GOOGLE_CLIENT_ID, // 確保發行目標與後端完全吻合
        });
        
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
            ctx.status = 400;
            ctx.body = { error: "Invalid Google Token Payload" };
            return;
        }

        const googleEmail = payload.email;

        // 檢查這個 Google 帳號是否已經存在於我們的 SQLite 資料庫中
        let user = await db('users').where({ username: googleEmail }).first();

        if (!user) {
            // 🛑 核心資安防線 (回應作業指引的要求)：
            // 凡是從 Google 登入進來的帳號，一律在資料庫強行注入 role: 'user'。
            // 絕對不給予任何管道讓其成為 admin，完美防止「權限提升漏洞」！
            const [newId] = await db('users').insert({
                username: googleEmail,
                password: 'OAUTH_EXTERNAL_ACCOUNT', // 外部帳號不設本地密碼
                role: 'user' // 🌟 安全防線：強制鎖定 user 權限
            });
            user = await db('users').where({ id: newId }).first();
        }

        // 驗證成功後，發放我們 CinemaVault 系統專屬的 JWT 安全通行證給前端
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '2h' }
        );

        ctx.body = {
            message: "Google Login successful",
            token: token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        };

    } catch (err) {
        ctx.status = 401;
        ctx.body = { error: "Google token verification failed" };
    }
    await next();
});

export default router;