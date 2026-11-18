// PNG 아이콘을 노트 색에 맞춰 칠해서 그린다.
// 원본은 검은 선이라 어두운 테마에서 안 보이므로, 잉크색으로 다시 칠한 사본을 만들어 쓴다.

export interface Sprite {
  img: HTMLImageElement;
  /** 그릴 준비가 됐는지 */
  ok(): boolean;
  w(): number;
  h(): number;
}

export function loadSprite(url: string): Sprite {
  const img = new Image();
  img.src = url;
  return { img, ok: () => img.complete && img.naturalWidth > 0, w: () => img.naturalWidth, h: () => img.naturalHeight };
}

const cache = new Map<string, HTMLCanvasElement>();

/** 그림의 불투명한 부분을 한 가지 색으로 칠한 사본 (색마다 한 번만 만든다) */
function tinted(sp: Sprite, color: string): HTMLCanvasElement | null {
  if (!sp.ok()) return null;
  const key = `${sp.img.src}|${color}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = sp.w();
  cv.height = sp.h();
  const c = cv.getContext('2d')!;
  c.drawImage(sp.img, 0, 0);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = color;
  c.fillRect(0, 0, cv.width, cv.height);
  cache.set(key, cv);
  return cv;
}

/** 테마가 바뀌면 칠해 둔 사본을 버린다 */
export function clearTints(): void {
  cache.clear();
}

export function drawSprite(
  c: CanvasRenderingContext2D,
  sp: Sprite,
  x: number,
  y: number,
  w: number,
  h: number,
  o: { color?: string; alpha?: number } = {},
): boolean {
  const src = o.color ? tinted(sp, o.color) : sp.ok() ? sp.img : null;
  if (!src) return false;
  c.save();
  if (o.alpha != null) c.globalAlpha = o.alpha;
  c.drawImage(src, x, y, w, h);
  c.restore();
  return true;
}
