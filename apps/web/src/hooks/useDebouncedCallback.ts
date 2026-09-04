import { useCallback, useEffect, useRef } from "react";

/** Fires `fn` once the caller stops calling it for `delay` milliseconds. */
export function useDebouncedCallback<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay = 400,
): (...args: Args) => void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(fn);

  useEffect(() => {
    latest.current = fn;
  }, [fn]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return useCallback(
    (...args: Args) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => latest.current(...args), delay);
    },
    [delay],
  );
}
