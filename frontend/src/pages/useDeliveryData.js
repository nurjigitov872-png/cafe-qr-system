import { useCallback, useEffect, useRef, useState } from "react";

export default function useDeliveryData(loader, enabled = true) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const current = useRef(0);
  const load = useCallback(async () => {
    if (!enabled) return;
    const sequence = ++current.current;
    try {
      const result = await loader();
      if (sequence === current.current) { setData(result); setError(null); }
    } catch (reason) {
      if (sequence === current.current) {
        setError(reason);
        if ([401, 403, 404].includes(reason.status)) setData(null);
      }
    }
  }, [loader, enabled]);
  useEffect(() => {
    setData(null);
    setError(null);
    if (!enabled) return;
    load();
    const timer = setInterval(load, 15000);
    for (const event of ["cafe:delivery-update", "cafe:order-refresh"]) window.addEventListener(event, load);
    return () => {
      current.current++;
      clearInterval(timer);
      for (const event of ["cafe:delivery-update", "cafe:order-refresh"]) window.removeEventListener(event, load);
    };
  }, [load, enabled]);
  return { data, error, load };
}
