// src/engine/PlayerSprites.ts

// ============================================================
// [🧱 BLOCK: PlayerSprites Singleton]
// Images are created lazily on first access — never at module
// evaluation time — so Next.js SSR never touches `new Image()`.
// All drawing code calls getPlayerSprites(), which is always
// invoked from canvas draw paths (guaranteed client-side).
// ============================================================

export interface PlayerSpriteSet {
  head:        HTMLImageElement;
  body:        HTMLImageElement;
  feetIdle:    HTMLImageElement;
  feetMoving1: HTMLImageElement;
  feetMoving2: HTMLImageElement;
  ready:       boolean;
}

// ============================================================
// [🧱 BLOCK: Lazy Loader]
// Created once on first getPlayerSprites() call, then cached.
// ============================================================
let _sprites: PlayerSpriteSet | null = null;

function loadImage(src: string): HTMLImageElement {
  const img = new window.Image();
  img.src   = src;
  return img;
}

export function getPlayerSprites(): PlayerSpriteSet {
  if (_sprites) return _sprites;

  const head        = loadImage('/assets/sprites/player/head.png');
  const body        = loadImage('/assets/sprites/player/body.png');
  const feetIdle    = loadImage('/assets/sprites/player/feet_idle.png');
  const feetMoving1 = loadImage('/assets/sprites/player/feet_moving1.png');
  const feetMoving2 = loadImage('/assets/sprites/player/feet_moving2.png');

  _sprites = {
    head,
    body,
    feetIdle,
    feetMoving1,
    feetMoving2,
    get ready(): boolean {
      return (
        head.complete        && head.naturalWidth        > 0 &&
        body.complete        && body.naturalWidth        > 0 &&
        feetIdle.complete    && feetIdle.naturalWidth    > 0 &&
        feetMoving1.complete && feetMoving1.naturalWidth > 0 &&
        feetMoving2.complete && feetMoving2.naturalWidth > 0
      );
    },
  };

  return _sprites;
}