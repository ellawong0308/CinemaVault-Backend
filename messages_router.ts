import Router from 'koa-router';
import db from './database';
import { verifyAdmin } from './authMiddleware';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './config';

const router = new Router({ prefix: '/api/v1/messages' });

// 中間件：普通會員驗證
const authenticateUser = async (ctx: any, next: any) => {
    const authHeader = ctx.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        ctx.status = 401;
        ctx.body = { error: "Token missing. Please log in to send messages." };
        return;
    }
    try {
        const verified = jwt.verify(token, JWT_SECRET);
        ctx.state.user = verified;
        await next();
    } catch (err) {
        ctx.status = 401;
        ctx.body = { error: "Invalid token session." };
    }
};

// ============================================================
// 1. POST: 普通會員發送留言給管理員 (🔒 需一般登入)
// 網址：POST /api/v1/messages
// ============================================================
router.post('/', authenticateUser, async (ctx) => {
    const { title, content } = ctx.request.body as any;
    const loggedInUser = ctx.state.user;

    if (!title || !content) {
        ctx.status = 400;
        ctx.body = { error: "Title and content are required." };
        return;
    }

    try {
        await db('messages').insert({
            username: loggedInUser.username,
            title,
            content
        });
        ctx.status = 201;
        ctx.body = { message: "Message sent to Admin successfully! ✉️" };
    } catch (err) {
        ctx.status = 500;
        ctx.body = { error: "Failed to save message to database." };
    }
});

// ============================================================
// 2. GET: 管理員讀取所有會員的信件 (🔒 管理員限定)
// 網址：GET /api/v1/messages
// ============================================================
router.get('/', verifyAdmin, async (ctx) => {
    try {
        const allMessages = await db('messages').orderBy('created_at', 'desc');
        ctx.body = allMessages;
    } catch (err) {
        ctx.status = 500;
        ctx.body = { error: "Failed to fetch messages." };
    }
});

// ============================================================
// 3. PUT: 管理員回覆信件 (🔒 管理員限定)
// 網址：PUT /api/v1/messages/:id/reply
// ============================================================
router.put('/:id/reply', verifyAdmin, async (ctx) => {
    const messageId = parseInt(ctx.params.id);
    const { reply } = ctx.request.body as any;

    if (!reply) {
        ctx.status = 400;
        ctx.body = { error: "Reply content cannot be empty." };
        return;
    }

    try {
        const updated = await db('messages')
            .where({ id: messageId })
            .update({ reply });

        if (updated > 0) {
            ctx.body = { message: "Reply submitted successfully!" };
        } else {
            ctx.status = 404;
            ctx.body = { error: "Message not found." };
        }
    } catch (err) {
        ctx.status = 500;
        ctx.body = { error: "Failed to update reply." };
    }
});

// ============================================================
// 4. DELETE: 管理員刪除信件 (🔒 管理員限定)
// 網址：DELETE /api/v1/messages/:id
// ============================================================
router.delete('/:id', verifyAdmin, async (ctx) => {
    const messageId = parseInt(ctx.params.id);

    try {
        const deleted = await db('messages').where({ id: messageId }).del();
        if (deleted > 0) {
            ctx.body = { message: "Message deleted successfully by Admin." };
        } else {
            ctx.status = 404;
            ctx.body = { error: "Message not found." };
        }
    } catch (err) {
        ctx.status = 500;
        ctx.body = { error: "Failed to delete message." };
    }
});

export default router;