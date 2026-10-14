export interface Anchor { left: number; top: number; right: number; bottom: number }
export function placePanel(view: { width: number; height: number; left?: number; top?: number }, anchor: Anchor | null) {
  const margin = 16, gap = 12;
  const minX = (view.left ?? 0) + margin, minY = (view.top ?? 0) + margin;
  const width = Math.min(320, Math.max(0, view.width - margin * 2));
  const height = Math.min(420, Math.max(0, view.height - margin * 2));
  const maxX = minX + view.width - margin * 2 - width, maxY = minY + view.height - margin * 2 - height;
  let left = minX + (maxX - minX) / 2, top = minY + (maxY - minY) / 2;
  if (anchor) {
    if (anchor.right + gap + width <= minX + view.width - margin * 2) { left = anchor.right + gap; top = anchor.top; }
    else if (anchor.left - gap - width >= minX) { left = anchor.left - gap - width; top = anchor.top; }
    else if (anchor.bottom + gap + height <= minY + view.height - margin * 2) { left = anchor.left; top = anchor.bottom + gap; }
    else { left = anchor.left; top = anchor.top - gap - height; }
  }
  return { left: Math.max(minX, Math.min(maxX, left)), top: Math.max(minY, Math.min(maxY, top)), width, height };
}
export function selectionAnchor(text: string): Anchor | null {
  const selection = window.getSelection();
  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ');
  if (!selection?.rangeCount || normalize(selection.toString()) !== normalize(text)) return null;
  const rects = [...selection.getRangeAt(0).getClientRects()];
  const visible = rects.filter(rect => rect.width && rect.height && rect.bottom > 0 && rect.top < innerHeight);
  const rect = visible[0];
  return rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } : null;
}
