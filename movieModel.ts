import { Schema, model } from 'mongoose';

// 1. 定閱電影資料的 TypeScript 介面 (Interface)
interface IMovie {
    title: string;
    genre: string;
    year: number;
    director: string;
    createdAt: Date;
}

// 2. 建立 Mongoose 的 Schema (對應 MongoDB 內的欄位規則)
const movieSchema = new Schema<IMovie>({
    title: { type: String, required: true },     // 電影名稱（必填）
    genre: { type: String, required: true },     // 類型（必填）
    year: { type: Number, required: true },      // 年份（必填）
    director: { type: String, default: "Unknown" }, // 導演（選填，預設未知）
    createdAt: { type: Date, default: Date.now } // 建立時間（自動生成）
});

// 3. 匯出 Model，供其他路由檔案調用
const Movie = model<IMovie>('Movie', movieSchema);
export default Movie;