// CinemaVault-Backend/social.ts
import { Context } from 'koa';

export interface SocialPost {
    platform: string;
    message: string;
    timestamp: string;
}

// 在記憶體中維護管理員的虛擬社群媒體動態牆
private let virtualSocialFeed: SocialPost[] = [];

/**
 * 核心廣播服務：當新電影被上架 (Live) 時，自動呼叫此函數同步到社群平台
 * @param title 電影名稱
 * @param year 上映年份
 * @param director 導演
 */
export function broadcastNewMovieToSocialMedia(title: string, year: number, director: string): void {
    const tweetMessage = `📢 [CinemaVault Update] A new movie "${title}" (${year}) directed by ${director || 'Unknown'} is now LIVE! Check it out now! 🍿🎬 #Cinema #NewMovie`;
    
    // 將最新動態推播到陣列的最前方 (最新發布)
    virtualSocialFeed.unshift({
        platform: "Twitter / Facebook Admin Feed",
        message: tweetMessage,
        timestamp: new Date().toLocaleString()
    });

    // 在後端控制台印出 Log 方便測試與檢查
    console.log(`📱 [Social Media Sync Webhook] Successfully posted to Admin Feed: ${tweetMessage}`);
}

/**
 * 獲取目前所有的虛擬社群貼文
 */
export function getSocialFeed(): SocialPost[] {
    return virtualSocialFeed;
}