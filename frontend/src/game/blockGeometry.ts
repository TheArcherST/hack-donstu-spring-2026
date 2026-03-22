export interface BlockCellPoint {
  col: number;
  row: number;
}

export interface BlockCellRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BlockPaintGrid {
  boardLeft: number;
  boardTop: number;
  boardCols: number;
  boardRows: number;
  cellSize: number;
  cellGap: number;
  rowGap: number;
}

export interface BlockGeometryRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getAxisBoundary(index: number, start: number, size: number, gap: number, count: number) {
  if (index <= 0) {
    return start;
  }

  if (index >= count) {
    return start + count * size + Math.max(0, count - 1) * gap;
  }

  return start + index * size + (index - 0.5) * gap;
}

export function getCellPaintRect(grid: BlockPaintGrid, col: number, row: number): BlockCellRect {
  const left = getAxisBoundary(col, grid.boardLeft, grid.cellSize, grid.cellGap, grid.boardCols);
  const right = getAxisBoundary(col + 1, grid.boardLeft, grid.cellSize, grid.cellGap, grid.boardCols);
  const top = getAxisBoundary(row, grid.boardTop, grid.cellSize, grid.rowGap, grid.boardRows);
  const bottom = getAxisBoundary(row + 1, grid.boardTop, grid.cellSize, grid.rowGap, grid.boardRows);

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

export function buildBlockGeometry(
  cells: BlockCellPoint[],
  getCellRect: (col: number, row: number) => BlockCellRect,
): BlockGeometryRect[] {
  return cells.map((cell) => getCellRect(cell.col, cell.row));
}
