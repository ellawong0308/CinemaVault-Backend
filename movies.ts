import Router from 'koa-router';
import db from './database'; 
import { verifyAdmin } from './authMiddleware'; 
import jwt from 'jsonwebtoken'; 
import { JWT_SECRET } from './config'; // 🌟 統一改用 config 引入

const router = new Router({ prefix: '/api/v1/movies' });

// ============================================================
// 中間件：普通會員/管理員通用的 JWT 驗證哨兵 (精準攔截，不往下外洩)
// ============================================================
const localAuthenticateToken = async (ctx: any, next: any) => {
    const authHeader = ctx.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) { 
        ctx.status = 401; 
        ctx.body = { error: "Token missing. Please log in to use favorites." }; 
        return; // 🛑 阻斷，不往下走
    }
    try {
        const verified = jwt.verify(token, JWT_SECRET);
        ctx.state.user = verified; 
        await next(); // 驗證成功，放行進入特定的路由處理器
    } catch (err) { 
        ctx.status = 401; 
        ctx.body = { error: "Invalid or expired token session, please re-login." }; 
        return; // 🛑 阻斷，拒絕偽 404 產生
    }
};

// ============================================================
// 1. GET: Fetch all movies (Public)
// ============================================================
router.get('/', async (ctx) => {
    try {
        const movies = await db('movies').select('*');
        ctx.body = movies;
    } catch (err) {
        ctx.status = 500;
        ctx.body = { error: "Failed to retrieve movies from database" };
    }
});

// ============================================================
// 2. GET: 獲取最愛電影清單 (🔒 必須在 /:id 上方！)
// ============================================================
router.get('/favorites', localAuthenticateToken, async (ctx) => {
    console.log("💚 [Debug] Successfully hit /favorites endpoint with valid JWT!");
    const loggedInUser = ctx.state.user;

    try {
        const favoriteMovies = await db('favorites')
            .join('movies', 'favorites.movie_id', '=', 'movies.id')
            .where('favorites.username', loggedInUser.username)
            .select('movies.*');

        ctx.body = favoriteMovies;
    } catch (err) {
        ctx.status = 500;
        ctx.body = { error: "Failed to fetch your favorite movies list" };
    }
});

// ============================================================
// 3. POST: 切換收藏狀態 (🔒 必須在 /:id 上方！)
// ============================================================
router.post('/favorite', localAuthenticateToken, async (ctx) => {
    const { movieId } = ctx.request.body as any;
    const loggedInUser = ctx.state.user;

    if (!movieId) {
        ctx.status = 400;
        ctx.body = { error: "movieId is required" };
        return;
    }

    try {
        const existing = await db('favorites')
            .where({ username: loggedInUser.username, movie_id: parseInt(movieId) })
            .first();

        if (existing) {
            await db('favorites')
                .where({ username: loggedInUser.username, movie_id: parseInt(movieId) })
                .del();
            ctx.body = { message: "Removed from favorites", isFavorite: false };
        } else {
            await db('favorites').insert({
                username: loggedInUser.username,
                movie_id: parseInt(movieId)
            });
            ctx.body = { message: "Added to favorites! ❤️", isFavorite: true };
        }
    } catch (err) {
        ctx.status = 500;
        ctx.body = { error: "Database operation failed" };
    }
});

// ============================================================
// 4. GET: Fetch a single movie by ID
// ============================================================
router.get('/:id', async (ctx) => {
    const movieId = parseInt(ctx.params.id);
    if (isNaN(movieId)) {
        ctx.status = 400;
        ctx.body = { error: "Invalid movie ID format" };
        return;
    }
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
});

// ============================================================
// 5. POST: Add a new movie (🔒 Protected - Admin Only)
// 網址：POST /api/v1/movies
// ============================================================
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

// ============================================================
// 6. DELETE: Delete a specific movie (🔒 Protected - Admin Only)
// 網址：DELETE /api/v1/movies/:id
// ============================================================
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

// ============================================================
// 7. PUT: Update a specific movie (🔒 Protected - Admin Only)
// 網址：PUT /api/v1/movies/:id
// ============================================================
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