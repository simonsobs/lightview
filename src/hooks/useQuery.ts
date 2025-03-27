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
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let doSetValue = true;

    const fetchData = async () => {
      setIsLoading(true);
      setIsError(false);

      try {
        const result = await queryFn();
        if (doSetValue) setData(result);
      } catch (e) {
        if (doSetValue) {
          setIsError(true);
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

  return { data, isLoading, isError };
}
