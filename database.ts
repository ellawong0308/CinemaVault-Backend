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
    // === 1. 升級後的 movies 資料表建立邏輯 (回歸純粹的骨架定義) ===
    const hasMoviesTable = await db.schema.hasTable('movies');
    if (!hasMoviesTable) {
        await db.schema.createTable('movies', (table) => {
            table.increments('id').primary();
            table.string('title').notNullable();
            table.string('genre').notNullable();
            table.integer('year').notNullable();
            table.string('director').defaultTo('Unknown');
            
            // 🌟 核心擴充欄位定義
            table.text('poster').defaultTo(null);   
            table.text('actors').defaultTo('N/A');  
            table.text('plot').defaultTo('No description available.'); 
            
            table.timestamp('createdAt').defaultTo(db.fn.now());
        });
        console.log("📊 SQLite: movies table SCHEMA created successfully.");
    } else {
        // 💡 安全熱補丁防護
        const extendedColumns = ['poster', 'actors', 'plot'];
        for (const col of extendedColumns) {
            const hasColumn = await db.schema.hasColumn('movies', col);
            if (!hasColumn) {
                await db.schema.alterTable('movies', (table) => {
                    if (col === 'poster') table.text('poster').defaultTo(null);
                    if (col === 'actors') table.text('actors').defaultTo('N/A');
                    if (col === 'plot') table.text('plot').defaultTo('No description available.');
                });
                console.log(`🔄 SQLite: Successfully patched missing OMDb field '${col}' to existing movies table.`);
            }
        }
    }

    // === 2. 建立 users 資料表 ===
    const hasUsersTable = await db.schema.hasTable('users');
    if (!hasUsersTable) {
        await db.schema.createTable('users', (table) => {
            table.increments('id').primary();
            table.string('username').notNullable().unique();
            table.string('password').notNullable();          
            table.string('role').defaultTo('user');          
            table.string('profile_photo').defaultTo('');     
            table.timestamp('createdAt').defaultTo(db.fn.now());
        });
        console.log("👥 SQLite: users table created successfully.");
    } else {
        const hasPhotoColumn = await db.schema.hasColumn('users', 'profile_photo');
        if (!hasPhotoColumn) {
            await db.schema.alterTable('users', (table) => {
                table.string('profile_photo').defaultTo('');
            });
            console.log("🔄 SQLite: Added 'profile_photo' column to users.");
        }
    }

    // === 3. 最愛電影中間表 (Favorites Table) ===
    const hasFavoritesTable = await db.schema.hasTable('favorites');
    if (!hasFavoritesTable) {
        await db.schema.createTable('favorites', (table) => {
            table.string('username').notNullable();
            table.integer('movie_id').notNullable();
            table.timestamp('createdAt').defaultTo(db.fn.now());
            table.primary(['username', 'movie_id']);
        });
        console.log("❤️ SQLite: favorites table created successfully.");
    }

    // === 4. 建立 messages 客服留言資料表 ===
    const hasMessagesTable = await db.schema.hasTable('messages');
    if (!hasMessagesTable) {
        await db.schema.createTable('messages', (table) => {
            table.increments('id').primary();
            table.string('username').notNullable(); 
            table.text('title').notNullable();    
            table.text('content').notNullable();  
            table.text('reply').defaultTo(null);  
            table.timestamp('created_at').defaultTo(db.fn.now());
        });
        console.log('✉️ SQLite: messages table created successfully.');
    }

    console.log("📊 SQLite: All tables verified and ready.");
}

initDatabase().catch(err => console.error("❌ SQLite Initialization Failed:", err));

export default db;