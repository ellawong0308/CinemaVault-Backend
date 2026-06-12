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
            table.string('profile_photo').defaultTo('');     // 儲存個人頭像圖片的網址路徑
            table.timestamp('createdAt').defaultTo(db.fn.now());
        });
        console.log("👥 SQLite: users table created successfully with profile_photo.");
    } else {
        // 💡 安全防護：如果 users 資料表本來就存在，檢查裡面有沒有 profile_photo 欄位
        const hasPhotoColumn = await db.schema.hasColumn('users', 'profile_photo');
        if (!hasPhotoColumn) {
            await db.schema.alterTable('users', (table) => {
                table.string('profile_photo').defaultTo('');
            });
            console.log("🔄 SQLite: Successfully added 'profile_photo' column to existing users table.");
        }
    }

    // === 3. 🌟 核心全新建立：最愛電影中間表 (Favorites Table) ===
    const hasFavoritesTable = await db.schema.hasTable('favorites');
    if (!hasFavoritesTable) {
        await db.schema.createTable('favorites', (table) => {
            // 記錄是哪個用戶收藏的 (對應 users 表的 username)
            table.string('username').notNullable();
            
            // 記錄收藏了哪部電影 (對應 movies 表的 id)
            table.integer('movie_id').notNullable();
            
            // 記錄收藏時間
            table.timestamp('createdAt').defaultTo(db.fn.now());

            // 🛑 設定複合主鍵 (Composite Primary Key)
            // 確保同一個用戶不能重複收藏同一部電影，從資料庫底層鎖死防禦！
            table.primary(['username', 'movie_id']);
        });
        console.log("❤️ SQLite: favorites table created successfully for member system.");
    }

    db.schema.hasTable('messages').then((exists) => {
        if (!exists) {
            return db.schema.createTable('messages', (table) => {
                table.increments('id').primary();
                table.string('username').notNullable(); // 發送信件的會員
                table.text('title').notNullable();    // 主旨
                table.text('content').notNullable();  // 內容
                table.text('reply').defaultTo(null);  // 管理員的回覆內容（預設為空）
                table.timestamp('created_at').defaultTo(db.fn.now());
            }).then(() => {
                console.log('✉️ SQLite: messages table created successfully for contact system.');
            });
        }
    });

    // 提示所有檢查皆已通過
    console.log("📊 SQLite: All tables verified and ready.");
}

initDatabase().catch(err => console.error("❌ SQLite Initialization Failed:", err));

export default db;