import { useEffect } from 'react';

// Calls `handler` when a pointerdown happens outside the element referenced by `ref`.
// Used to dismiss dropdowns/popovers when the user clicks elsewhere.
export default function useClickOutside(ref, handler, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const onPointerDown = (event) => {
      const el = ref.current;
      if (!el || el.contains(event.target)) return;
      handler(event);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [ref, handler, active]);
}
