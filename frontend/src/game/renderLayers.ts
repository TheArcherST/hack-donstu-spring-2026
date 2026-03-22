export const SCENE_LAYER_ORDER = ["background", "foreground", "blocks", "pole", "effects"] as const;
export type SceneLayer = (typeof SCENE_LAYER_ORDER)[number];
