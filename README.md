# vtc-vls

vtc-vls is fork project from vue-type-check

[https://github.com/Yuyz0112/vue-type-check](https://github.com/Yuyz0112/vue-type-check)

upgrade vetur library from...

- "vue-language-server": "^0.0.67"

to...

- "vls": "^0.8.5"

This allows it to be used for recent Vue2, Nuxt2 projects.

## Features

- type checking template code.
- type checking script code.

## Changes

Workspace is new npm feature. I use rootDir instead.

--workspace -> --rootDir

## Usage

### CLI

```shell
Install: npm i -g vtc-vls

Usage: vtc-vls
Options:
  --rootDir          path to your project root dir, required
  --srcDir           path to the folder which contains your Vue components, will fallback to the workspace when not passed
  --onlyTemplate     whether to check the script code in a single file component
```
