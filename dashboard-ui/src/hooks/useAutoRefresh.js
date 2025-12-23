import { useEffect, useRef } from "react";

export function useAutoRefresh(fn, intervalMs = 15000, enabled = true) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => fnRef.current?.(), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs, enabled]);
}
