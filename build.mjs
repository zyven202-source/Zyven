#!/usr/bin/env node
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

const root = process.cwd();
const nodeModules = resolve(root, 'node_modules');
const viteJs = resolve(root, 'node_modules', 'vite', 'bin', 'vite.js');

// Install deps if node_modules doesn't exist or vite is missing
if (!existsSync(nodeModules) || !existsSync(viteJs)) {
  console.log('Installing dependencies...');
  execSync('npm install', { cwd: root, stdio: 'inherit' });
}

if (!existsSync(viteJs)) {
  console.error('vite still not found after install. Check package.json.');
  process.exit(1);
}

const cmd = `node "${viteJs}" build`;
console.log(`> ${cmd}`);
execSync(cmd, { cwd: root, stdio: 'inherit' });
