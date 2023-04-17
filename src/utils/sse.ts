// Changes made:
// - Converted the code to TypeScript.
// - Changed SSE to a class instead of using the constructor function.
// - Added type annotations to improve type safety and readability.1
// - Updated CustomEvent usage for better compatibility with TypeScript.
// - Made use of some modern TypeScript features such as optional chaining and nullish coalescing.

class SSE {
  private readonly INITIALIZING = -1;
  private readonly CONNECTING = 0;
  private readonly OPEN = 1;
  private readonly CLOSED = 2;

  private readonly FIELD_SEPARATOR = ':';

  url: string;
  headers: { [key: string]: string };
  payload: string;
  method: string;
  withCredentials: boolean;

  xhr: XMLHttpRequest | null;
  readyState: number;
  progress: number;
  chunk: string;

  listeners: { [key: string]: ((event: CustomEvent) => void)[] };

  constructor(
    url: string,
    options: Partial<{
      headers: { [key: string]: string };
      payload: string;
      method: string;
      withCredentials: boolean;
    }> = {}
  ) {
    this.url = url;

    this.headers = options.headers || {};
    this.payload = options.payload !== undefined ? options.payload : '';
    this.method = options.method || (this.payload ? 'POST' : 'GET');
    this.withCredentials = !!options.withCredentials;

    this.listeners = {};
    this.xhr = null;
    this.readyState = this.INITIALIZING;
    this.progress = 0;
    this.chunk = '';
  }

  addEventListener(type: string, listener: (event: CustomEvent) => void): void {
    if (this.listeners[type] === undefined) {
      this.listeners[type] = [];
    }

    if (this.listeners[type].indexOf(listener) === -1) {
      this.listeners[type].push(listener);
    }
  }

  removeEventListener(type: string, listener: (event: CustomEvent) => void): void {
    if (this.listeners[type] === undefined) {
      return;
    }

    const filtered = this.listeners[type].filter((element) => element !== listener);
    if (filtered.length === 0) {
      delete this.listeners[type];
    } else {
      this.listeners[type] = filtered;
    }
  }

  dispatchEvent(e: CustomEvent): boolean {
    if (!e) {
      return true;
    }

    e.initCustomEvent(e.type, true, true, { source: this });

    const onHandler = 'on' + e.type;
    if ((this as any).hasOwnProperty(onHandler)) {
      (this as any)[onHandler].call(this, e);
      if (e.defaultPrevented) {
        return false;
      }
    }

    if (this.listeners[e.type]) {
      return this.listeners[e.type].every((callback) => {
        callback(e);
        return !e.defaultPrevented;
      });
    }

    return true;
  }

  private _setReadyState(state: number): void {
    const event = new CustomEvent('readystatechange');
    // This cast should be irrelevant in practice but makes the compiler happy.
    (event as any).readyState = state;
    this.readyState = state;
    this.dispatchEvent(event);
  }

  private _onStreamFailure(e: ProgressEvent): void {
    const event = new CustomEvent('error');
    event.initCustomEvent('error', true, true, { data: (e.currentTarget as XMLHttpRequest).response });
    this.dispatchEvent(event);
    this.close();
  }

  private _onStreamAbort(_: ProgressEvent): void {
    this.dispatchEvent(new CustomEvent('abort'));
    this.close();
  }

  private _onStreamProgress(e: ProgressEvent): void {
    if (!this.xhr) {
      return;
    }

    if (this.xhr.status !== 200) {
      this._onStreamFailure(e);
      return;
    }

    if (this.readyState === this.CONNECTING) {
      this.dispatchEvent(new CustomEvent('open'));
      this._setReadyState(this.OPEN);
    }

    const data = this.xhr.responseText.substring(this.progress);
    this.progress += data.length;
    data.split(/(\r\n|\r|\n){2}/g).forEach((part) => {
      if (part.trim().length === 0) {
        this.dispatchEvent(this._parseEventChunk(this.chunk.trim()));
        this.chunk = '';
      } else {
        this.chunk += part;
      }
    });
  }

  private _onStreamLoaded(e: ProgressEvent): void {
    this._onStreamProgress(e);

    // Parse the last chunk.
    this.dispatchEvent(this._parseEventChunk(this.chunk));
    this.chunk = '';
  }

  /**
   * Parse a received SSE event chunk into a constructed event object.
   */
  private _parseEventChunk(chunk: string): CustomEvent | null {
    if (!chunk || chunk.length === 0) {
      return null;
    }

    const e: { [key: string]: string | null } = { id: null, retry: null, data: '', event: 'message' };
    chunk.split(/\n|\r\n|\r/).forEach((line) => {
      line = line.trimRight();
      const index = line.indexOf(this.FIELD_SEPARATOR);
      if (index <= 0) {
        // Line was either empty, or started with a separator and is a comment.
        // Either way, ignore.
        return;
      }

      const field = line.substring(0, index);
      if (!(field in e)) {
        return;
      }

      const value = line.substring(index + 1).trimLeft();
      if (field === 'data') {
        e[field] += value;
      } else {
        e[field] = value;
      }
    });

    const event = new CustomEvent(e.event);
    event.initCustomEvent(e.event, true, true, { data: e.data, id: e.id });
    return event;
  }

  private _checkStreamClosed(): void {
    if (!this.xhr) {
      return;
    }

    if (this.xhr.readyState === XMLHttpRequest.DONE) {
      this._setReadyState(this.CLOSED);
    }
  }

  stream(): void {
    this._setReadyState(this.CONNECTING);

    this.xhr = new XMLHttpRequest();
    this.xhr.addEventListener('progress', this._onStreamProgress.bind(this));
    this.xhr.addEventListener('load', this._onStreamLoaded.bind(this));
    this.xhr.addEventListener('readystatechange', this._checkStreamClosed.bind(this));
    this.xhr.addEventListener('error', this._onStreamFailure.bind(this));
    this.xhr.addEventListener('abort', this._onStreamAbort.bind(this));
    this.xhr.open(this.method, this.url);
    for (const header in this.headers) {
      this.xhr.setRequestHeader(header, this.headers[header]);
    }
    this.xhr.withCredentials = this.withCredentials;
    this.xhr.send(this.payload);
  }

  close(): void {
    if (this.readyState === this.CLOSED) {
      return;
    }

    this.xhr!.abort(); // Using "!" because we know xhr is non-null at this point.
    this.xhr = null;
    this._setReadyState(this.CLOSED);
  }
}

// Export our SSE module for npm.js
if (typeof exports !== 'undefined') {
  exports.SSE = SSE;
}
