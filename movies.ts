import Router from 'koa-router';

const router = new Router({ prefix: '/api/v1/movies' }); // 設定 API 版本前綴

// 模擬大作業的硬編碼電影資料庫（Hard-coded Array）
const mockMovies = [
    { id: 1, title: "Inception (全面啟動)", genre: "Sci-Fi", year: 2010 },
    { id: 2, title: "The Dark Knight (黑暗騎士)", genre: "Action", year: 2008 },
    { id: 3, title: "Interstellar (星際效應)", genre: "Sci-Fi", year: 2014 }
];

// 1. GET: 取得所有電影列表 (http://localhost:10888/api/v1/movies)
router.get('/', async (ctx, next) => {
    ctx.body = mockMovies;
    await next();
});

// 2. GET: 根據 ID 取得單一電影詳細資料 (例如: http://localhost:10888/api/v1/movies/1)
router.get('/:id', async (ctx, next) => {
    const movieId = parseInt(ctx.params.id);
    const movie = mockMovies.find(m => m.id === movieId);

    if (movie) {
        ctx.body = movie;
    } else {
        ctx.status = 404;
        ctx.body = { err: "Movie not found" };
    }
    await next();
});

export default router;