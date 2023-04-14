declare module 'sse.js' {
  export type SSEEvent = { data: string; readyState: number };

  class SSE {
    constructor(
      url: string,
      options?: {
        headers: Record<string, string>;
        method: 'POST';
        payload: string;
      }
    );
    addEventListener(event: string, listener: (event: SSEEvent) => void): void;
    stream(): void;
    close(): void;
  }

  export { SSE };
}
