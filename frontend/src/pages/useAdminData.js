import { useCallback, useEffect, useRef, useState } from "react";
import { socket } from "../services/socket";
import useAdminAuth from "./useAdminAuth";
const NO_EVENTS = [];
export default function useAdminData(loader, events = NO_EVENTS) {
  const { loading: authLoading } = useAdminAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const load = useCallback(async () => {
    if (authLoading) return;
    const request = ++sequence.current;
    setLoading(true);
    try {
      const result = await loader();
      if (request === sequence.current) { setData(result); setError(""); }
    } catch {
      if (request === sequence.current) setError("Маалыматты жүктөө мүмкүн болгон жок. Байланышты текшерип, кайра аракет кылыңыз.");
    } finally { if (request === sequence.current) setLoading(false); }
  }, [loader, authLoading]);
  const eventKey = events.join("|");
  useEffect(() => {
    load();
    const names = [...new Set([...eventKey.split("|").filter(Boolean), "connect"])];
    names.forEach(name => socket.on(name, load));
    return () => { sequence.current++; names.forEach(name => socket.off(name, load)); };
  }, [load, eventKey]);
  // Apply only the server-confirmed record before refetching the full list.
  const updateItem = useCallback(item => {
    if (!item?._id) return;
    setData(current => Array.isArray(current) ? current.map(existing => existing._id === item._id ? item : existing) : current);
  }, []);
  return { data, loading: authLoading || loading, error, load, updateItem };
}
