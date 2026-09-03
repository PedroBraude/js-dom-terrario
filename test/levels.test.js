const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// jsdom does not implement CSS.escape, which the game uses in getElementById.
function polyfillCssEscape(window) {
  if (window.CSS && typeof window.CSS.escape === 'function') return;
  window.CSS = window.CSS || {};
  window.CSS.escape = value =>
    String(value).replace(/([^\w-])/g, ch => '\\' + ch);
}

function loadGame() {
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously',
    url: 'http://localhost/',
    beforeParse: polyfillCssEscape,
  });
  const win = dom.window;
  // Top-level const/function declarations of a classic script are not window
  // properties, so we reach them through eval in the window's scope.
  const api = win.eval(
    '({ LEVELS, state, run, fill, loadLevel, makeDocument, stage, codeArea })'
  );
  return { dom, win, ...api };
}

// Pairs (solutionIndex, levelIndex) where a solution legitimately solves a
// different level. Kept explicit so a new accidental overlap fails the test.
const KNOWN_OVERLAPS = new Set([
  '5>4', // querySelectorAll('.dormido') also wakes the single frog of level 5
]);

describe('cada nivel se resuelve con su propia solución', () => {
  let game;
  before(() => { game = loadGame(); });

  test('hay 15 niveles', () => {
    assert.equal(game.LEVELS.length, 15);
  });

  for (let i = 0; i < 15; i++) {
    test(`nivel ${i + 1}`, () => {
      const { LEVELS, state, run, fill, loadLevel, codeArea } = game;
      loadLevel(i);
      codeArea.value = fill(LEVELS[i].solution);
      run();
      assert.ok(state.done.has(i), `state.done no incluye el nivel ${i + 1}`);
    });
  }

  test('el nombre del nivel 1 quedó guardado en state', () => {
    assert.equal(game.state.nombre, 'Ana');
  });
});

describe('ninguna solución resuelve otro nivel', () => {
  let game;
  before(() => {
    game = loadGame();
    // Level 15 compares against state.nombre, so give it a real name first.
    game.state.nombre = 'Ana';
  });

  // Replays the relevant part of run() against a scratch stage without
  // touching state.
  function solves(solutionIndex, levelIndex) {
    const { LEVELS, fill, makeDocument, stage, win } = game;
    const lv = LEVELS[levelIndex];
    stage.innerHTML = fill(lv.html);
    const silent = { log() {}, error() {} };
    try {
      new win.Function('document', 'console', '"use strict";\n' + fill(LEVELS[solutionIndex].solution))(makeDocument(stage), silent);
    } catch {
      return false;
    }
    const prematuro = lv.precheck && !lv.precheck(stage);
    if (lv.simulate) lv.simulate(stage);
    return !prematuro && !!lv.check(stage);
  }

  for (let i = 0; i < 15; i++) {
    for (let j = 0; j < 15; j++) {
      if (i === j) continue;
      const key = `${i}>${j}`;
      test(`solución ${i + 1} contra nivel ${j + 1}`, () => {
        const ok = solves(i, j);
        if (KNOWN_OVERLAPS.has(key)) {
          assert.ok(ok, `el solapamiento conocido ${key} ya no ocurre; sacalo de KNOWN_OVERLAPS`);
        } else {
          assert.equal(ok, false, `la solución del nivel ${i + 1} pasa el check del nivel ${j + 1}`);
        }
      });
    }
  }
});
