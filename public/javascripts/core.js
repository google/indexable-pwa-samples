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

var serverConfig = serverConfig || {};

var pwaDemo = {
  /** @param {string} url */
  updatePageContent: function(url) {
    switch(serverConfig.updateMode) {
      case 'disabled':
        console.log('Dynamic content update attempted but updateMode is off.');
        break;
      case 'json':
        fetch(url + '.json').then(function(response) {
          return response.text();
        }).then(function(data) {
          pwaDemo.processJSON(JSON.parse(data));
        }).catch(function(error) {
          console.log('Fetch error: ', error);

          pwaDemo.showOfflinePage();
        })
        break;
      case 'html':
        fetch(url).then(function(response) {
          return response.text();
        }).then(function(data) {
          pwaDemo.processHTML(data);
        }).catch(function(error) {
          console.log('Fetch error: ', error);

          pwaDemo.showOfflinePage();
        })
        break;
    }
  },
  // Processes raw HTML content from the server into the same JSON format
  // that is otherwise delivered from the server when updateMode is set to
  // JSON. Then immediately the processJSON function is called to finish
  // the work.
  /** @param {string} rawHTML */
  processHTML: function(rawHTML) {
    console.log('Updating page with HTML: ', rawHTML);

    var tempDom = document.createElement('tempDom');
    tempDom.innerHTML = rawHTML;

    var contentTag = tempDom.querySelector('#content');
    var contentHTML = contentTag.innerHTML;

    var schemaTag = tempDom.querySelector('#schema-data');
    if (schemaTag == null) {
      throw "HTML missing Schema Markup";
    }

    var schemaData = JSON.parse(schemaTag.text);

    var titleTag = tempDom.querySelector('title');
    if (titleTag == null) throw "Title tag is missing";

    var canonicalTag = tempDom.querySelector('link[rel=canonical]');
    if (canonicalTag == null) throw "Canonical tag is missing";

    var preparedJSON = {
      page: {
        title: titleTag.text,
        canonical: canonicalTag.text,
        content: contentHTML,
        description: schemaData.description,
        metaImage: schemaData.image.url,
        thumbnailPath: schemaData.image.url,
        thumbnailWidth: schemaData.image.width,
        thumbnailHeight: schemaData.image.height,
        copyright: ''
      },
      siteUrl: ''
    }

    pwaDemo.processJSON(preparedJSON);
  },
  // Reads the JSON from the server (or from the client processed HTML)
  /** @param {!Object} jsonData */
  processJSON: function(jsonData) {
    console.log('Updating page with JSON: ', jsonData);

    var canonical = window.location.toString();
    var contentTag = document.querySelector('#content');

    contentTag.innerHTML = 'content' in jsonData.page ?
        jsonData.page.content : '';

    var newSchemaMeta = {
      '@context': 'http://schema.org',
      '@type': 'NewsArticle',
      'mainEntityOfPage': {
        '@type': 'WebPage',
        '@id': 'https://google.com/article'
      },
      'headline': jsonData.page.title,
      'image': {
        '@type': 'ImageObject',
        'url': jsonData.siteUrl + jsonData.page.thumbnailPath,
        'width': jsonData.page.thumbnailWidth,
        'height': jsonData.page.thumbnailHeight
      },
      'datePublished': '2015-02-05T08:00:00+08:00',
      'dateModified': '2015-02-05T09:20:00+08:00',
      'author': {
        '@type': 'Person',
        'name': 'John Doe'
      },
      'publisher': {
        '@type': 'Organization',
        'name': 'ACME Industries',
        'logo': {
          '@type': 'ImageObject',
          'url': jsonData.siteUrl + '/images/logo.jpg',
          'width': 600,
          'height': 60
        }
      },
      'description': jsonData.page.description
    }

    document.querySelector('html > head > title').innerText =
        jsonData.page.title;
    document.querySelector('h2').innerText = jsonData.page.title;
    document.querySelector('#schema-data').innerHTML =
        JSON.stringify(newSchemaMeta);

    document.querySelector('html > head > link[rel=canonical]').href =
        canonical;

    document.querySelector('html > head > meta[property=og\\:title]').content =
        jsonData.page.title;
    document.querySelector('html > head > meta[property=og\\:url]').content =
        jsonData.siteUrl + jsonData.page.canonical;
    document.querySelector('html > head > meta[property=og\\:image]').content =
        jsonData.siteUrl + jsonData.page.metaImage;

    document.querySelector('html > head > meta[name=twitter\\:title]').content =
        jsonData.page.title;
    document.querySelector(
        'html > head > meta[name=twitter\\:description]').content =
        jsonData.page.description;
    document.querySelector(
        'html > head > meta[name=twitter\\:image]').content =
        jsonData.siteUrl + jsonData.page.metaImage;

    document.querySelector('.image-copyright p').innerText =
        'Image is copyright of ' + jsonData.page.copyright;
  },
  isRenderedPageEmpty: function() {
    var contentTag = document.querySelector('#content');
    return contentTag.innerHTML.trim() == '';
  },
  checkOnlineOfflineState: function() {
    if (navigator.onLine) {
      document.body.classList.remove('offline');
    } else {
      document.body.classList.add('offline');
    }
  },
  showOfflinePage: function() {
    pwaDemo.processJSON({
      page: {
        title: 'Offline',
        canonical: '/',
        content: 'You are offline.',
        description: '',
        metaImage: '',
        thumbnailPath: '',
        thumbnailWidth: '',
        thumbnailHeight: '',
        copyright: ''
      },
      siteUrl: ''
    });
  }
}

// Detect Service Worker API availability and install if possible
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/generated-service-worker.js', {
    'scope': '/'
  }).then(function(registration) {
    // Registration was successful
    console.log('ServiceWorker registration successful with scope: ',
        registration.scope);
  }).catch(function(err) {
    // Registration failed
    console.log('ServiceWorker registration failed: ', err);
  });
}

document.addEventListener('click', function(e) {
  if (serverConfig.renderMode == 'server' ||
      serverConfig.updateMode == 'disabled') {
    // Allow the links to be traversed as per normal.
    return;
  }

  if (e.target.classList.contains('external')) {
    // Links designed to be regularly traversed.
    return;
  }

  if (e.target.tagName == 'A') {
    e.preventDefault();

    var newUrl = e.target.href;
    var linkDescription = e.target.text;

    // Push the request on the
    history.pushState(false, linkDescription, newUrl);

    pwaDemo.updatePageContent(newUrl);
  }
}, false);

window.addEventListener('load', function(e) {
  // Fade out the content of the page slightly when the user is offline
  pwaDemo.checkOnlineOfflineState();

  if (serverConfig.renderMode == 'server') {
    return;
  }

  // Listen for browser navigation state changes and update dynamically if
  // render mode isn't server driven
  window.addEventListener('popstate', function(event) {
    pwaDemo.updatePageContent(window.location.toString());
  });

  if (serverConfig.renderMode == 'client') {
    // Fetch the page content separately from the initial URL request
    pwaDemo.updatePageContent(window.location.toString());
  }

  if (serverConfig.renderMode == 'hybrid' && pwaDemo.isRenderedPageEmpty()) {
    // Fetch the page content separately from the initial URL request
    // if the hybrid model received an empty page -- i.e from the service worker
    pwaDemo.updatePageContent(window.location.toString());
  }
}, false);

window.addEventListener('offline', function(e) {
  console.log('Transitioned offline.');

  pwaDemo.checkOnlineOfflineState();
});

window.addEventListener('online', function(e) {
  console.log('Transitioned online.');

  pwaDemo.checkOnlineOfflineState();

  if (serverConfig.renderMode == 'client' ||
      serverConfig.renderMode == 'hybrid') {
    // Dynamically fetch new content if the user goes online while on a page
    pwaDemo.updatePageContent(window.location.toString());
  }
});
