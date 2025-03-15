// Logging Service Worker for handling logs in offline mode

const CACHE_NAME = 'logging-cache-v1';
const LOG_STORE_NAME = 'offline-logs';
const LOG_API_PATTERN = /\/api\/logs/;

// Open an IndexedDB database for log storage
function openLogsDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('LogsDB', 1);
    
    request.onerror = event => {
      console.error('IndexedDB error:', event.target.error);
      reject(event.target.error);
    };
    
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(LOG_STORE_NAME)) {
        db.createObjectStore(LOG_STORE_NAME, { keyPath: 'timestamp' });
      }
    };
    
    request.onsuccess = event => {
      resolve(event.target.result);
    };
  });
}

// Store a log entry in IndexedDB
async function storeLog(logEntry) {
  const db = await openLogsDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([LOG_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(LOG_STORE_NAME);
    
    const request = store.add(logEntry);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Get all stored logs from IndexedDB
async function retrieveLogs() {
  const db = await openLogsDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([LOG_STORE_NAME], 'readonly');
    const store = transaction.objectStore(LOG_STORE_NAME);
    
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Clear logs from IndexedDB
async function clearLogs(logs) {
  const db = await openLogsDB();
  const transaction = db.transaction([LOG_STORE_NAME], 'readwrite');
  const store = transaction.objectStore(LOG_STORE_NAME);
  
  logs.forEach(log => {
    store.delete(log.timestamp);
  });
  
  return new Promise((resolve) => {
    transaction.oncomplete = () => resolve();
  });
}

// Process a logging request when offline
async function handleOfflineLog(request) {
  try {
    const logData = await request.json();
    // Add offline flag to the log
    logData.context = {
      ...logData.context,
      offlineStored: true,
      offlineTimestamp: new Date().toISOString()
    };
    
    await storeLog(logData);
    return new Response(JSON.stringify({ success: true, stored: 'offline' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Send stored logs to the server when online
async function syncOfflineLogs() {
  try {
    const logs = await retrieveLogs();
    if (!logs || logs.length === 0) return;
    
    console.log(`[Logging Service Worker] Syncing ${logs.length} offline logs`);
    
    // Process logs in batches to avoid overwhelming the server
    const BATCH_SIZE = 10;
    let successCount = 0;
    
    for (let i = 0; i < logs.length; i += BATCH_SIZE) {
      const batch = logs.slice(i, i + BATCH_SIZE);
      const successfulLogs = [];
      
      // Send each log in the batch
      await Promise.all(batch.map(async (log) => {
        try {
          const response = await fetch('/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(log)
          });
          
          if (response.ok) {
            successfulLogs.push(log);
            successCount++;
          }
        } catch (error) {
          console.error('[Logging Service Worker] Error syncing log:', error);
        }
      }));
      
      // Clear successful logs
      if (successfulLogs.length > 0) {
        await clearLogs(successfulLogs);
      }
      
      // Add a delay between batches
      if (i + BATCH_SIZE < logs.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`[Logging Service Worker] Synced ${successCount} of ${logs.length} logs`);
  } catch (error) {
    console.error('[Logging Service Worker] Error in syncOfflineLogs:', error);
  }
}

// Install event - cache key resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([
        // Add key resources needed for offline logging
        '/offline.html',
        '/assets/logging-styles.css'
      ]);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
});

// Fetch event - intercept network requests
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Handle logging API requests
  if (LOG_API_PATTERN.test(url.pathname)) {
    // Check if we're online
    if (!navigator.onLine) {
      console.log('[Logging Service Worker] Handling offline log');
      event.respondWith(handleOfflineLog(event.request.clone()));
      return;
    }
  }
  
  // Default fetch behavior for other requests
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request).then(response => {
        // Return cached response or fallback
        return response || caches.match('/offline.html');
      });
    })
  );
});

// Sync event - sync logs when back online
self.addEventListener('sync', event => {
  if (event.tag === 'sync-logs') {
    event.waitUntil(syncOfflineLogs());
  }
});

// Message event - handle messages from the main thread
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SYNC_LOGS') {
    event.waitUntil(syncOfflineLogs());
  }
});

// Push event - handle push notifications (for log alerts)
self.addEventListener('push', event => {
  const data = event.data.json();
  
  if (data.type === 'log-alert') {
    const options = {
      body: data.message,
      icon: '/assets/log-icon.png',
      badge: '/assets/log-badge.png',
      data: {
        logId: data.logId,
        timestamp: data.timestamp
      }
    };
    
    event.waitUntil(
      self.registration.showNotification('Logging Alert', options)
    );
  }
});

console.log('[Logging Service Worker] Initialized');