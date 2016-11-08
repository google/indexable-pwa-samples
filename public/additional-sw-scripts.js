/**
 * Copyright 2015 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

console.log('Installing additional SW logic');

const CACHE_VERSION = 1;
let CURRENT_CACHES = {
  offline: 'offline-v' + CACHE_VERSION
};
const OFFLINE_URL = '/offline';

// Returns a request for a URL which is guaranteed to be freshly accessed
// from the network and to have avoided the cache.
// Newer versions of Chrome support this via the cache: reload key pair.
// But if the request fails to include the cache key after being created then
// we know that failed. In which case we'll append a timestamp to the URL to
// ensure it's going to be a fresh request.
function createCacheBustedRequest(url) {
  let request = new Request(url, {cache: 'reload'});
  // See https://fetch.spec.whatwg.org/#concept-request-mode
  // This is not yet supported in Chrome as of M48, so we need to explicitly
  // check to see if the cache: 'reload' option had any effect.
  if ('cache' in request) {
    return request;
  }

  // If {cache: 'reload'} didn't have any effect, append a cache-busting URL
  // parameter instead.
  let bustedUrl = new URL(url, self.location.href);
  bustedUrl.search += (bustedUrl.search ? '&' : '') + 'cachebust=' + Date.now();
  return new Request(bustedUrl);
}

self.addEventListener('install', function(event) {
  event.waitUntil(
    // We can't use cache.add() here, since we want OFFLINE_URL to be the
    // cache key, but the actual URL we request should always be fresh from
    // the network so we use the function "createCacheBustedRequest" to
    // guarantee this.
    fetch(createCacheBustedRequest(OFFLINE_URL)).then(function(response) {
      return caches.open(CURRENT_CACHES.offline).then(function(cache) {
        return cache.put(OFFLINE_URL, response);
      });
    })
  );
});

self.addEventListener('fetch', function(event) {
  // We only want to call event.respondWith() if this is a navigation request
  // for an HTML page.
  // request.mode of 'navigate' is unfortunately not supported in Chrome
  // versions older than 49, so we need to include a less precise fallback,
  // which checks for a GET request with an Accept: text/html header.
  if (event.request.mode === 'navigate' ||
      (event.request.method === 'GET' &&
      event.request.headers.get('accept').includes('text/html'))) {

    // If the resource is cached, return it from the cache.
    // Otherwise fetch it from the server and then cache it.
    // If that fails as well, then fall back to the offline page we
    // cached at the start.
    event.respondWith(
      caches.match(event.request).then(function(response) {
        return response || fetch(event.request).then(function(response) {
          return caches.open(CURRENT_CACHES.offline).then(function(cache) {
            return cache.put(event.request, response);
          });
        }).catch(function(error) {
          // The catch is only triggered if fetch() throws an exception,
          // which will most likely happen due to the server being
          // unreachable.
          console.log('Fetch failed; serving offline page instead.', error);
          return caches.match(OFFLINE_URL);
        });
      })
    );
  }
});
