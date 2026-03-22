import test from "node:test";
import assert from "node:assert/strict";

import { MAX_GAME_VIEWPORT_ASPECT, MIN_GAME_VIEWPORT_ASPECT, fitViewport } from "./viewport.ts";

test("fitViewport widens the viewport on desktop but keeps it centered", () => {
  const viewport = fitViewport(1440, 900);

  assert.equal(viewport.height, 900);
  assert.equal(viewport.width, Math.round(900 * MAX_GAME_VIEWPORT_ASPECT));
  assert.ok(viewport.offsetX > 0);
  assert.equal(viewport.offsetY, 0);
});

test("fitViewport keeps the canonical portrait aspect on tall mobile containers", () => {
  const viewport = fitViewport(360, 800);

  assert.equal(viewport.aspect, MIN_GAME_VIEWPORT_ASPECT);
  assert.equal(viewport.width, 360);
  assert.equal(viewport.height, Math.round(360 / MIN_GAME_VIEWPORT_ASPECT));
  assert.equal(viewport.offsetX, 0);
  assert.equal(viewport.offsetY, 800 - viewport.height);
});

test("fitViewport uses the full shorter mobile viewport when the device is less tall", () => {
  const viewport = fitViewport(390, 760);

  assert.equal(viewport.width, 390);
  assert.equal(viewport.height, 760);
  assert.ok(viewport.aspect > MIN_GAME_VIEWPORT_ASPECT);
});
