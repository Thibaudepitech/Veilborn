#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const checks = [
  { name: 'package.json (root)', path: 'package.json', type: 'file' },
  { name: 'src/main.js', path: 'src/main.js', type: 'file' },
  { name: 'src/preload.js', path: 'src/preload.js', type: 'file' },
  { name: 'electron-builder.yml', path: 'electron-builder.yml', type: 'file' },
  { name: 'public/ directory', path: 'public', type: 'dir' },
  { name: 'public/index.html', path: 'public/index.html', type: 'file' },
  { name: 'public/style.css', path: 'public/style.css', type: 'file' },
  { name: 'serveur/ directory', path: 'serveur', type: 'dir' },
  { name: 'serveur/index.js', path: 'serveur/index.js', type: 'file' },
  { name: 'node_modules/ directory', path: 'node_modules', type: 'dir' },
];

let allOk = true;

console.log('\n📋 Vérification de la configuration Veilborn Desktop\n');

checks.forEach(check => {
  const fullPath = path.join(__dirname, check.path);
  const exists = fs.existsSync(fullPath);
  const status = exists ? '✓' : '✗';
  const color = exists ? '\x1b[32m' : '\x1b[31m';
  const reset = '\x1b[0m';

  console.log(`${color}${status}${reset} ${check.name}`);

  if (!exists) {
    allOk = false;
  }
});

console.log('\n' + (allOk
  ? '✓ Tous les fichiers sont en place! Vous pouvez lancer: npm start\n'
  : '✗ Il manque certains fichiers. Vérifiez la configuration.\n'));

process.exit(allOk ? 0 : 1);
