import Router from 'koa-router';
import db from './database'; 
import { verifyAdmin } from './authMiddleware'; // 1. 引入剛剛做好的管理員檢查哨

const router = new Router({ prefix: '/api/v1/movies' });

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
// 2. GET: Fetch a single movie by ID (Public - No lock)
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
// 3. POST: Add a new movie (🔒 Protected - Admin Only)
// ==========================================
// 注意：我們在網址後面加入了 verifyAdmin，它會先執行安全檢查，通過才執行後面的 async 函數
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
// 4. DELETE: Delete a specific movie (🔒 Protected - Admin Only)
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
// 5. PUT: Update a specific movie (🔒 Protected - Admin Only)
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