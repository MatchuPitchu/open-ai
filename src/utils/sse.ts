// Basic sse.js, but completely refactored:
// - Converted the code to TypeScript.
// - Changed SSE to a class instead of using the constructor function.
// - Added type annotations to improve type safety and readability.1
// - Updated CustomEvent usage for better compatibility with TypeScript.
// - Made use of some modern TypeScript features such as optional chaining and nullish coalescing.

enum SSEState {
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

export type ReadyStateEventData = Record<'readyState', SSEState>;
export type MessageEventData = Record<'data' | 'id', string>;
type ErrorEventData = Record<'data', string>;

type ReadyStateEventHandlerType = (event: CustomEvent<ReadyStateEventData>) => void;
type MessageEventHandlerType = (event: CustomEvent<MessageEventData>) => void;
type ErrorEventHandlerType = (event: CustomEvent<ErrorEventData>) => void;
type UnknownEventHandlerType = (event: CustomEvent<unknown>) => void;

type EventHandlerType =
  | ReadyStateEventHandlerType
  | MessageEventHandlerType
  | ErrorEventHandlerType
  | UnknownEventHandlerType;

type EventListenerTyp = 'message' | 'readystatechange' | 'load' | 'progress' | 'abort' | 'error';

const FIELD_SEPARATOR = ':';

export class SSE {
  xhr: XMLHttpRequest | null;
  readyState: number;
  progress: number;
  chunk: string;
  listeners: Record<EventListenerTyp, EventHandlerType[]>;

  constructor(public url: string, public options: RequestOptions) {
    this.xhr = null;
    this.readyState = SSEState.INITIALIZING;
    this.progress = 0;
    this.chunk = '';
    this.listeners = {
      message: [],
      readystatechange: [],
      load: [],
      progress: [],
      abort: [],
      error: []
    };
  }

  addEventListener(type: EventListenerTyp, listener: EventHandlerType) {
    if (!this.listeners[type].includes(listener)) {
      this.listeners[type].push(listener);
    }
  }

  removeEventListener(type: EventListenerTyp, listener: EventHandlerType) {
    const listeners = this.listeners[type];
    if (!listeners) return;

    const retainedListeners = listeners.filter((element) => element !== listener);
    if (retainedListeners.length === 0) {
      delete this.listeners[type];
    } else {
      this.listeners[type] = retainedListeners;
    }
  }

  // TODO: solve type problem
  dispatchEvent(event: CustomEvent<any>): boolean {
    if (!event) return true;

    const listeners = this.listeners[event.type as EventListenerTyp];
    if (listeners && listeners.length > 0) {
      return listeners.every((callback) => {
        callback(event);
        return !event.defaultPrevented;
      });
    }

    return true;
  }

  private _setReadyState(state: SSEState) {
    const event = new CustomEvent('readystatechange', { detail: { readyState: state } });
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

    if (this.readyState === SSEState.CONNECTING) {
      const event = new CustomEvent('open');
      this.dispatchEvent(event);
      this._setReadyState(SSEState.OPEN);
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

  /**
   * Parse a received SSE event chunk into a constructed event object.
   */
  private _parseEventChunk(chunk: string): CustomEvent<MessageEventData> | null {
    if (!chunk || chunk.length === 0) return null;

    const event = { id: '', retry: '', data: '', event: 'message' } satisfies Record<
      'id' | 'retry' | 'data' | 'event',
      string
    >;
    chunk.split(/\r\n|\r|\n/).forEach((line) => {
      line = line.trimEnd();
      const index = line.indexOf(FIELD_SEPARATOR);
      if (index <= 0) {
        // Line was either empty, or started with a separator and is a comment.
        // Either way, ignore.
        return;
      }

      const field = line.substring(0, index) as keyof typeof event;
      if (!(field in event)) return;

      const value = line.substring(index + 1).trimStart();
      if (field === 'data') {
        event[field] += value;
      } else {
        event[field] = value;
      }
    });

    const customEvent = new CustomEvent(event.event, { detail: { data: event.data, id: event.id } });
    return customEvent;
  }

  private _checkStreamClosed() {
    if (!this.xhr) return;

    if (this.xhr.readyState === XMLHttpRequest.DONE) {
      this._setReadyState(SSEState.CLOSED);
    }
  }

  stream() {
    this._setReadyState(SSEState.CONNECTING);

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
    if (this.readyState === SSEState.CLOSED) return;

    this.xhr?.abort();
    this.xhr = null;

    this._setReadyState(SSEState.CLOSED);
  }
}
