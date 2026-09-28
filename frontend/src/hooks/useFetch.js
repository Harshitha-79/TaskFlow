import { useCallback, useEffect, useRef, useState } from 'react';
import { errMsg } from '../services/utils';

export default function useFetch(fetcher, key) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const fetcherRef = useRef(fetcher);
  const [request, setRequest] = useState({ id: 0, silent: false });
  const [completed, setCompleted] = useState({ key: null, id: -1 });
  const requestId = request.id;

  useEffect(() => { fetcherRef.current = fetcher; }, [fetcher]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const result = await fetcherRef.current();
        if (active) { setData(result); setError(''); }
      } catch (e) {
        if (active) setError(errMsg(e));
      } finally {
        if (active) setCompleted({ key, id: requestId });
      }
    };
    run();
    return () => { active = false; };
  }, [key, requestId]);

  const load = useCallback((silent = false) => {
    setRequest((current) => ({ id: current.id + 1, silent }));
  }, []);
  const loading = completed.key !== key || (completed.id !== requestId && !request.silent);

  return { data, loading, error, reload: load };
}