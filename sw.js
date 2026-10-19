/* 阳光中学 3D 互动校园 · 站点缓存服务工作者
 * 背景：CloudBase webapps 测试域名对所有资源返回 no-store 且无压缩，
 * 浏览器 HTTP 缓存完全失效，二次访问仍需全量下载 37MB。
 * 本 SW 用 Cache API 在 JS 层重建缓存（不受响应头限制）：
 * - 页面导航（index/classrooms）：网络优先，失败回缓存（保证部署后拿最新 HTML）
 * - 同源静态资源：stale-while-revalidate（先回缓存秒开，后台静默更新）
 * 部署新版本时把 CACHE 升号（v→v+1），旧缓存自动清理；
 * 学生端最迟第二次刷新拿到新资源。 */
const CACHE = 'campus-vr-v15'; // 2026-10-17 六大互动升级：三步上篮/自由射门/自由跳绳/四泳姿/真钢琴/电影馆/江西实时天气/雨伞人群/食堂就餐
const NAV_PAGES = new Set(['/', '/index.html', '/classrooms.html', '/reset.html']);

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  // 导航页：始终尝试网络拿最新（限时 8s，慢网课堂可接受），失败用缓存兜底
  const cache = await caches.open(CACHE);
  try {
    const resp = await fetch(request, { signal: AbortSignal.timeout(8000) });
    if (resp && resp.ok) cache.put(request, resp.clone());
    return resp;
  } catch (e) {
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    return new Response('<meta charset="utf-8"><title>离线</title><p>当前无网络，且本机还没有该页面的缓存。恢复网络后重试。</p>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request, { ignoreSearch: false });
  const refresh = fetch(request).then(resp => {
    if (resp && resp.ok && (resp.type === 'basic' || resp.type === 'default')) cache.put(request, resp.clone());
    return resp;
  }).catch(() => null);
  if (hit) { refresh; return hit; }
  const fresh = await refresh;
  if (fresh) return fresh;
  // 网络失败且无缓存：交给页面自身容错（素材加载已有程序化兜底）
  return new Response('', { status: 504, statusText: 'offline' });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // 第三方/跨域不接管
  if (url.pathname.endsWith('/sw.js')) return; // SW 自身始终走网络
  if (url.pathname.startsWith('/assets/video/')) return; // 电影 40MB+ 不进 Cache API（撑爆存储，交给 HTTP 缓存）
  if (req.mode === 'navigate' || NAV_PAGES.has(url.pathname)) {
    e.respondWith(networkFirst(req));
    return;
  }
  e.respondWith(staleWhileRevalidate(req));
});
