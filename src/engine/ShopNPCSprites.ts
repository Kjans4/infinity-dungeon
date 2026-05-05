// src/engine/ShopNPCSprites.ts

// ============================================================
// [🧱 BLOCK: ShopNPC Sprite Singleton]
// Lazy-loaded on first access — never at module eval time so
// Next.js SSR never touches `new Image()`.
// Only two layers: body (static) + head (breathe animation).
// ============================================================

export interface ShopNPCSpriteSet {
  head:  HTMLImageElement;
  body:  HTMLImageElement;
  ready: boolean;
}

let _sprites: ShopNPCSpriteSet | null = null;

function loadImage(src: string): HTMLImageElement {
  const img = new window.Image();
  img.src   = src;
  return img;
}

export function getShopNPCSprites(): ShopNPCSpriteSet {
  if (_sprites) return _sprites;

  const head = loadImage('/assets/sprites/shopnpc/shopnpc_head.png');
  const body = loadImage('/assets/sprites/shopnpc/shopnpc_body.png');

  _sprites = {
    head,
    body,
    get ready(): boolean {
      return (
        head.complete && head.naturalWidth > 0 &&
        body.complete && body.naturalWidth > 0
      );
    },
  };

  return _sprites;
}