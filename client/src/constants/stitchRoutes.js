/**
 * Maps Stitch AI HTML sources (repo root) → React routes for UI verification.
 * No network calls; all screens use mock data from `./mockData.js` or inline placeholders.
 */
export const STITCH_HTML_ROUTE_MAP = Object.freeze({
  'login.html': '/login',
  'signUp.html': '/register',
  'dashboard.html': '/dashboard',
  'report_lost_item.html': '/report',
  'ai_match_results.html': '/matches',
  'real_time_chat.html': '/chat/m1',
  'notification_screen.html': '/notifications',
  'user_profle.html': '/profile',
  'item_details.html': '/item',
  'offline_pwa_experience.html': '/offline',
});
