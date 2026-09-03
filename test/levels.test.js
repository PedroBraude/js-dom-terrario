const { test, describe, before, after } = require('node:test');
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
    '({ LEVELS, state, run, fill, loadLevel, runPlayerCode, stage, codeArea })'
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
  after(() => game.win.close());

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

describe('accesibilidad del editor', () => {
  let game;
  before(() => { game = loadGame(); });
  after(() => game.win.close());

  function press(key, init = {}) {
    const ev = new game.win.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    game.codeArea.dispatchEvent(ev);
    return ev.defaultPrevented;
  }

  test('Tab indenta dentro del editor', () => {
    game.codeArea.value = '';
    assert.equal(press('Tab'), true, 'Tab tiene que quedar capturado');
    assert.equal(game.codeArea.value, '  ');
  });

  test('Esc y luego Tab dejan salir del editor (sin trampa de teclado)', () => {
    press('Escape');
    assert.equal(press('Tab'), false, 'después de Esc, Tab tiene que seguir su curso normal');
    assert.equal(press('Tab'), true, 'la salida es de un solo uso');
  });

  test('escribir después de Esc desarma la salida', () => {
    press('Escape');
    press('a');
    assert.equal(press('Tab'), true, 'Tab vuelve a indentar si se tipeó algo después de Esc');
  });

  test('Shift+Tab siempre sale', () => {
    assert.equal(press('Tab', { shiftKey: true }), false);
  });

  test('la guía y la consola son regiones aria-live', () => {
    const d = game.win.document;
    assert.equal(d.getElementById('lesson').getAttribute('aria-live'), 'polite');
    assert.equal(d.getElementById('console').getAttribute('role'), 'status');
    assert.equal(d.getElementById('hintText').getAttribute('role'), 'status');
    assert.ok(d.querySelector('label[for="code"]'), 'el textarea tiene label');
  });
});

describe('ninguna solución resuelve otro nivel', () => {
  let game;
  before(() => {
    game = loadGame();
    // Level 15 compares against state.nombre, so give it a real name first.
    game.state.nombre = 'Ana';
  });
  after(() => game.win.close());

  // Replays the relevant part of run() against a scratch stage without
  // touching state.
  function solves(solutionIndex, levelIndex) {
    const { LEVELS, fill, runPlayerCode, stage } = game;
    const lv = LEVELS[levelIndex];
    stage.innerHTML = fill(lv.html);
    const silent = { log() {}, error() {} };
    try {
      runPlayerCode(fill(LEVELS[solutionIndex].solution), stage, silent);
    } catch {
      return false;
    }
    const prematuro = lv.precheck && !lv.precheck(stage);
    if (lv.simulate) lv.simulate(stage);
    return !prematuro && !!lv.check(stage);
  }

  test('el código del jugador no ve el DOM real a través de document ni window', () => {
    const { runPlayerCode, stage, win } = game;
    stage.innerHTML = '<h1>Terrario de ???</h1>';
    // Free identifiers in player code resolve against the page's window.
    win.__seen = {};
    runPlayerCode(
      [
        '__seen.docBody = document.body;',
        '__seen.winDoc = window.document;',
        '__seen.globalDoc = globalThis.document;',
        '__seen.selfDoc = self.document;',
        '__seen.topDoc = top.document;',
        '__seen.parentDoc = parent.document;',
        '__seen.framesDoc = frames.document;',
        'window.document.querySelector("h1").textContent = "Terrario de Test";',
      ].join('\n'),
      stage,
      { log() {}, error() {} }
    );
    const seen = win.__seen;
    assert.equal(seen.docBody, stage, 'document.body tiene que ser el terrario');
    assert.equal(seen.winDoc.body, stage, 'window.document tiene que ser el document falso');
    assert.equal(seen.globalDoc, seen.winDoc);
    assert.equal(seen.selfDoc, seen.winDoc);
    assert.equal(seen.topDoc, seen.winDoc);
    assert.equal(seen.parentDoc, seen.winDoc);
    assert.equal(seen.framesDoc, seen.winDoc);
    assert.equal(stage.querySelector('h1').textContent, 'Terrario de Test');
    assert.equal(win.document.querySelector('.brand h1').textContent, 'Terrario DOM', 'el h1 real de la página no se toca');
  });

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
