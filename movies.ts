import Router from 'koa-router';
import db from './database'; // Import SQLite connection instance

const router = new Router({ prefix: '/api/v1/movies' });

// ==========================================
// 1. GET: Fetch all movies from database (Read All)
// ==========================================
router.get('/', async (ctx, next) => {
    try {
        const movies = await db('movies').select('*'); // SQL: SELECT * FROM movies;
        ctx.body = movies;
    } catch (err) {
        ctx.status = 500;
        ctx.body = { error: "Failed to retrieve movies from database" };
    }
    await next();
});

// ==========================================
// 2. GET: Fetch a single movie by ID (Read One)
// ==========================================
router.get('/:id', async (ctx, next) => {
    const movieId = parseInt(ctx.params.id);
    try {
        const movie = await db('movies').where({ id: movieId }).first(); // SQL: SELECT * FROM movies WHERE id = movieId LIMIT 1;
        
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
// 3. POST: Add a new movie to database (Create)
// ==========================================
router.post('/', async (ctx, next) => {
    // Extract data from the request body
    const { title, genre, year, director } = ctx.request.body as any;

    // Validation check for required fields
    if (!title || !genre || !year) {
        ctx.status = 400;
        ctx.body = { error: "Bad Request: title, genre, and year are required fields" };
        return;
    }

    try {
        // Insert into database, SQLite returns the new ID in an array
        const [newId] = await db('movies').insert({
            title,
            genre,
            year: parseInt(year),
            director: director || 'Unknown'
        });

        // Fetch the newly created movie record to return to the client
        const newMovie = await db('movies').where({ id: newId }).first();
        
        ctx.status = 201; // 201 Created
        ctx.body = {
            message: "Movie added successfully",
            data: newMovie
        };
    } catch (err) {
        ctx.status = 500;
        ctx.body = { error: "Database insertion failed" };
    }
    await next();
});

// ==========================================
// 4. DELETE: Delete a specific movie by ID (Delete)
// ==========================================
router.delete('/:id', async (ctx, next) => {
    const movieId = parseInt(ctx.params.id);

    try {
        // Execute delete query, returns the number of affected rows
        const deletedRows = await db('movies').where({ id: movieId }).del();

        if (deletedRows > 0) {
            ctx.body = { message: `Movie with ID ${movieId} deleted successfully` };
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
// 5. PUT: Update a specific movie by ID (Update)
// ==========================================
router.put('/:id', async (ctx, next) => {
    const movieId = parseInt(ctx.params.id);
    const { title, genre, year, director } = ctx.request.body as any;

    try {
        // Check if the movie exists first
        const movieExists = await db('movies').where({ id: movieId }).first();
        if (!movieExists) {
            ctx.status = 404;
            ctx.body = { error: "Movie not found, update failed" };
            return;
        }

        // Execute update query, fallback to current data if fields are empty
        await db('movies').where({ id: movieId }).update({
            title: title || movieExists.title,
            genre: genre || movieExists.genre,
            year: year ? parseInt(year) : movieExists.year,
            director: director || movieExists.director
        });

        // Fetch the updated movie record
        const updatedMovie = await db('movies').where({ id: movieId }).first();

        ctx.body = {
            message: "Movie updated successfully",
            data: updatedMovie
        };
    } catch (err) {
        ctx.status = 500;
        ctx.body = { error: "Database update failed" };
    }
    await next();
});

export default router;