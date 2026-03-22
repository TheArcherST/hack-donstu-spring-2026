import assert from "node:assert/strict";
import test from "node:test";

import { BOARD_ROWS } from "./board.ts";
import { getSceneLayout } from "./scene.ts";

test("logical cable rows span the full pole height", () => {
  const layout = getSceneLayout(390, 844);
  const firstRowTop = layout.rowTops[0];
  const lastRowBottom = layout.rowTops[BOARD_ROWS - 1] + layout.cellSize;

  assert.ok(firstRowTop <= layout.poleTop);
  assert.ok(lastRowBottom >= layout.poleBottom);
});
