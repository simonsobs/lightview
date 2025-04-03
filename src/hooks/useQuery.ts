import { useState, useEffect } from 'react';

type UseQueryParams<T> = {
  queryFn: () => Promise<T>;
  queryKey: unknown[];
  initialData: T;
};

export function useQuery<T>({
  queryFn,
  queryKey,
  initialData,
}: UseQueryParams<T>) {
  const [data, setData] = useState<T>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<null | Error>(null);

  useEffect(() => {
    let doSetValue = true;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await queryFn();
        if (doSetValue) setData(result);
      } catch (e) {
        if (doSetValue) {
          setError(e as Error);
          console.error(String(e));
        }
      }
      setIsLoading(false);
    };
    void fetchData();
    return () => {
      doSetValue = false;
    };
  }, queryKey);

  return { data, isLoading, error };
}
