import knex from 'knex';
import path from 'path';

// 初始化 SQLite 資料庫，將檔案存放在專案根目錄的 cinema.db
const db = knex({
    client: 'sqlite3',
    connection: {
        filename: path.join(__dirname, 'cinema.db'),
    },
    useNullAsDefault: true, // SQLite 必填設定
});

// 自動初始化：如果資料表不存在，就自動建立它（方便交作業）
async function initDatabase() {
    const hasTable = await db.schema.hasTable('movies');
    if (!hasTable) {
        await db.schema.createTable('movies', (table) => {
            table.increments('id').primary(); // 自動遞增的主鍵 ID
            table.string('title').notNullable();
            table.string('genre').notNullable();
            table.integer('year').notNullable();
            table.string('director').defaultTo('Unknown');
            table.timestamp('createdAt').defaultTo(db.fn.now());
        });
        
        // 順便幫你塞入 3 筆初始測試資料
        await db('movies').insert([
            { title: "Inception (全面啟動)", genre: "Sci-Fi", year: 2010, director: "Christopher Nolan" },
            { title: "The Dark Knight (黑暗騎士)", genre: "Action", year: 2008, director: "Christopher Nolan" },
            { title: "Interstellar (星際效應)", genre: "Sci-Fi", year: 2014, director: "Christopher Nolan" }
        ]);
        console.log("📊 SQLite: movies 資料表建立成功，並已塞入初始電影資料！");
    } else {
        console.log("📊 SQLite: movies 資料表已存在，隨時可以讀寫。");
    }
}

initDatabase().catch(err => console.error("❌ SQLite 初始化失敗:", err));

export default db;