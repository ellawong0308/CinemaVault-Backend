import Router from 'koa-router';
import db from './database'; 
import { verifyAdmin } from './authMiddleware'; // 1. 引入管理員檢查哨
import jwt from 'jsonwebtoken'; // 🌟 核心新增：引入 JWT 用於普通會員最愛清單的驗證

const router = new Router({ prefix: '/api/v1/movies' });
const JWT_SECRET = "CinemaVault_Super_Secret_Key_2026"; // 確保與你登入模組的金鑰完全一致

// 🌟 核心新增：普通會員/管理員通用的 JWT 驗證哨兵
const localAuthenticateToken = async (ctx: any, next: any) => {
    const authHeader = ctx.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) { 
        ctx.status = 401; 
        ctx.body = { error: "Token missing. Please log in to use favorites." }; 
        return; 
    }
    try {
        const verified = jwt.verify(token, JWT_SECRET);
        ctx.state.user = verified; // 將解析出來的使用者資料暫存到狀態中
        await next();
    } catch (err) { 
        ctx.status = 403; 
        ctx.body = { error: "Invalid token session" }; 
    }
};

// ==========================================
// 1. GET: Fetch all movies (Public - No lock)
// ==========================================
router.get('/', async (ctx, next) => {
    try {
        const movies = await db('movies').select('*');
        ctx.body = movies;
    } catch (err) {
        ctx.status = 500;
        ctx.body = { error: "Failed to retrieve movies from database" };
    }
    await next();
});

// ==========================================
// 🌟 核心新增 2. GET: 獲取「當前登入用戶」的所有最愛電影清單 (🔒 僅需一般登入)
// 網址路徑會是: GET /api/v1/movies/favorites
// ==========================================
router.get('/favorites', localAuthenticateToken, async (ctx, next) => {
    const loggedInUser = ctx.state.user;

    try {
        // 使用 INNER JOIN 將 favorites 表與 movies 表進行多對多關聯查詢
        const favoriteMovies = await db('favorites')
            .join('movies', 'favorites.movie_id', '=', 'movies.id')
            .where('favorites.username', loggedInUser.username)
            .select('movies.*'); // 僅挑選電影的完整欄位資訊

        ctx.body = favoriteMovies;
    } catch (err: any) {
        ctx.status = 500;
        ctx.body = { error: "Failed to fetch your favorite movies list" };
    }
    await next();
});

// ==========================================
// 🌟 核心新增 3. POST: 切換收藏狀態 (加入或取消最愛) (🔒 僅需一般登入)
// 網址路徑會是: POST /api/v1/movies/favorite
// ==========================================
router.post('/favorite', localAuthenticateToken, async (ctx, next) => {
    const { movieId } = ctx.request.body as any;
    const loggedInUser = ctx.state.user;

    if (!movieId) {
        ctx.status = 400;
        ctx.body = { error: "Bad Request: movieId is required to toggle favorite status" };
        return;
    }

    try {
        // 檢查該用戶是否已經收藏過此電影
        const existing = await db('favorites')
            .where({ username: loggedInUser.username, movie_id: parseInt(movieId) })
            .first();

        if (existing) {
            // A. 如果已收藏，則將其從最愛清單中「無情刪除」 (Toggle Off)
            await db('favorites')
                .where({ username: loggedInUser.username, movie_id: parseInt(movieId) })
                .del();
            
            ctx.body = { message: "Removed from favorites successfully", isFavorite: false };
        } else {
            // B. 如果未收藏，則「送入資料庫」 (Toggle On)
            await db('favorites').insert({
                username: loggedInUser.username,
                movie_id: parseInt(movieId)
            });
            
            ctx.body = { message: "Added to favorites! ❤️", isFavorite: true };
        }
    } catch (err: any) {
        ctx.status = 500;
        ctx.body = { error: "Database operation on favorites failed" };
    }
    await next();
});

// ==========================================
// 4. GET: Fetch a single movie by ID (Public - No lock)
// ==========================================
router.get('/:id', async (ctx, next) => {
    const movieId = parseInt(ctx.params.id);
    try {
        const movie = await db('movies').where({ id: movieId }).first();
        if (movie) {
            ctx.body = movie;
        } else {
            ctx.status = 404;
            ctx.body = { error: "Movie not found" };
        }
    } catch (err) {
        ctx.status = 500;
        ctx.body = { error: "Database query error" };
    }
    await next();
});

// ==========================================
// 5. POST: Add a new movie (🔒 Protected - Admin Only)
// ==========================================
router.post('/', verifyAdmin, async (ctx, next) => {
    const { title, genre, year, director } = ctx.request.body as any;

    if (!title || !genre || !year) {
        ctx.status = 400;
        ctx.body = { error: "Bad Request: title, genre, and year are required fields" };
        return;
    }

    try {
        const [newId] = await db('movies').insert({
            title,
            genre,
            year: parseInt(year),
            director: director || 'Unknown'
        });

        const newMovie = await db('movies').where({ id: newId }).first();
        ctx.status = 201; 
        ctx.body = {
            message: "Movie added successfully by Admin",
            data: newMovie
        };
    } catch (err) {
        ctx.status = 500;
        ctx.body = { error: "Database insertion failed" };
    }
    await next();
});

// ==========================================
// 6. DELETE: Delete a specific movie (🔒 Protected - Admin Only)
// ==========================================
router.delete('/:id', verifyAdmin, async (ctx, next) => {
    const movieId = parseInt(ctx.params.id);

    try {
        const deletedRows = await db('movies').where({ id: movieId }).del();

        if (deletedRows > 0) {
            ctx.body = { message: `Movie with ID ${movieId} deleted successfully by Admin` };
        } else {
            ctx.status = 404;
            ctx.body = { error: "Movie not found, deletion failed" };
        }
    } catch (err) {
        ctx.status = 500;
        ctx.body = { error: "Database deletion failed" };
    }
    await next();
});

// ==========================================
// 7. PUT: Update a specific movie (🔒 Protected - Admin Only)
// ==========================================
router.put('/:id', verifyAdmin, async (ctx, next) => {
    const movieId = parseInt(ctx.params.id);
    const { title, genre, year, director } = ctx.request.body as any;

    try {
        const movieExists = await db('movies').where({ id: movieId }).first();
        if (!movieExists) {
            ctx.status = 404;
            ctx.body = { error: "Movie not found, update failed" };
            return;
        }

        await db('movies').where({ id: movieId }).update({
            title: title || movieExists.title,
            genre: genre || movieExists.genre,
            year: year ? parseInt(year) : movieExists.year,
            director: director || movieExists.director
        });

        const updatedMovie = await db('movies').where({ id: movieId }).first();
        ctx.body = {
            message: "Movie updated successfully by Admin",
            data: updatedMovie
        };
    } catch (err) {
        ctx.status = 500;
        ctx.body = { error: "Database update failed" };
    }
    await next();
});

export default router;