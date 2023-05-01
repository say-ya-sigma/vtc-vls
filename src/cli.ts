#!/usr/bin/env node
import * as path from "path";
import minimist from "minimist";
import { check } from "./index";

const {
  rootDir,
  srcDir,
  onlyTemplate,
  onlyTypeScript,
  excludeDir,
} = minimist(process.argv.slice(2));

if (!rootDir) {
  throw new Error("--rootDir is required");
}

const cwd = process.cwd();

check({
  workspace: path.resolve(cwd, rootDir),
  srcDir: srcDir && path.resolve(cwd, srcDir),
  onlyTemplate,
  onlyTypeScript,
  excludeDir,
});
