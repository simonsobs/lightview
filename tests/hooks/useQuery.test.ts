import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

import { useQuery } from '../../src/hooks/useQuery';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

type Props = { queryFn: () => Promise<string>; queryKey: unknown[] };

describe('useQuery', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns initialData while the query is pending, then resolves', async () => {
    const deferred = createDeferred<string>();
    const queryFn = vi.fn(() => deferred.promise);

    const { result } = renderHook(() =>
      useQuery({ queryFn, queryKey: ['a'], initialData: 'initial' })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(true));
    expect(result.current.data).toBe('initial');
    expect(result.current.error).toBeNull();

    deferred.resolve('resolved-value');

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBe('resolved-value');
    expect(result.current.error).toBeNull();
  });

  it('sets error and logs it when the query rejects, leaving data unchanged', async () => {
    const error = new Error('boom');
    const queryFn = vi.fn(() => Promise.reject(error));
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const { result } = renderHook(() =>
      useQuery({ queryFn, queryKey: ['a'], initialData: 'initial' })
    );

    await waitFor(() => expect(result.current.error).toBe(error));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBe('initial');
    expect(consoleErrorSpy).toHaveBeenCalledWith(String(error));
  });

  it('refetches when the queryKey changes', async () => {
    const queryFnA = vi.fn(() => Promise.resolve('a-value'));
    const queryFnB = vi.fn(() => Promise.resolve('b-value'));

    const { result, rerender } = renderHook<
      ReturnType<typeof useQuery<string>>,
      Props
    >(
      ({ queryFn, queryKey }) =>
        useQuery({ queryFn, queryKey, initialData: 'initial' }),
      {
        initialProps: { queryFn: queryFnA, queryKey: ['a'] },
      }
    );

    await waitFor(() => expect(result.current.data).toBe('a-value'));

    rerender({ queryFn: queryFnB, queryKey: ['b'] });

    await waitFor(() => expect(result.current.data).toBe('b-value'));
    expect(queryFnA).toHaveBeenCalledTimes(1);
    expect(queryFnB).toHaveBeenCalledTimes(1);
  });

  it('ignores a stale response if the query key changes before the previous fetch resolves', async () => {
    const deferredA = createDeferred<string>();
    const deferredB = createDeferred<string>();
    const queryFnA = vi.fn(() => deferredA.promise);
    const queryFnB = vi.fn(() => deferredB.promise);

    const { result, rerender } = renderHook<
      ReturnType<typeof useQuery<string>>,
      Props
    >(
      ({ queryFn, queryKey }) =>
        useQuery({ queryFn, queryKey, initialData: 'initial' }),
      {
        initialProps: { queryFn: queryFnA, queryKey: ['a'] },
      }
    );

    rerender({ queryFn: queryFnB, queryKey: ['b'] });

    deferredB.resolve('b-value');
    await waitFor(() => expect(result.current.data).toBe('b-value'));

    await act(async () => {
      deferredA.resolve('a-value');
      await Promise.resolve();
    });

    expect(result.current.data).toBe('b-value');
  });
});
