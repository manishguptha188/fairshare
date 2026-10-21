import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../api.js';

// Loads `path` from the API and tracks the three states every screen needs: loading, error and data.
// `reload()` fetches again (after a change), keeping the old data on screen until the new data arrives.
export function useApi(path) {
  const [version, setVersion] = useState(0);
  const requestKey = `${path}#${version}`;
  // `key` records which request the result belongs to. Loading isn't stored separately: we are loading
  // whenever the latest result is for an older request.
  const [result, setResult] = useState({ key: null, data: null, error: null });

  useEffect(() => {
    // Aborting on cleanup means a slow, out-of-date response (say, for the previous page) can never
    // overwrite the data for the page the user is looking at now.
    const controller = new AbortController();

    apiRequest(path, { signal: controller.signal })
      .then((data) => setResult({ key: requestKey, data, error: null }))
      .catch((error) => {
        if (error.name !== 'AbortError') setResult((previous) => ({ key: requestKey, data: previous.data, error }));
      });

    return () => controller.abort();
  }, [path, requestKey]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data: result.data, error: result.error, isLoading: result.key !== requestKey, reload };
}
