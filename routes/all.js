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

var express = require('express');
var router = express.Router();
var fs = require('fs');
var xml2js = require('xml2js');
var xmlParser = new xml2js.Parser();
var swPrecache = require('sw-precache');
var fs = require('fs');
var path = require('path');

// Read the server's configuration from a local JSON file.
// Allow for overrides from server environment variables.
var serverConfig = JSON.parse(fs.readFileSync(path.join(__dirname,
    '/../config.json'), 'utf8'));

if ('AMP_MODE' in process.env) {
  serverConfig.ampMode = process.env.AMP_MODE;
}

if ('RENDER_MODE' in process.env) {
  serverConfig.renderMode = process.env.RENDER_MODE;
}

if ('UPDATE_MODE' in process.env) {
  serverConfig.updateMode = process.env.UPDATE_MODE;
}

// Google Site Verification is necessary for some Google tools such as
// Search Console. For convenience this is configurable.
if ('GOOGLE_SITE_VERIFICATION_TOKEN' in process.env) {
  serverConfig.googleSiteVerificationToken =
      process.env.GOOGLE_SITE_VERIFICATION_TOKEN;
}

console.log('Server Configuration:', serverConfig);

// Based on the render mode we use a different sw-precache configuration file
// to generate the Service Worker.
var swPrecacheConfig = require('./../sw-precache-config-' +
    serverConfig.renderMode + '.js');
swPrecache.write(path.join(__dirname,
    '/../public/generated-service-worker.js'), swPrecacheConfig,
    function(err) {
  if (err) console.log(err);
});

// Cache the CSS in memory to embed into AMP documents where necessary:
var globalCSS = '';

fs.readFile(path.join(__dirname, '/../public/stylesheets/style.css'),
    function(err, data) {
  if (err) console.log(err);

  globalCSS = data;
  console.log('CSS preloaded for AMP requests.');
});

function getPath(url) {
  return url.substring(0, url.lastIndexOf('.'));
}

function renderPage(req, res, next, templateData) {
  // SSL or bust!
  var siteUrl = 'https://' + req.get('host');

  var typeRequest = req.params.typeRequest || 'html';

  //
  if (typeRequest == 'amp' && serverConfig.ampMode != 'disabled') {
    // CSS in AMP must be embedded
    templateData.ampCSS = globalCSS;

    templateData.ampRequested = true;
    templateData.altUrl = getPath(req.path);
    templateData.canonicalUrl = siteUrl + templateData.page.canonical;
    templateData.serviceWorkerUrl = siteUrl + '/generated-service-worker.js';
  } else {
    templateData.ampRequested = false;
    templateData.altUrl = getPath(req.path) + '.amp';
    templateData.canonicalUrl = siteUrl + templateData.page.canonical;
    templateData.ampUrl = siteUrl + templateData.page.canonical + '.amp';
  }

  // Attach the server config
  templateData.serverConfig = serverConfig;
  templateData.siteUrl = siteUrl;
  templateData.ampEnabled = (serverConfig.ampMode == 'enabled');

  // If the request is for JSON then don't render the content in
  // the HTML template
  if (typeRequest == 'json')
  {
    res.send(JSON.stringify(templateData));
  } else {
    res.render('content', templateData);
  }
}

// Render 404 page
function render404(req, res, next) {
  res.status(404);

  renderPage(req, res, next, {
    page: {
      title: 'Page not found',
      canonical: 'http://localhost/',
      content: 'Page could not be found.'
    }
  });
}

// Route for all content page requests
router.get(['/(.:typeRequest)?', '/content/:id.:typeRequest?'],
    function(req, res, next) {
  // Specific content page requested, defaults to index
  var contentId = req.params.id || 'index';

  // Specific content page requested, accepts 'json' or 'html', defaults to html
  var typeRequest = req.params.typeRequest || 'html';

  console.log('Content page request, id:', contentId, '& type:', typeRequest);

  // If the server is set to client mode and the request is for the HTML
  // payload then we serve back the empty App Shell.
  if (serverConfig.renderMode == 'client' && typeRequest == 'html') {
    renderPage(req, res, next, {
      page: {}
    });
    return;
  }

  // Find the conten XML file:
  var contentFilePath = path.join(__dirname,
      '/../content/' + contentId + '.xml');

  fs.readFile(contentFilePath, function(err, data) {
    if (err) return render404(req, res, next);

    // XML content extraction for templating
    xmlParser.parseString(data, function (err, result) {
      if (err) return render404(req, res, next);

      // Map the XML content
      var templateData = {
        page: {
          title: result.document.title[0],
          canonical: result.document.canonical[0],
          content: result.document.content[0],
          description: result.document.description[0],
          metaImage: result.document.thumbnailPath[0],
          thumbnailPath: result.document.thumbnailPath[0],
          thumbnailWidth: result.document.thumbnailWidth[0],
          thumbnailHeight: result.document.thumbnailHeight[0],
          copyright: result.document.copyright[0]
        }
      };

      // Render the page:
      renderPage(req, res, next, templateData);
    });
  });
});

// Render robots.txt template
router.get('/robots.txt', function(req, res, next) {
  res.render('robots', {});
})

// Render manifest.json template
router.get('/manifest.json', function(req, res, next) {
  res.render('manifest', {});
})

// Render the content template with empty data to act as the 'App Shell'
router.get('/app-shell', function(req, res, next) {
  renderPage(req, res, next, {
    page: {}
  });
})

// Render the content template with offline feedback to the user
router.get('/offline', function(req, res, next) {
  renderPage(req, res, next, {
    page: {
      title: 'Offline',
      content: 'You are offline.'
    }
  });
})

module.exports = router;
