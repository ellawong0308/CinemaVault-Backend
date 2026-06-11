import Router from 'koa-router';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from './database';

const router = new Router({ prefix: '/api/v1/auth' });

// A secret key used to sign the JWT token (In production, keep this in .env file)
const JWT_SECRET = "CinemaVault_Super_Secret_Key_2026";

// ==========================================
// 1. POST: User Registration (Register)
// ==========================================
router.post('/register', async (ctx, next) => {
    const { username, password, role } = ctx.request.body as any;

    if (!username || !password) {
        ctx.status = 400;
        ctx.body = { error: "Username and password are required" };
        return;
    }

    try {
        // Check if the username already exists
        const userExists = await db('users').where({ username }).first();
        if (userExists) {
            ctx.status = 400;
            ctx.body = { error: "Username already exists" };
            return;
        }

        // Hash the password safely using bcrypt (Salt rounds = 10)
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user into the database
        await db('users').insert({
            username,
            password: hashedPassword,
            role: role || 'user' // Default to 'user' role if not specified
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
// 2. POST: User Login (Authenticate & issue JWT)
// ==========================================
router.post('/login', async (ctx, next) => {
    const { username, password } = ctx.request.body as any;

    if (!username || !password) {
        ctx.status = 400;
        ctx.body = { error: "Username and password are required" };
        return;
    }

    try {
        // Find user by username
        const user = await db('users').where({ username }).first();
        if (!user) {
            ctx.status = 401; // Unauthorized
            ctx.body = { error: "Invalid username or password" };
            return;
        }

        // Compare the submitted password with the hashed password in the database
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            ctx.status = 401;
            ctx.body = { error: "Invalid username or password" };
            return;
        }

        // Password is correct, generate a JWT token containing user info
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '2h' } // Token expires in 2 hours
        );

        ctx.body = {
            message: "Login successful",
            token: token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        };
    } catch (err) {
        ctx.status = 500;
        ctx.body = { error: "Database authentication error" };
    }
    await next();
});

export default router;