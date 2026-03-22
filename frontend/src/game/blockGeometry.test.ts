import test from "node:test";
import assert from "node:assert/strict";

import { buildBlockGeometry, getCellPaintRect, type BlockGeometryRect } from "./blockGeometry.ts";

function covers(rects: BlockGeometryRect[], x: number, y: number) {
  return rects.some((rect) => x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height);
}

const grid = {
  boardLeft: 0,
  boardTop: 0,
  boardCols: 8,
  boardRows: 16,
  cellSize: 10,
  cellGap: 2,
  rowGap: 4,
};

test("adjacent columns share the same seam without a gap or overlap", () => {
  const left = getCellPaintRect(grid, 0, 0);
  const right = getCellPaintRect(grid, 1, 0);

  assert.equal(left.x + left.width, right.x, "neighboring columns must meet on the same boundary");
  assert.equal(left.x, 0, "the first column should stay anchored to the board edge");
});

test("adjacent rows share the same seam without a gap or overlap", () => {
  const top = getCellPaintRect(grid, 0, 0);
  const bottom = getCellPaintRect(grid, 0, 1);

  assert.equal(top.y + top.height, bottom.y, "neighboring rows must meet on the same boundary");
  assert.equal(top.y, 0, "the first row should stay anchored to the board edge");
});

test("separate installed blocks still tile the board continuously", () => {
  const leftBlock = buildBlockGeometry([{ col: 0, row: 0 }], (col, row) => getCellPaintRect(grid, col, row));
  const rightBlock = buildBlockGeometry([{ col: 1, row: 0 }], (col, row) => getCellPaintRect(grid, col, row));

  const union = [...leftBlock, ...rightBlock];
  assert.ok(covers(union, 10.5, 5), "the visual seam between two settled blocks should be filled");
});

test("solid 2x2 pieces stay filled in the center junction", () => {
  const rects = buildBlockGeometry(
    [
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 0, row: 1 },
      { col: 1, row: 1 },
    ],
    (col, row) => getCellPaintRect(grid, col, row),
  );

  assert.ok(covers(rects, 10.5, 13), "the center junction should stay filled for a solid 2x2 piece");
});
