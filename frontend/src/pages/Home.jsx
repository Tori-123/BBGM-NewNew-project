import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import HomeGrid from "../components/HomeGrid";
import { ErrorBanner } from "../components/ui";
import { useLiveRefresh } from "../live";

export default function Home() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setReady(false);
    api
      .listPosts({ page: 1, pageSize: 20 })
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setTotal(data.total);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setItems([]);
        setTotal(0);
        setError(err);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshHome = useCallback(
    () =>
      api.listPosts({ page: 1, pageSize: 20 }).then((data) => {
        setItems(data.items);
        setTotal(data.total);
        setError(null);
      }),
    [],
  );

  useLiveRefresh(ready, refreshHome);

  return (
    <div>
      <ErrorBanner error={error} />
      <HomeGrid items={items} total={total} loading={loading} />
    </div>
  );
}
