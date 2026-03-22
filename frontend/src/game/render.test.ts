import assert from "node:assert/strict";
import test from "node:test";

import { getContainerSpritesheetFrame } from "./render.ts";
import { getFittedDrawRect, getTextureContainSize } from "./renderMath.ts";
import { SCENE_LAYER_ORDER } from "./renderLayers.ts";

test("scene layers keep the declared visual stacking contract", () => {
  assert.deepEqual(SCENE_LAYER_ORDER, ["background", "foreground", "blocks", "pole", "effects"]);
});

test("contain fit preserves the source aspect ratio", () => {
  const rect = getFittedDrawRect(2048, 1024, { x: 0, y: 0, width: 120, height: 120 }, "contain");

  assert.equal(rect.width / rect.height, 2);
  assert.equal(rect.width, 120);
  assert.equal(rect.height, 60);
  assert.equal(rect.y, 30);
});

test("cover fit preserves the source aspect ratio while covering the target rect", () => {
  const rect = getFittedDrawRect(246, 1526, { x: 0, y: 0, width: 150, height: 320 }, "cover");

  assert.equal(rect.width / rect.height, 246 / 1526);
  assert.ok(rect.width >= 150);
  assert.ok(rect.height >= 320);
});

test("rotated contain sizing keeps texture proportions for vertical slots", () => {
  const rotated = getTextureContainSize(2048, 1024, 40, 80, Math.PI / 2);
  const unrotated = getTextureContainSize(2048, 1024, 40, 80, 0);

  assert.equal(rotated.drawWidth / rotated.drawHeight, 2);
  assert.equal(rotated.drawWidth, 80);
  assert.equal(rotated.drawHeight, 40);
  assert.equal(unrotated.drawWidth, 40);
  assert.equal(unrotated.drawHeight, 20);
});

test("square container spritesheet picks its built-in damage frames", () => {
  assert.equal(getContainerSpritesheetFrame("/texture-pack/container_2-2_default_spritesheet.png", 3, 3), 0);
  assert.equal(getContainerSpritesheetFrame("/texture-pack/container_2-2_default_spritesheet.png", 2, 3), 1);
  assert.equal(getContainerSpritesheetFrame("/texture-pack/container_2-2_default_spritesheet.png", 1, 3), 2);
  assert.equal(getContainerSpritesheetFrame("/texture-pack/container_3-2_default_spritesheet.png", 4, 4), 0);
  assert.equal(getContainerSpritesheetFrame("/texture-pack/container_3-2_default_spritesheet.png", 2, 4), 1);
  assert.equal(getContainerSpritesheetFrame("/texture-pack/container_3-2_default_spritesheet.png", 1, 4), 2);
  assert.equal(getContainerSpritesheetFrame("/texture-pack/docker-squre.png", 1, 3), null);
});
