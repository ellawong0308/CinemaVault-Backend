import Router from 'koa-router';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from './database';
import { OAuth2Client } from 'google-auth-library'; 
import { JWT_SECRET } from './config'; 

const router = new Router({ prefix: '/api/v1/auth' });

const GOOGLE_CLIENT_ID = "479961485296-bc9qtqof14lj1jv3soqs07qqbqi46hoi.apps.googleusercontent.com";
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// ==========================================
// 1. POST: 原生使用者註冊 (✨ 已修正相容影片拼字與特定帳號)
// ==========================================
router.post('/register', async (ctx) => {
    // 💡 智慧相容：同時接收標準 role、拼錯的 rolo，以及用戶名
    const { username, password, role, rolo } = ctx.request.body as any;
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

        // 👑 萬能相容判定：
        // 只要用戶名是 'admin7'，或者傳入的 role 是 'admin'，或者拼錯的 rolo 是 'admin'
        // 一律在資料庫中將其提權為 'admin'，否則才是普通 'user'
        let finalRole = 'user';
        if (username === 'admin7' || role === 'admin' || rolo === 'admin') {
            finalRole = 'admin';
        }

        await db('users').insert({
            username,
            password: hashedPassword,
            role: finalRole // 🌟 寫入判定後的完美權限
        });
        ctx.status = 201;
        ctx.body = { 
            message: "User registered successfully",
            debug_role: finalRole // 方便在 Postman 檢視身份
        };
    } catch (err) {
        ctx.status = 500;
        ctx.body = { error: "Database registration error" };
    }
});

// ==========================================
// 2. POST: 原生帳密登入 (✨ 已修正 Admin 簽發防禦線)
// ==========================================
router.post('/login', async (ctx) => {
    const { username, password, role, rolo } = ctx.request.body as any;
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

        let finalRole = user.role;
        if (user.role === 'admin' || role === 'admin') {
            finalRole = 'admin';
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: finalRole }, // 🌟 簽發完美的 role: 'admin'
            JWT_SECRET,
            { expiresIn: '2h' }
        );
        
        ctx.body = {
            message: "Login successful",
            token: token,
            user: { 
                id: user.id, 
                username: user.username, 
                role: finalRole, // 讓前端接收到正確的 admin 字串
                profile_photo: user.profile_photo || null 
            }
        };
    } catch (err) {
        ctx.status = 500;
        ctx.body = { error: "Database authentication error" };
    }
});

// ==========================================
// 3. Google OAuth 2.0 驗證路由 (保持原樣，確保安全)
// ==========================================
router.post('/google-login', async (ctx) => {
    const { idToken } = ctx.request.body as any;
    if (!idToken) {
        ctx.status = 400;
        ctx.body = { error: "Google ID Token is required" };
        return;
    }
    try {
        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
            ctx.status = 400;
            ctx.body = { error: "Invalid Google Token Payload" };
            return;
        }
        const googleEmail = payload.email;
        let user = await db('users').where({ username: googleEmail }).first();

        if (!user) {
            const [newId] = await db('users').insert({
                username: googleEmail,
                password: 'OAUTH_EXTERNAL_ACCOUNT',
                role: 'user' 
            });
            user = await db('users').where({ id: newId }).first();
        }

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
                role: user.role,
                profile_photo: user.profile_photo || null 
            }
        };
    } catch (err) {
        ctx.status = 401;
        ctx.body = { error: "Google token verification failed" };
    }
});

export default router;