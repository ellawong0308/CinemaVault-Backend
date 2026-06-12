import knex from 'knex';
import path from 'path';

const db = knex({
    client: 'sqlite3',
    connection: {
        filename: path.join(__dirname, 'cinema.db'),
    },
    useNullAsDefault: true,
});

async function initDatabase() {
    // === 1. 原本的 movies 資料表建立邏輯 (保持不變) ===
    const hasMoviesTable = await db.schema.hasTable('movies');
    if (!hasMoviesTable) {
        await db.schema.createTable('movies', (table) => {
            table.increments('id').primary();
            table.string('title').notNullable();
            table.string('genre').notNullable();
            table.integer('year').notNullable();
            table.string('director').defaultTo('Unknown');
            table.timestamp('createdAt').defaultTo(db.fn.now());
        });
        await db('movies').insert([
            { title: "Inception (全面啟動)", genre: "Sci-Fi", year: 2010, director: "Christopher Nolan" },
            { title: "The Dark Knight (黑暗騎士)", genre: "Action", year: 2008, director: "Christopher Nolan" },
            { title: "Interstellar (星際效應)", genre: "Sci-Fi", year: 2014, director: "Christopher Nolan" }
        ]);
        console.log("📊 SQLite: movies table created successfully.");
    }

    // === 2. 建立 users 資料表（整合個人頭像欄位）===
    const hasUsersTable = await db.schema.hasTable('users');
    if (!hasUsersTable) {
        await db.schema.createTable('users', (table) => {
            table.increments('id').primary();
            table.string('username').notNullable().unique(); // 帳號
            table.string('password').notNullable();          // 加密後的密碼
            table.string('role').defaultTo('user');          // 角色權限：'user' 或 'admin'
            table.string('profile_photo').defaultTo('');     // 🌟 核心新增：儲存個人頭像圖片的網址路徑
            table.timestamp('createdAt').defaultTo(db.fn.now());
        });
        console.log("👥 SQLite: users table created successfully with profile_photo.");
    } else {
        // 💡 安全防護：如果 users 資料表本來就存在，檢查裡面有沒有 profile_photo 欄位
        const hasPhotoColumn = await db.schema.hasColumn('users', 'profile_photo');
        if (!hasPhotoColumn) {
            // 如果舊的資料表沒有這個欄位，立刻動態補上，免去刪除資料庫的麻煩
            await db.schema.alterTable('users', (table) => {
                table.string('profile_photo').defaultTo('');
            });
            console.log("🔄 SQLite: Successfully added 'profile_photo' column to existing users table.");
        }
        console.log("📊 SQLite: All tables verified and ready.");
    }
}

initDatabase().catch(err => console.error("❌ SQLite Initialization Failed:", err));

export default db;