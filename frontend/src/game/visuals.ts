import type { BlockCategory, BlockVisual, Point } from "./types";

const SQUARE_CONTAINER_TEXTURE = "/texture-pack/container_2-2_default_spritesheet.png";
const RECTANGLE_CONTAINER_TEXTURE = "/texture-pack/container_3-2_default_spritesheet.png";

const NORMAL_TEXTURES = [
  "/texture-pack/neutral_01.png",
  "/texture-pack/neutral_dark.png",
  "/texture-pack/neutral_signal.png",
];

const TECH_TEXTURES = [
  "/texture-pack/ddg_core.png",
  "/texture-pack/postgres.png",
  "/texture-pack/nginx.png",
  "/texture-pack/docker-squre.png",
  "/texture-pack/k8s.png",
];

const TECH_RECTANGLE_TEXTURES = [
  { ratio: 2, src: "/texture-pack/docker-rect.png" },
] as const;
const ROTATABLE_TEXTURES = [...TECH_RECTANGLE_TEXTURES.map((item) => item.src), RECTANGLE_CONTAINER_TEXTURE];

const CATEGORY_TEXTURES: Record<BlockCategory, string[]> = {
  normal: NORMAL_TEXTURES,
  tech: TECH_TEXTURES,
  guard: ["/texture-pack/ddg_shield.png"],
  audit: ["/texture-pack/audit_module.png"],
};

function getShapeBounds(points: Point[]) {
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );
}

function isFilledRectangle(points: Point[]) {
  const bounds = getShapeBounds(points);
  const width = bounds.maxX - bounds.minX + 1;
  const height = bounds.maxY - bounds.minY + 1;
  const fillsBounds = points.length === width * height;
  return { width, height, fillsBounds };
}

function getSupportedRectangleTexture(width: number, height: number) {
  const ratio = Math.max(width, height) / Math.min(width, height);
  const variant = TECH_RECTANGLE_TEXTURES.find((item) => item.ratio === ratio);
  return variant?.src ?? null;
}

function getTextureRotation(points: Point[], textureSrc: string[] | null) {
  if (
    !textureSrc?.[0] ||
    !ROTATABLE_TEXTURES.includes(textureSrc[0])
  ) {
    return 0;
  }

  const { width, height } = isFilledRectangle(points);
  return height > width ? Math.PI / 2 : 0;
}

export function classifySurface(category: BlockCategory, points: Point[]) {
  const { width, height, fillsBounds } = isFilledRectangle(points);
  if (!fillsBounds) {
    return { surfaceStyle: "metal" as const, textureSrc: null };
  }
  if (width === 2 && height === 2) {
    return { surfaceStyle: "textured" as const, textureSrc: [SQUARE_CONTAINER_TEXTURE] };
  }
  if ((width === 3 && height === 2) || (width === 2 && height === 3)) {
    return { surfaceStyle: "textured" as const, textureSrc: [RECTANGLE_CONTAINER_TEXTURE] };
  }
  if (width === height) {
    const textures = CATEGORY_TEXTURES[category];
    return { surfaceStyle: "textured" as const, textureSrc: textures };
  }
  if (category === "tech") {
    const rectangleTexture = getSupportedRectangleTexture(width, height);
    if (rectangleTexture) {
      return { surfaceStyle: "textured" as const, textureSrc: [rectangleTexture] };
    }
  }
  return { surfaceStyle: "metal" as const, textureSrc: null };
}

export function createBlockVisual(category: BlockCategory, seed: number, points: Point[]): BlockVisual {
  const surface = classifySurface(category, points);
  return {
    surfaceStyle: surface.surfaceStyle,
    textureSrc: surface.textureSrc ? surface.textureSrc[seed % surface.textureSrc.length] : null,
    textureRotation: getTextureRotation(points, surface.textureSrc),
  };
}
