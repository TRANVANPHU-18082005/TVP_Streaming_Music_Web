import { useSearchParams, type NavigateOptions } from "react-router-dom";
import { useCallback, useMemo, useRef } from "react";

export const useQueryParams = <T extends Record<string, unknown>>(
  defaultParams: T,
) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultsRef = useRef(defaultParams);

  const params = useMemo(() => {
    const defaults = defaultsRef.current;
    const result: Record<string, unknown> = { ...defaults };

    Object.keys(defaults).forEach((key) => {
      const urlValue = searchParams.get(key);
      if (urlValue === null) return;

      const defaultVal = defaults[key];
      if (typeof defaultVal === "number") {
        const n = Number(urlValue);
        if (!isNaN(n)) result[key] = n;
      } else if (typeof defaultVal === "boolean") {
        result[key] = urlValue === "true";
      } else {
        result[key] = urlValue;
      }
    });

    return result as T;
  }, [searchParams]);

  // 🔥 Fix ở đây: Thêm tham số options cho navigate
  const setParams = useCallback(
    (newParams: Partial<T>, options?: NavigateOptions) => {
      setSearchParams(
        (prev) => {
          const merged = Object.fromEntries(prev.entries());

          Object.entries(newParams).forEach(([key, val]) => {
            if (val === undefined || val === null) {
              delete merged[key];
            } else {
              merged[key] = String(val);
            }
          });

          return merged;
        },
        options, // ✅ Truyền options (như { replace: true }) vào đây mới đúng!
      );
    },
    [setSearchParams],
  );

  return { params, setParams, searchParams };
};
