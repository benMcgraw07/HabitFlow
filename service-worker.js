
/* =========================================
   HabitFlow - PWA Service Worker
   ========================================= */

// Change the version when updating the app cache
const CACHE_NAME = "habitflow-shell-v1";

// Files required for HabitFlow to work offline
const APP_FILES = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json",
    "./icons/icon-192.png",
    "./icons/icon-512.png"
];

/* =========================================
   Install - Cache essential app files
   ========================================= */

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(APP_FILES);
        })
    );
});

/* =========================================
   Activate - Remove old app caches
   ========================================= */

self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            const cacheNames = await caches.keys();

            await Promise.all(
                cacheNames
                    .filter((name) =>
                        name.startsWith("habitflow-shell-") &&
                        name !== CACHE_NAME
                    )
                    .map((name) => caches.delete(name))
            );

            await self.clients.claim();
        })()
    );
});

/* =========================================
   Fetch - Network first, cache fallback
   ========================================= */

self.addEventListener("fetch", (event) => {
    const request = event.request;

    // Only handle GET requests from HabitFlow's origin
    if (
        request.method !== "GET" ||
        new URL(request.url).origin !== self.location.origin
    ) {
        return;
    }

    event.respondWith(
        (async () => {
            try {
                // Prefer the latest files while online
                const response = await fetch(request);

                if (response.ok && response.type === "basic") {
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(request, response.clone());
                }

                return response;

            } catch (error) {
                // If offline, look for a saved response
                const cachedResponse = await caches.match(request);

                if (cachedResponse) {
                    return cachedResponse;
                }

                // Offline fallback for app navigation
                if (request.mode === "navigate") {
                    const homePage = await caches.match(
                        "./index.html"
                    );

                    if (homePage) {
                        return homePage;
                    }
                }

                return Response.error();
            }
        })()
    );
});
