# Avian

Create Enterprise-class component driven applications that scale.

[![CircleCI](https://img.shields.io/circleci/build/github/flypapertech/avian/master)](https://circleci.com/gh/flypapertech/avian/tree/master)
[![Docker Cloud Build Status](https://img.shields.io/docker/cloud/build/flypapertech/avian)](https://hub.docker.com/repository/docker/flypapertech/avian/builds)
[![Known Vulnerabilities](https://snyk.io/test/github/flypapertech/avian/badge.svg)](https://snyk.io/test/github/flypapertech/avian)
[![npm (scoped)](https://img.shields.io/npm/v/@flypapertech/avian.svg)](https://www.npmjs.com/package/@flypapertech/avian)
[![License](https://img.shields.io/npm/l/@flypapertech/avian.svg)](https://github.com/flypapertech/avian/blob/master/LICENSE)
[![Dependencies](https://david-dm.org/flypapertech/avian/status.svg)](https://david-dm.org/flypapertech/avian)
[![Docker Pulls](https://img.shields.io/docker/pulls/flypapertech/avian)](https://hub.docker.com/r/flypapertech/avian)

## Synopsis

Avian is a platform for running highly available, horizontally scalable, stateless, component based applications. It is optimized for public cloud, private cloud, bare metal, virtual machines, and containers. Its design is the result of years of experience in developing and maintaining applications at scale, while easing development and maintainability for large software engineering teams.

## Key Features

Avian is built on top of the popular [Express](https://expressjs.com/) web framework for [NodeJS](https://nodejs.com), uses [Redis](https://redislabs.com/) for managing application state afinity, sessions, view caching of view templates, and managing application state afinity, while [Webpack](https://webpack.js.org/) manages the transpilation and bundling of your client and server-side component files.

- Cluster mode for load balancing across available CPU cores.
- Out of the box webpacking with sane defaults.  Don't worry you can override and/or add to them whenever you want :)
- Supports client side scripts and server-side service routes (APIs) written in JavaScript and TypeScript with no configuration required.
- A unique and easy to use component-based model that is flexible with popular frameworks such as Angular, Vue.js, ReactJS, virtually 
- Serving of static files.
- Views can be authored in any view engine supported by Express, such as Pug, EJS, Handlebars and plain HTML.
    - Each component can use its own view engine. Making it possible to migrate your application componenets from one engine to another over time.
- Out-of-the box Supported logging frameworks are be Pino, Bunyan, and Fluentd.

## Installation

### Docker

### NPM

The latest stable release of Avian is available on [npmjs.com](https://www.npmjs.com/package/@flypapertech/avian).

The most common scenario is to install Avian as a dependency of your project.

    npm install @flypapertech/avian

    or 

    yarn add @flypapertech/avian

And can be accessed as...

    node ./node_modules/.bin/avian

Alternatively, Avian can be installed globally, making it possible to serve multiple applications with a single installation of Avian.

    npm install @flypapertech/avian -g

    or

    yarn global add @flypapertech/avian

And can be accessed globally, but will need to be told where your Avian application is located...

    avian --home /path/to/avian/app/home

### System Requirements

#### NodeJS

Avian requires NodeJS version 8.0 and above.

#### Redis Server

Avian uses Redis Server for storing session data, caching component config object requests and arbitrary caching requirements you may have.

Suggested Redis Installation Methods

##### macOS
`brew install redis`
##### Ubuntu Linux
`apt install redis-server`
##### Alpine Linux
`apk add redis`
##### Windows (experimental)
  - [Windows with WSL (10 and higher)](https://redislabs.com/blog/redis-on-windows-10/)
  - [Windows without WSL (8.1 and lower)](https://redislabs.com/blog/redis-on-windows-8-1-and-previous-versions/)
    - Note: It is not recommended to use Redis in production on Windows with out WSL.

## Getting Started

### CLI Arguments

    Options:
    --help                      Show help                                [boolean]
    --version                   Show version number                      [boolean]
    --name, -n                  The name of your application[default: "localhost"]
    --home, -h                  The directory of your application.
                                                [default: current working directory]
    --mode, -m                  Deployment mode to run Avian in.
                    [choices: "development", "production"] [default: "development"]
    --port, -p                  Which port to serve your application on.
                                                                    [default: 8080]
    --defaultComponent, --dc    The point of entry to your application.
                                                                [default: "index"]
    --spa                       Start Avian in a single-page-application
                                configuration.          [boolean] [default: false]
    --bundleSkip                                        [boolean] [default: false]
    --bundleOnly                                        [boolean] [default: false]
    --redisHost                                             [default: "127.0.0.1"]
    --redisPort                                                    [default: 6379]
    --redisPass                                                    [default: undefined]
    --redisSessionDB                                                  [default: 1]
    --redisCacheDB                                                    [default: 2]
    --redisCronSchedulerDB                                            [default: 3]
    --webpackHome                                                    [default: undefined]
    --logger, -l                Which logging framework to use.
                                                    [choices: "pino", "bunyan", "fluent"]
    --loggerFluentLabel, --lfl                                  [default: "debug"]
    --loggerFluentTag, --lft                                    [default: "debug"]
    --loggerFluentHost, --lfh                               [default: "127.0.0.1"]
    --loggerFluentPort, --lfp                                     [default: 24224]
    --sslCert                                                             [string]
    --sslKey                                                              [string]
    --cronJobScheduler, --cjs   Avian components are capable of scheduling
                                cron-like jobs that are executed on the server.
                                                        [boolean] [default: false]
    --compression               Use express-compression [boolean] [default: false]

### Application Folder Structure

    ├── assets [optional, statically served at /assets]
    ├── static [optional, statically served at /static]
    ├── cache [auto-generated by Avian in production mode to hold cached files]
    ├── components
    │   ├── avian.service.(ts/js) [optional, used to add service routes to / path]
    │   ├── component_name.client.(ts/js) [optional, contains all JavaScript/TypeScript logic for a component. Will be bundled with Webpack]
    │   ├── component_name.view.(pug/ejs/html) [optional, renders output to a screen, e.g. a /component_name get request]
    │   ├── component_name.service.(ts/js) [optional, used to add service routes to /component_name]
    │   ├── component_name.config.json [optional, served at /component_name/config/objects.json and passed to view files at render time]
    │   ├── component_name [components can be in a flat folder or scaffolded like this]
    │   │   ├── component_name.client.(ts/js)
    │   │   ├── component_name.view.(pug/ejs/html)
    │   │   ├── component_name.service.(ts/js)
    │   │   ├── component_name.config.json
    ├── logs [auto-generated by Avian in production mode]
    ├── package.json
    ├── private [auto-generated by Avian to contain server side compiled files, e.g. component service files]
    ├── public [auto-generated, for compiled component bundles, statically served at /]

### Session Management

Avian uses [express-session](https://github.com/expressjs/session) to manage client sessions. All sessions are stored in a Redis store.

- Browser Based Clients
  - Avian uses secure [HttpOnly Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#Secure_and_HttpOnly_cookies) for managing browser based client sessions.

- Mobile Device and API Clients
  - Avian augments express-session to allow API and mobile device sessions management.  Since those clients may not use cookies they simply need to send their session ID in the authorization header of all requests made to Avian. See below for an example header.

```json
headers: {
    Authorization: "Bearer Session_ID"
}
```

### Global Variables Added by Avian

#### Properties Added to All Request Objects

`req.argv` contains a copy of all arguments passed to Avian at start time.

`req.cache` is a RedisClient instance hooked to Avian's config object cache. Feel free to use it for your own needs as well.

`req.params` paramaters passed to your component. Typically this is used to determine the component name being rendered, e.g. req.params.component.

`req.query` contains all query parameters passed to the componenent being requested.

#### Developing w/ TypeScript

To make TypeScript aware of the globals Avian adds to your application simply place the below import into any .d.ts file that is within your application.

```typescript
import * as Avian from "@flypapertech/avian"
```

## Examples

Examples are located in the [examples directory](https://github.com/flypapertech/avian/tree/master/examples).

## Contributors

    Dan Stephenson
    Nick Fredricks

## License

    MIT

## Copyright

    2018 - 2020 FlyPaper Technologies, LLC
    2016 - 2018 Thoughtpivot, LLC
