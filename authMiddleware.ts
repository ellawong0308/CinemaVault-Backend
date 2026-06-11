import { Context, Next } from 'koa';
import jwt from 'jsonwebtoken';

// Must match the secret key used in auth.ts
const JWT_SECRET = "CinemaVault_Super_Secret_Key_2026";

interface JwtPayload {
    id: number;
    username: string;
    role: string;
}

// ========================================================
// Middleware to verify if the user is a logged-in Admin
// ========================================================
export async function verifyAdmin(ctx: Context, next: Next) {
    try {
        // 1. Get the token from the HTTP Authorization Header
        // Standard format: "Bearer <token>"
        const authHeader = ctx.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            ctx.status = 401; // Unauthorized
            ctx.body = { error: "Access denied. No token provided." };
            return;
        }

        // 2. Extract the actual token string
        const token = authHeader.split(' ')[1];

        // 3. Verify and decode the token
        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

        // 4. Role-based Access Control (RBAC): Check if user is an admin
        if (decoded.role !== 'admin') {
            ctx.status = 403; // Forbidden
            ctx.body = { error: "Access denied. Admin role required." };
            return;
        }

        // 5. Token is valid and user is admin! Attach user info to context state for future use
        ctx.state.user = decoded;
        
        // Pass control to the next route handler
        await next();

    } catch (err) {
        // If token verification fails (expired or modified)
        ctx.status = 401;
        ctx.body = { error: "Invalid or expired token." };
    }
}