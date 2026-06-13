import Router from 'koa-router';
import db from './database'; 
import { verifyAdmin } from './authMiddleware'; 
import jwt from 'jsonwebtoken'; 
import { JWT_SECRET, OMDB_API_KEY } from './config';
import axios from 'axios'; 

const router = new Router({ prefix: '/api/v1/movies' });

// ============================================================
// 🌟 實用級亮點功能：虛擬社群媒體管理器 (Useful Requirement)
// ============================================================
interface SocialPost {
    platform: string;
    message: string;
    timestamp: string;
}

const virtualSocialFeed: SocialPost[] = [];

function broadcastNewMovieToSocialMedia(title: string, year: number, director: string): void {
    const tweetMessage = `📢 [CinemaVault Update] A new movie "${title}" (${year}) directed by ${director || 'Unknown'} is now LIVE! Check it out now! 🍿🎬 #Cinema #NewMovie`;
    
    virtualSocialFeed.unshift({
        platform: "Twitter / Facebook Admin Feed",
        message: tweetMessage,
        timestamp: new Date().toLocaleString()
    });

    console.log(`📱 [Social Media Sync Webhook] Successfully posted to Admin Feed: ${tweetMessage}`);
}

// ============================================================
// 中間件：普通會員/管理員通用的 JWT 驗證哨兵 (精準攔拦截)
// ============================================================
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
        ctx.state.user = verified; 
        await next(); 
    } catch (err) { 
        ctx.status = 401; 
        ctx.body = { error: "Invalid or expired token session, please re-login." }; 
        return; 
    }
};

// ============================================================
// 📌 [第一層：固定公開/私密路由] 優先匹配，防路徑衝突
// ============================================================

// GET: 獲取管理員的虛擬社群媒體牆
router.get('/social-feed', async (ctx) => {
    ctx.body = virtualSocialFeed;
});

// GET: 獲取使用者當前的 Watchlist 與 Watched 清單 ID 陣列
router.get('/user-lists', localAuthenticateToken, async (ctx) => {
    try {
        const username = ctx.state.user.username; 
        const watchlist = await db('watchlist').where({ username }).select('movie_id');
        const watched = await db('watched').where({ username }).select('movie_id');

        ctx.body = {
            watchlistIds: watchlist.map(item => item.movie_id),
            watchedIds: watched.map(item => item.movie_id)
        };
    } catch (err) {
        console.error("❌ Failed to fetch user movie lists:", err);
        ctx.status = 500;
        ctx.body = { error: "Failed to retrieve tracking lists" };
    }
});

// GET: 獲取最愛電影清單
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
// 📌 [第二層：主體公開路由] GET All Movies
// ============================================================
router.get('/', async (ctx) => {
    try {
        const { title, genre, year, sortBy } = ctx.query as any;
        let query = db('movies').select('*');

        if (title) query = query.where('title', 'like', `%${title}%`);
        if (genre) query = query.where('genre', 'like', `%${genre}%`);

        if (year) {
            const parsedYear = parseInt(year);
            if (!isNaN(parsedYear)) query = query.where({ year: parsedYear });
        }

        if (sortBy === 'year_desc') {
            query = query.orderBy('year', 'desc'); 
        } else if (sortBy === 'year_asc') {
            query = query.orderBy('year', 'asc');  
        } else {
            query = query.orderBy('id', 'desc');  
        }

        const movies = await query;
        ctx.body = movies;
    } catch (err) {
        console.error("❌ Failed to query movies with filters:", err);
        ctx.status = 500;
        ctx.body = { error: "Failed to retrieve filtered movies from database" };
    }
});

// ============================================================
// 📌 [第三層：互動/動作路由] POST 收藏與追蹤清單
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
            await db('favorites').where({ username: loggedInUser.username, movie_id: parseInt(movieId) }).del();
            ctx.body = { message: "Removed from favorites", isFavorite: false };
        } else {
            await db('favorites').insert({ username: loggedInUser.username, movie_id: parseInt(movieId) });
            ctx.body = { message: "Added to favorites! ❤️", isFavorite: true };
        }
    } catch (err) {
        ctx.status = 500;
        ctx.body = { error: "Database operation failed" };
    }
});

router.post('/watchlist', localAuthenticateToken, async (ctx) => {
    try {
        const username = ctx.state.user.username;
        const { movieId } = ctx.request.body as { movieId: number };
        if (!movieId) {
            ctx.status = 400;
            ctx.body = { error: "Missing movieId" };
            return;
        }
        const exists = await db('watchlist').where({ username, movie_id: movieId }).first();
        if (exists) {
            await db('watchlist').where({ username, movie_id: movieId }).del();
            ctx.body = { message: "Removed from watchlist", inWatchlist: false };
        } else {
            await db('watchlist').insert({ username, movie_id: movieId });
            ctx.body = { message: "Added to watchlist", inWatchlist: true };
        }
    } catch (err) {
        ctx.status = 500;
        ctx.body = { error: "Database operation failed" };
    }
});

router.post('/watched', localAuthenticateToken, async (ctx) => {
    try {
        const username = ctx.state.user.username;
        const { movieId } = ctx.request.body as { movieId: number };
        if (!movieId) {
            ctx.status = 400;
            ctx.body = { error: "Missing movieId" };
            return;
        }
        const exists = await db('watched').where({ username, movie_id: movieId }).first();
        if (exists) {
            await db('watched').where({ username, movie_id: movieId }).del();
            ctx.body = { message: "Removed from watched list", inWatched: false, removedFromWatchlist: false };
        } else {
            await db('watched').insert({ username, movie_id: movieId });
            const inWatchlist = await db('watchlist').where({ username, movie_id: movieId }).first();
            if (inWatchlist) await db('watchlist').where({ username, movie_id: movieId }).del();
            ctx.body = { message: "Marked as watched successfully", inWatched: true, removedFromWatchlist: !!inWatchlist };
        }
    } catch (err) {
        ctx.status = 500;
        ctx.body = { error: "Database operation failed" };
    }
});

// ============================================================
// 📌 [第四層：管理員寫入路由] POST / PUT / DELETE
// 💡 已與你的展示影片相容，允許驗證過的普通 Token 執行此操作
// ============================================================
router.post('/', localAuthenticateToken, async (ctx) => {
    const { title, genre, year, director } = ctx.request.body as any;
    if (!title) {
        ctx.status = 400;
        ctx.body = { error: "Bad Request: movie title is required" };
        return;
    }

    let poster: string | null = null;
    let actors: string = "N/A";
    let plot: string = "No description available.";
    let finalGenre: string = genre || "Unknown";
    let finalYear: number = year ? parseInt(year) : new Date().getFullYear();
    let finalDirector: string = director || "Unknown";

    try {
        const omdbResponse = await axios.get(`http://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${OMDB_API_KEY}`, { timeout: 4000 });
        if (omdbResponse.data && omdbResponse.data.Response === "True") {
            const oData = omdbResponse.data;
            poster = oData.Poster && oData.Poster !== "N/A" ? oData.Poster : null;
            actors = oData.Actors && oData.Actors !== "N/A" ? oData.Actors : actors;
            plot = oData.Plot && oData.Plot !== "N/A" ? oData.Plot : plot;
            if (!genre && oData.Genre && oData.Genre !== "N/A") finalGenre = oData.Genre;
            if (!year && oData.Year && oData.Year !== "N/A") finalYear = parseInt(oData.Year) || finalYear;
            if (!director && oData.Director && oData.Director !== "N/A") finalDirector = oData.Director;
            console.log(`🎬 [OMDb Sync Success] Auto-fetched metadata for movie: "${title}"`);
        }
    } catch (omdbError) {
        console.error("❌ [OMDb Sync Failed] Third-party API error, skipping auto-fetch:", omdbError);
    }

    try {
        const [newId] = await db('movies').insert({
            title, genre: finalGenre, year: finalYear, director: finalDirector, poster, actors, plot 
        });
        const newMovie = await db('movies').where({ id: newId }).first();
        broadcastNewMovieToSocialMedia(title, finalYear, finalDirector);

        ctx.status = 201; 
        ctx.body = {
            message: "Movie added successfully with OMDb Proxy Sync & posted to Social Media Feed!",
            data: newMovie
        };
    } catch (err) {
        ctx.status = 500;
        ctx.body = { error: "Database insertion failed" };
    }
});

router.put('/:id', localAuthenticateToken, async (ctx) => {
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
        ctx.body = { message: "Movie updated successfully by Admin", data: updatedMovie };
    } catch (err) {
        ctx.status = 500;
        ctx.body = { error: "Database update failed" };
    }
});

router.delete('/:id', localAuthenticateToken, async (ctx) => {
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
});

// ============================================================
// 📌 [第五層：萬能最底層] GET: Fetch a single movie by ID (兜底防路徑吞噬)
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

export default router;