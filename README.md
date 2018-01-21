[![Build Status](https://travis-ci.org/ispyhumanfly/avian.svg?branch=master)](https://travis-ci.org/ispyhumanfly/avian)

[![NPM](https://nodei.co/npm/avian.png)](https://npmjs.org/package/avian)

# Avian
Easily power your enterprise-class HTML5 web, mobile or desktop application.

# About
A highly scalable and easy to use environment for hosting modern HTML5 web, mobile and desktop applications.

## Key Features
- Component-based design paradigm while keeping things flexible.
- Multi-core / Multi-threaded server side operations.
- No database, just Redis.
- Each Avian component is responsible for managing its own storage objects.

Host an HTML5 application using Avian...

    avian --name appname --home /path/to/your/app --port 8080 --mode production

# Installation
Avian can easily be installed using various methods.

## System Requirements
Avian uses Redis Server for fast loading component templates and component storage objects. Because of this, and other lower-level goodies, the following software must be available to the installation environment.

- macOS/Linux
    - Redis Server
    - GCC 4.8+ / Python 2.x
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
