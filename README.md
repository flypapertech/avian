[![Build Status](https://travis-ci.org/ispyhumanfly/avian.svg?branch=master)](https://travis-ci.org/ispyhumanfly/avian)

[![NPM](https://nodei.co/npm/avian.png)](https://npmjs.org/package/avian)

# Avian
Create Enterprise-class component driven applications that scale.

# About
A highly scalable and easy to use environment for hosting modern HTML5 web, mobile and desktop applications.

## Key Features
- Enterprise-class application server that meets infinitely scalable demands.
- A unique and easy to use component-based model that is flexible with popular
frameworks such as Angular, Vue.js, ReactJS, X-Tag, SkateJS, Ember, and much more.
- Multi-core / Multi-threaded application host operations remove the burden of such considerations from the application developer.

Host an HTML5 application using Avian...

    avian --name appname --home /path/to/your/app --port 8080 --mode production

# Installation
Avian can be installed using various methods.

## System Requirements
Avian uses Redis Server for fast loading component templates and component storage objects. Because of this, and other lower-level goodies, the following software must be available to the installation environment.

- macOS/Linux
    - Redis Server
    - GCC 4.8+ / G++5 / Python 2.x
- Windows
    - Redis Server
    - Visual Studio, Windows SDK, .NET and Python 2.x.

# NPM
The latest stable release of Avian is available via the Node Package Manager.

## Global
    npm install avian -g

## Local
    npm install avian --save

# GitHub
The source code is available on GitHub. Though every build is verified through Travis, please consider installation directly from GitHub to be risky for new developers.

## Global
    npm install https://github.com/ispyhumanfly/avian -g

## Local
    npm install https://github.com/ispyhumanfly/avian --save

## Clone
    git clone https://github.com/ispyhumanfly/avian.git

# Documentation
    docs/README.md

# Examples
    docs/examples/README.md

# Author
Dan Stephenson (ispyhumanfly@gmail.com)

# License
MIT
