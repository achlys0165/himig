self.addEventListener('push', event => {
  const data = event.data.json();
  
  const options = {
    body: data.body || data.message,
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: data.tag || 'himig-notification',
    requireInteraction: true,
    data: {
      url: data.url || '/notifications'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification('HIMIG - Music Ministry', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});

// Cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('himig-v1').then(cache => {
      return cache.addAll([
        '/',
        '/index.html',
        '/icon-192x192.png'
      ]);
    })
  );
});