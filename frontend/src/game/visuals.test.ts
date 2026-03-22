import test from "node:test";
import assert from "node:assert/strict";

import { classifySurface, createBlockVisual } from "./visuals.ts";

test("docker rectangle texture is only used for 2:1 and 1:2 filled tech blocks", () => {
  assert.deepEqual(
    classifySurface("tech", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    { surfaceStyle: "textured", textureSrc: ["/texture-pack/docker-rect.png"] },
  );

  assert.deepEqual(
    classifySurface("tech", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ]),
    { surfaceStyle: "textured", textureSrc: ["/texture-pack/docker-rect.png"] },
  );
});

test("organization container spritesheet is used for all 3:2 and 2:3 filled blocks", () => {
  assert.deepEqual(
    classifySurface("tech", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ]),
    { surfaceStyle: "textured", textureSrc: ["/texture-pack/container_3-2_default_spritesheet.png"] },
  );

  assert.deepEqual(
    classifySurface("guard", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
    ]),
    { surfaceStyle: "textured", textureSrc: ["/texture-pack/container_3-2_default_spritesheet.png"] },
  );
});

test("all filled 2:2 blocks use the dedicated square container spritesheet", () => {
  assert.deepEqual(
    classifySurface("tech", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]),
    { surfaceStyle: "textured", textureSrc: ["/texture-pack/container_2-2_default_spritesheet.png"] },
  );

  assert.deepEqual(
    classifySurface("guard", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]),
    { surfaceStyle: "textured", textureSrc: ["/texture-pack/container_2-2_default_spritesheet.png"] },
  );
});

test("unsupported filled tech rectangles fall back to metal instead of letterboxed texture art", () => {
  assert.deepEqual(
    classifySurface("tech", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]),
    { surfaceStyle: "metal", textureSrc: null },
  );

  assert.deepEqual(
    classifySurface("tech", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]),
    { surfaceStyle: "metal", textureSrc: null },
  );
});

test("vertical docker rectangles rotate the texture instead of stretching it", () => {
  assert.deepEqual(
    createBlockVisual("tech", 0, [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ]),
    {
      surfaceStyle: "textured",
      textureSrc: "/texture-pack/docker-rect.png",
      textureRotation: Math.PI / 2,
    },
  );

  assert.deepEqual(
    createBlockVisual("tech", 0, [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    {
      surfaceStyle: "textured",
      textureSrc: "/texture-pack/docker-rect.png",
      textureRotation: 0,
    },
  );

  assert.deepEqual(
    createBlockVisual("audit", 0, [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
    ]),
    {
      surfaceStyle: "textured",
      textureSrc: "/texture-pack/container_3-2_default_spritesheet.png",
      textureRotation: Math.PI / 2,
    },
  );
});
