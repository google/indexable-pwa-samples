# Indexable PWA

A sample ExpressJS PWA that explores and demonstrates the best
practices for implementing a PWA in regards to indexability of content.

Can be configured for 3 specific rendering modes:
* Client
* Server
* Hybrid

## Local Development Setup

Install this package via npm:

`npm install`

Install bower and the fetch polyfill to support Safari:

~~~~
npm install bower
bower install fetch
~~~~

Run the server via:

`node server.js`

## Deploying to App Engine

Follow this link to setup your App Engine project for Node.JS:

https://cloud.google.com/nodejs/

To deploy a particular configuration to App Engine specify the yaml file:

`gcloud app deploy app.yaml`

Use app.yaml to set environment variables to override the config.js file.

Example .yaml file:

~~~~
runtime: nodejs
vm: true
env_variables:
  AMP_MODE: disabled
  RENDER_MODE: hybrid
  UPDATE_MODE: json
~~~~

## Configuration Patterns

Configure config.js:

* ampMode: [enabled, disabled]
* renderMode: [server, client, hybrid]
* updateMode: [json, html, disabled]
  * json: causes AJAX requests to be fetched as JSON from the server and
    the DOM to be updated via reading the JSON.
  * html: causes AJAX requests to be fetched as HTML from the server,
    the HTML is parsed on the client and the DOM to be updated via reading
    the parsed HTML from the server.

Recommended configuration patterns:

### Server Sample

For server-side rendering:

~~~~
{
  "ampMode": "disabled",
  "renderMode": "server",
  "updateMode": "disabled",
  "googleSiteVerificationToken": ""
}
~~~~

### Client Sample

For client-side rendering.

updateMode can be configured as either 'json' or 'html'.

~~~~
{
  "ampMode": "disabled",
  "renderMode": "client",
  "updateMode": "json",
  "googleSiteVerificationToken": ""
}
~~~~

### Hybrid Sample

For hybrid rendering.

updateMode can be configured as either 'json' or 'html'.

~~~~
{
  "ampMode": "disabled",
  "renderMode": "hybrid",
  "updateMode": "json",
  "googleSiteVerificationToken": ""
}
~~~~
