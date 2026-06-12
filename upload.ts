import Router from 'koa-router';
import multer from '@koa/multer';
import path from 'path';
import fs from 'fs';
import db from './database';
import jwt from 'jsonwebtoken';

// 🌟 注意：這裡把前綴清空，交給 index.ts 統一管理，確保網址絕對不會錯位！
const router = new Router(); 
const JWT_SECRET = "CinemaVault_Super_Secret_Key_2026";

const uploadFolder = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadFolder)) {
    fs.mkdirSync(uploadFolder, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, uploadFolder); },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `avatar-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const isMatch = allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype);
        if (isMatch) { cb(null, true); } else { cb(new Error('Only images allowed!'), false); }
    }
});

const localAuthenticateToken = async (ctx: any, next: any) => {
    const authHeader = ctx.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) { ctx.status = 401; ctx.body = { error: "Token missing" }; return; }
    try {
        const verified = jwt.verify(token, JWT_SECRET);
        ctx.state.user = verified;
        await next();
    } catch (err) { ctx.status = 403; ctx.body = { error: "Invalid token" }; }
};

// 🌟 核心 API 網址：明確指定完整路徑
router.post('/api/v1/user/profile-photo', localAuthenticateToken, async (ctx: any, next) => {
    try {
        await upload.single('avatar')(ctx, async () => {});
        const file = ctx.file || ctx.request.file;
        
        if (!file) {
            ctx.status = 400;
            ctx.body = { error: "No file uploaded" };
            return;
        }

        const loggedInUser = ctx.state.user;
        const photoUrl = `/uploads/${file.filename}`;

        await db('users')
            .where({ username: loggedInUser.username })
            .update({ profile_photo: photoUrl });

        ctx.body = {
            message: "Profile photo uploaded successfully! 📷",
            photoUrl: photoUrl
        };
    } catch (err: any) {
        ctx.status = 400;
        ctx.body = { error: err.message || "File upload failed" };
    }
    await next();
});

export default router;