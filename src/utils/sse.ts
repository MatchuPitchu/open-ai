// Basic sse.js, but completely refactored:
// - Converted the code to TypeScript.
// - Changed SSE to a class instead of using the constructor function.
// - Added type annotations to improve type safety and readability.1
// - Updated CustomEvent usage for better compatibility with TypeScript.
// - Made use of some modern TypeScript features such as optional chaining and nullish coalescing.

export enum SourceState {
  INITIALIZING = -1,
  CONNECTING = 0,
  OPEN = 1,
  CLOSED = 2
}

export type RequestOptions = {
  headers: Record<string, string>;
  method: 'POST' | 'GET';
  body?: string;
  withCredentials: boolean;
};

export type MessageEventData = Record<'data', string>;

type EventHandler = <T>(event: CustomEvent<T>) => void;
type EventListener = 'message' | 'readystatechange' | 'load' | 'progress' | 'abort' | 'error';
type EventListenersObject = Record<EventListener, (<T>(event: CustomEvent<T>) => void)[]>;

export const isMessageEventData = (event: CustomEvent): event is CustomEvent<MessageEventData> => {
  return 'data' in event.detail;
};

const getInitialListeners = () => ({
  message: [],
  readystatechange: [],
  load: [],
  progress: [],
  abort: [],
  error: []
});

export class SSE {
  constructor(
    private url: string,
    private options: RequestOptions,
    private xhr: XMLHttpRequest | null = null,
    public readyState: SourceState = SourceState.INITIALIZING,
    public progress: number = 0,
    private chunk: string = '',
    private listeners: EventListenersObject = getInitialListeners()
  ) {}

  addEventListener(type: EventListener, eventHandler: EventHandler) {
    if (!this.listeners[type].includes(eventHandler)) {
      this.listeners[type].push(eventHandler);
    }
  }

  removeEventListener(type: EventListener, eventHandler: EventHandler) {
    const eventHandlers = this.listeners[type];
    const retainedEventHandlers = eventHandlers.filter((element) => element !== eventHandler);
    this.listeners[type] = retainedEventHandlers;
  }

  dispatchEvent<T>(event: CustomEvent<T>) {
    const eventHandlers = this.listeners[event.type as EventListener];
    if (!eventHandlers || eventHandlers.length === 0) return;

    for (const eventHandler of eventHandlers) {
      eventHandler(event);
    }
  }

  private _setReadyState(state: SourceState) {
    const event = new CustomEvent('readystatechange');
    this.readyState = state;
    this.dispatchEvent(event);
  }

  private _onStreamFailure(progressEvent: ProgressEvent) {
    const xhr = progressEvent.currentTarget as XMLHttpRequest;
    const event = new CustomEvent('error', {
      detail: { data: xhr.responseText }
    });

    this.dispatchEvent(event);
    this.close();
  }

  private _onStreamAbort() {
    const event = new CustomEvent('abort');
    this.dispatchEvent(event);
    this.close();
  }

  private _onStreamProgress(progressEvent: ProgressEvent) {
    if (!this.xhr) return;

    if (this.xhr.status !== 200) {
      this._onStreamFailure(progressEvent);
      return;
    }

    if (this.readyState === SourceState.CONNECTING) {
      const event = new CustomEvent('open');
      this.dispatchEvent(event);
      this._setReadyState(SourceState.OPEN);
    }

    const data = this.xhr.responseText.substring(this.progress);
    this.progress += data.length;

    const parts = data.split(/(\r\n|\r|\n){2}/g);
    const numParts = parts.length;
    for (let i = 0; i < numParts; i++) {
      const part = parts[i];
      if (part.trim().length === 0) {
        const event = this._parseEventChunk(this.chunk.trim());
        if (event) {
          this.dispatchEvent(event);
        }
        this.chunk = '';
      } else {
        this.chunk += part;
      }
    }
  }

  private _onStreamLoaded(progessEvent: ProgressEvent) {
    this._onStreamProgress(progessEvent);

    // Parse the last chunk.
    const event = this._parseEventChunk(this.chunk);
    if (event) {
      this.dispatchEvent(event);
    }
    this.chunk = '';
  }

  // parse a received SSE event chunk into a constructed event object
  private _parseEventChunk(chunk: string): CustomEvent<MessageEventData> | null {
    if (!chunk || chunk.length === 0) return null;

    const event = { type: 'message', data: '' } satisfies { type: 'message'; data: string };
    chunk.split(/\r\n|\r|\n/).forEach((line) => {
      line = line.trimEnd();
      if (line.startsWith('data:')) {
        const newData = line.replaceAll(/(\n)?^data:\s*/g, '');
        event.data += newData;
      }
    });

    return new CustomEvent(event.type, { detail: { data: event.data } });
  }

  private _checkStreamClosed() {
    if (!this.xhr) return;

    if (this.xhr.readyState === XMLHttpRequest.DONE) {
      this._setReadyState(SourceState.CLOSED);
    }
  }

  stream() {
    this._setReadyState(SourceState.CONNECTING);

    this.xhr = new XMLHttpRequest();
    // using => syntax avoids the need to bind the this context manually with bind().
    this.xhr.addEventListener('progress', (event: ProgressEvent) => this._onStreamProgress(event));
    this.xhr.addEventListener('load', (event: ProgressEvent) => this._onStreamLoaded(event));
    this.xhr.addEventListener('readystatechange', () => this._checkStreamClosed());
    this.xhr.addEventListener('error', (event: ProgressEvent) => this._onStreamFailure(event));
    this.xhr.addEventListener('abort', () => this._onStreamAbort());

    this.xhr.open(this.options.method, this.url);
    for (const key in this.options.headers) {
      this.xhr.setRequestHeader(key, this.options.headers[key]);
    }
    this.xhr.withCredentials = this.options.withCredentials;
    this.xhr.send(this.options.body);
  }

  close() {
    if (this.readyState === SourceState.CLOSED) return;

    this.xhr?.abort();
    this.xhr = null;

    this._setReadyState(SourceState.CLOSED);
  }
}
