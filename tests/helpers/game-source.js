const fs = require('fs');
const path = require('path');

const GAME_SOURCE_FILES = [
  'src/game/bootstrap.js',
  'src/game/progression.js',
  'src/game/systems.js',
  'src/game/run.js',
  'src/game/interface.js',
  'src/game/update.js',
  'src/game/render.js',
  'src/game/town.js',
  'src/game/main.js'
];

function loadGameSource(root) {
  return GAME_SOURCE_FILES.map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
}

module.exports = { GAME_SOURCE_FILES, loadGameSource };
