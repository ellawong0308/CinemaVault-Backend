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

    // === 2. 新增：建立 users 資料表 ===
    const hasUsersTable = await db.schema.hasTable('users');
    if (!hasUsersTable) {
        await db.schema.createTable('users', (table) => {
            table.increments('id').primary();
            table.string('username').notNullable().unique(); // 帳號（例如學號或信箱，必須唯一）
            table.string('password').notNullable();          // 加密後的密碼
            table.string('role').defaultTo('user');          // 角色權限：預設普通用戶 'user'，管理員為 'admin'
            table.timestamp('createdAt').defaultTo(db.fn.now());
        });
        console.log("👥 SQLite: users table created successfully.");
    } else {
        console.log("📊 SQLite: All tables verified and ready.");
    }
}

initDatabase().catch(err => console.error("❌ SQLite Initialization Failed:", err));

export default db;