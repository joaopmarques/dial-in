import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  varName,
  round,
  cssValue,
  originalsOf,
  startValues,
  ghostPercent,
  placePanel,
  clamp,
  EASING_PRESETS,
  matchPreset,
  DOCK_MODES,
} from '../../skills/dial-in/assets/core.js';

describe('varName', () => {
  test('namespaces by id and key with the --dial- prefix', () => {
    assert.equal(varName('pricing-card', 'radius'), '--dial-pricing-card-radius');
  });
});

describe('round', () => {
  test('rounds to the decimals of the step', () => {
    assert.equal(round(0.1 + 0.2, 0.1), 0.3);
    assert.equal(round(12.345, 0.01), 12.35);
    assert.equal(round(12.6, 1), 13);
  });
  test('defaults to two decimals', () => {
    assert.equal(round(1.23456), 1.23);
  });
});

describe('cssValue', () => {
  test('number adds the unit and rounds to the step', () => {
    assert.equal(cssValue({ type: 'number', unit: 'px', step: 1 }, 24.4), '24px');
    assert.equal(cssValue({ type: 'number', unit: 'rem', step: 0.125 }, 1.5), '1.5rem');
  });
  test('number without unit stays unitless', () => {
    assert.equal(cssValue({ type: 'number', step: 0.01 }, 0.5), '0.5');
  });
  test('point writes both axes with the unit', () => {
    assert.equal(cssValue({ type: 'point', unit: 'px', step: 1 }, { x: 0, y: 8 }), '0px 8px');
  });
  test('boolean uses on/off, with 1/0 as default', () => {
    assert.equal(cssValue({ type: 'boolean', on: 'block', off: 'none' }, true), 'block');
    assert.equal(cssValue({ type: 'boolean', on: 'block', off: 'none' }, false), 'none');
    assert.equal(cssValue({ type: 'boolean' }, true), '1');
    assert.equal(cssValue({ type: 'boolean' }, false), '0');
  });
  test('cubic-bezier writes the function with rounded numbers', () => {
    assert.equal(cssValue({ type: 'cubic-bezier' }, [0.2, 0.80004, 0.2, 1]), 'cubic-bezier(0.2, 0.8, 0.2, 1)');
  });
  test('color and select pass through', () => {
    assert.equal(cssValue({ type: 'color' }, '#4f46e5'), '#4f46e5');
    assert.equal(cssValue({ type: 'select' }, 1.25), '1.25');
  });
});

describe('startValues', () => {
  const controls = [
    { key: 'a', value: 1 },
    { key: 'b', value: { x: 0, y: 0 } },
  ];
  const originals = originalsOf(controls);

  test('without stored values, starts from the originals', () => {
    assert.deepEqual(startValues(originals, null), { a: 1, b: { x: 0, y: 0 } });
  });
  test('overlays stored values for known keys', () => {
    assert.deepEqual(startValues(originals, { a: 5 }), { a: 5, b: { x: 0, y: 0 } });
  });
  test('drops stored keys that are no longer in the manifest', () => {
    assert.deepEqual(startValues(originals, { a: 5, gone: 9 }), { a: 5, b: { x: 0, y: 0 } });
  });
  test('returns copies, so edits do not leak into the originals', () => {
    const values = startValues(originals, null);
    values.b.x = 99;
    assert.equal(originals.b.x, 0);
    assert.equal(controls[1].value.x, 0);
  });
});

describe('ghostPercent', () => {
  test('maps the original into the slider range', () => {
    assert.equal(ghostPercent({ min: 0, max: 48 }, 24), 50);
    assert.equal(ghostPercent({ min: 10, max: 20 }, 10), 0);
  });
  test('clamps originals outside the range', () => {
    assert.equal(ghostPercent({ min: 0, max: 10 }, 20), 100);
    assert.equal(ghostPercent({ min: 0, max: 10 }, -5), 0);
  });
});

describe('clamp', () => {
  test('keeps the min when the range is inverted', () => {
    assert.equal(clamp(50, 8, 4), 8);
  });
});

describe('placePanel', () => {
  const panel = { width: 300, height: 400 };
  const viewport = { width: 1200, height: 800 };
  const rect = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height });

  test('goes right of the target when it fits', () => {
    assert.deepEqual(placePanel({ rect: rect(100, 100, 200, 100), panel, viewport }), { left: 312, top: 100 });
  });
  test('goes left when the right side is full', () => {
    assert.deepEqual(placePanel({ rect: rect(800, 100, 350, 100), panel, viewport }), { left: 488, top: 100 });
  });
  test('goes below when neither side fits', () => {
    assert.deepEqual(placePanel({ rect: rect(100, 50, 1000, 100), panel, viewport }), { left: 100, top: 162 });
  });
  test('goes above when below is full too', () => {
    assert.deepEqual(placePanel({ rect: rect(100, 500, 1000, 200), panel, viewport }), { left: 100, top: 88 });
  });
  test('hugs the roomier viewport edge when nothing fits', () => {
    assert.deepEqual(placePanel({ rect: rect(200, 100, 700, 600), panel, viewport }), { left: 892, top: 100 });
    assert.deepEqual(placePanel({ rect: rect(290, 100, 700, 600), panel, viewport }), { left: 8, top: 100 });
  });
  test('a dragged position wins over the target', () => {
    assert.deepEqual(placePanel({ rect: rect(100, 100, 200, 100), panel, viewport, dragged: { left: 50, top: 60 } }), { left: 50, top: 60 });
  });
  test('works without a target when dragged', () => {
    assert.deepEqual(placePanel({ rect: undefined, panel, viewport, dragged: { left: 50, top: 60 } }), { left: 50, top: 60 });
  });
  test('stays 8px inside the viewport', () => {
    assert.deepEqual(placePanel({ rect: rect(0, 0, 10, 10), panel, viewport, dragged: { left: -100, top: 5000 } }), { left: 8, top: 392 });
    assert.deepEqual(placePanel({ rect: rect(100, 700, 100, 50), panel, viewport }), { left: 212, top: 392 });
  });
});

describe('easing presets', () => {
  test('offers the six suggested curves', () => {
    assert.deepEqual(EASING_PRESETS.map((p) => p.name), ['ease-out', 'ease-in-out', 'linear', 'out-sine', 'out-quad', 'out-cubic']);
  });
  test('match a value to its preset', () => {
    assert.equal(matchPreset([0, 0, 1, 1]), 'linear');
    assert.equal(matchPreset([0.33, 1, 0.68, 1]), 'out-cubic');
  });
  test('tolerate rounding noise', () => {
    assert.equal(matchPreset([0.3301, 1, 0.6799, 1]), 'out-cubic');
  });
  test('return null for a custom curve', () => {
    assert.equal(matchPreset([0.2, 0.8, 0.2, 1]), null);
  });
});

describe('dock modes', () => {
  test('match the DevTools dock options', () => {
    assert.deepEqual(DOCK_MODES, ['float', 'left', 'bottom', 'right']);
  });
});
