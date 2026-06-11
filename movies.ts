import Router from 'koa-router';
import db from './database'; // 引入 SQLite 連線實例

const router = new Router({ prefix: '/api/v1/movies' });

// 1. GET: 從 SQLite 資料庫撈取所有電影列表
router.get('/', async (ctx, next) => {
    try {
        const movies = await db('movies').select('*'); // 等同於 SQL: SELECT * FROM movies;
        ctx.body = movies;
    } catch (err) {
        ctx.status = 500;
        ctx.body = { err: "Cannot Read Database Movie Data" };
    }
    await next();
});

// 2. GET: 根據 ID 從 SQLite 撈取單一電影
router.get('/:id', async (ctx, next) => {
    const movieId = parseInt(ctx.params.id);
    try {
        const movie = await db('movies').where({ id: movieId }).first(); // 等同於 SELECT * FROM movies WHERE id = movieId LIMIT 1;
        
        if (movie) {
            ctx.body = movie;
        } else {
            ctx.status = 404;
            ctx.body = { err: "Movie not found" };
        }
    } catch (err) {
        ctx.status = 500;
        ctx.body = { err: "Database Query Error" };
    }
    await next();
});

export default router;