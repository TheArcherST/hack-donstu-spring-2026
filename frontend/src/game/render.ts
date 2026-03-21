import {
  BLOCK_COLORS,
  BOARD_COLS,
  BOARD_ROWS,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CELL_SIZE,
  FIELD_X,
  FIELD_Y,
} from "./constants";
import type { Cell, GameSnapshot, Piece } from "./types";

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawCell(ctx: CanvasRenderingContext2D, cell: Cell, col: number, row: number) {
  const x = FIELD_X + col * CELL_SIZE;
  const y = FIELD_Y + row * CELL_SIZE;
  const color = BLOCK_COLORS[cell.category];

  ctx.save();
  ctx.shadowBlur = cell.category === "guard" || cell.category === "audit" || cell.audited ? 16 : 6;
  ctx.shadowColor = cell.category === "guard" || cell.category === "audit" || cell.audited ? "#0077ff" : color;
  roundedRect(ctx, x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4, 9);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.globalAlpha = 0.2;
  ctx.fillStyle = "#ffffff";
  roundedRect(ctx, x + 5, y + 4, CELL_SIZE - 10, 9, 5);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = cell.audited ? "#d5f0ff" : "rgba(255,255,255,0.22)";
  roundedRect(ctx, x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4, 9);
  ctx.stroke();

  if (cell.fortified > 0 || cell.audited) {
    ctx.strokeStyle = "rgba(116, 212, 255, 0.9)";
    ctx.lineWidth = 2;
    roundedRect(ctx, x + 4.5, y + 4.5, CELL_SIZE - 9, CELL_SIZE - 9, 7);
    ctx.stroke();
  }

  if (cell.durability < cell.maxDurability) {
    ctx.strokeStyle = "rgba(17, 21, 29, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 10);
    ctx.lineTo(x + 16, y + 20);
    ctx.lineTo(x + 12, y + 28);
    ctx.moveTo(x + 24, y + 8);
    ctx.lineTo(x + 20, y + 18);
    ctx.lineTo(x + 28, y + 30);
    ctx.stroke();
  }

  if (cell.flash > 0) {
    ctx.globalAlpha = cell.flash * 0.35;
    ctx.fillStyle = "#ffffff";
    roundedRect(ctx, x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4, 9);
    ctx.fill();
  }
  ctx.restore();
}

function drawPiece(ctx: CanvasRenderingContext2D, piece: Piece) {
  for (const cell of piece.shape[piece.rotation % piece.shape.length]) {
    const row = piece.y + cell.y;
    if (row < 0) {
      continue;
    }
    drawCell(
      ctx,
      {
        category: piece.category,
        durability: 1,
        maxDurability: 1,
        fortified: piece.category === "guard" ? 1 : 0,
        audited: piece.category === "audit",
        flash: 0,
      },
      piece.x + cell.x,
      row,
    );
  }
}

function drawPreview(ctx: CanvasRenderingContext2D, piece: Piece) {
  const originX = 318;
  const originY = 164;
  ctx.save();
  roundedRect(ctx, originX - 16, originY - 26, 84, 96, 18);
  ctx.fillStyle = "rgba(11, 17, 25, 0.76)";
  ctx.fill();
  ctx.strokeStyle = "rgba(116, 212, 255, 0.18)";
  ctx.stroke();
  ctx.fillStyle = "#c8d4ea";
  ctx.font = "12px 'Open Sans', sans-serif";
  ctx.fillText("Следующий", originX, originY - 6);

  ctx.translate(originX, originY);
  for (const cell of piece.shape[0]) {
    const size = 18;
    const x = cell.x * size;
    const y = cell.y * size;
    ctx.fillStyle = BLOCK_COLORS[piece.category];
    roundedRect(ctx, x, y, size - 2, size - 2, 5);
    ctx.fill();
  }
  ctx.restore();
}

export function renderSnapshot(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot) {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const background = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  background.addColorStop(0, "#101622");
  background.addColorStop(0.55, "#11151d");
  background.addColorStop(1, "#081018");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.save();
  ctx.globalAlpha = 0.2;
  for (let index = 0; index < 24; index += 1) {
    ctx.strokeStyle = index % 2 === 0 ? "#0077ff" : "#5e2c2c";
    ctx.beginPath();
    ctx.moveTo(0, 40 + index * 32);
    ctx.lineTo(CANVAS_WIDTH, 10 + index * 32);
    ctx.stroke();
  }
  ctx.restore();

  const channelColor =
    snapshot.channelState === "guarded"
      ? "rgba(0, 119, 255, 0.22)"
      : snapshot.channelState === "partial"
        ? "rgba(255, 196, 86, 0.16)"
        : "rgba(255, 76, 76, 0.12)";
  ctx.fillStyle = channelColor;
  roundedRect(ctx, FIELD_X - 14, FIELD_Y - 18, BOARD_COLS * CELL_SIZE + 28, BOARD_ROWS * CELL_SIZE + 36, 28);
  ctx.fill();

  ctx.strokeStyle = "rgba(116, 212, 255, 0.22)";
  roundedRect(ctx, FIELD_X - 6, FIELD_Y - 8, BOARD_COLS * CELL_SIZE + 12, BOARD_ROWS * CELL_SIZE + 16, 20);
  ctx.stroke();

  for (let row = 0; row <= BOARD_ROWS; row += 1) {
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.moveTo(FIELD_X, FIELD_Y + row * CELL_SIZE);
    ctx.lineTo(FIELD_X + BOARD_COLS * CELL_SIZE, FIELD_Y + row * CELL_SIZE);
    ctx.stroke();
  }
  for (let col = 0; col <= BOARD_COLS; col += 1) {
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.moveTo(FIELD_X + col * CELL_SIZE, FIELD_Y);
    ctx.lineTo(FIELD_X + col * CELL_SIZE, FIELD_Y + BOARD_ROWS * CELL_SIZE);
    ctx.stroke();
  }

  ctx.fillStyle = "#dfe9f8";
  ctx.font = "600 18px 'Montserrat', sans-serif";
  ctx.fillText("Сайт недоступен", 30, 48);
  ctx.font = "13px 'Open Sans', sans-serif";
  ctx.fillStyle = snapshot.channelState === "guarded" ? "#8dd2ff" : "#ff8d8d";
  ctx.fillText(
    snapshot.channelState === "guarded" ? "Чистый сигнал стабилен" : "Канал под атакой, нужна защита",
    30,
    72,
  );

  ctx.fillStyle = "#c8d4ea";
  ctx.font = "12px 'Open Sans', sans-serif";
  ctx.fillText("Пользователь", 38, 106);
  ctx.fillText("Сервер", 52, 724);

  ctx.fillStyle = "#0d1420";
  roundedRect(ctx, 24, 84, 94, 38, 18);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.stroke();
  ctx.fillStyle = snapshot.channelState === "guarded" ? "#8dd2ff" : "#ffd2d2";
  ctx.font = "12px 'Open Sans', sans-serif";
  ctx.fillText(snapshot.routeCompleted ? "Маршрут есть" : "Нет соединения", 38, 107);

  ctx.fillStyle = "#0d1420";
  roundedRect(ctx, 24, 688, 106, 42, 18);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.stroke();
  ctx.fillStyle = "#b2c4df";
  ctx.fillText("Источник сигнала", 38, 714);

  for (const pulse of snapshot.attackPulses) {
    const y = FIELD_Y + pulse.row * CELL_SIZE + CELL_SIZE / 2;
    const progress = pulse.age / 350;
    const length = 48 + progress * 60;
    const gradient =
      pulse.side === "left"
        ? ctx.createLinearGradient(0, 0, length, 0)
        : ctx.createLinearGradient(CANVAS_WIDTH - length, 0, CANVAS_WIDTH, 0);
    gradient.addColorStop(0, "rgba(255,76,76,0)");
    gradient.addColorStop(1, "rgba(255,76,76,0.9)");
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 5 - progress * 3;
    ctx.beginPath();
    if (pulse.side === "left") {
      ctx.moveTo(0, y);
      ctx.lineTo(FIELD_X + 6, y);
    } else {
      ctx.moveTo(CANVAS_WIDTH, y);
      ctx.lineTo(FIELD_X + BOARD_COLS * CELL_SIZE - 6, y);
    }
    ctx.stroke();
  }

  snapshot.grid.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell) {
        drawCell(ctx, cell, colIndex, rowIndex);
      }
    });
  });

  if (snapshot.activePiece) {
    drawPiece(ctx, snapshot.activePiece);
  }

  for (const burst of snapshot.auditBursts) {
    const centerX = FIELD_X + burst.x * CELL_SIZE + CELL_SIZE / 2;
    const centerY = FIELD_Y + burst.y * CELL_SIZE + CELL_SIZE / 2;
    const progress = burst.age / 700;
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.strokeStyle = "rgba(116, 212, 255, 0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 20 + progress * 54, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawPreview(ctx, snapshot.nextPiece);

  if (snapshot.showHints) {
    ctx.fillStyle = "rgba(8, 16, 24, 0.88)";
    roundedRect(ctx, 140, 560, 232, 118, 20);
    ctx.fill();
    ctx.strokeStyle = "rgba(116, 212, 255, 0.28)";
    ctx.stroke();
    ctx.fillStyle = "#edf5ff";
    ctx.font = "600 14px 'Montserrat', sans-serif";
    ctx.fillText("Построй защищённый путь вверх", 156, 590);
    ctx.font = "12px 'Open Sans', sans-serif";
    ctx.fillStyle = "#b9cbe3";
    ctx.fillText("Синие блоки DDoS-Guard держат удар.", 156, 617);
    ctx.fillText("Модуль аудита лечит и усиливает участок.", 156, 639);
  }
}
