import { useCallback, useEffect, useState } from 'react';

enum SSEState {
  INITIALIZING = -1,
  CONNECTING = 0,
  OPEN = 1,
  CLOSED = 2
}

export type RequestOptions = {
  headers: Record<string, string>;
  method: 'POST' | 'GET';
  payload?: string;
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

// TODO: umschreiben ohne Hooks (aktuell kann der custom hook nicht eingesetzt werden, weil bei jedem Re-rendering der Hook neu durchlaufen wird)
export const useSSE = (url: string) => {
  const [readyState, setReadyState] = useState(SSEState.INITIALIZING);
  const [xhr, setXhr] = useState<XMLHttpRequest | null>(new XMLHttpRequest());
  const [progress, setProgress] = useState(0);
  const [chunk, setChunk] = useState('');
  const [listenersList, setListenersList] = useState<Record<EventListenerTyp, EventHandlerType[]>>({
    message: [],
    readystatechange: [],
    load: [],
    progress: [],
    abort: [],
    error: []
  });

  const addEventListener = (type: EventListenerTyp, listener: EventHandlerType) => {
    setListenersList((prev) => {
      const newListeners = { ...prev };
      if (!newListeners[type].includes(listener)) {
        newListeners[type].push(listener);
      }
      return newListeners;
    });
  };

  const removeEventListener = (type: EventListenerTyp, listener: EventHandlerType) => {
    setListenersList((prev) => {
      const newListeners = { ...prev };
      newListeners[type] = newListeners[type].filter((element) => element !== listener);
      return newListeners;
    });
  };

  const dispatchEvent = useCallback(
    (event: CustomEvent<any>): boolean => {
      const listeners = listenersList[event.type as EventListenerTyp];
      if (listeners && listeners.length > 0) {
        return listeners.every((callback) => {
          callback(event);
          return !event.defaultPrevented;
        });
      }

      return true;
    },
    [listenersList]
  );

  const updateReadyState = useCallback(
    (readyState: SSEState) => {
      setReadyState(readyState);
      const event = new CustomEvent('readystatechange', { detail: { readyState } });
      dispatchEvent(event);
    },
    [dispatchEvent]
  );

  /**
   * Parse a received SSE event chunk into a constructed event object.
   */
  const parseEventChunk = (chunk: string): CustomEvent<MessageEventData> | null => {
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

    return new CustomEvent(event.event, { detail: { data: event.data, id: event.id } });
  };

  const close = useCallback(() => {
    if (readyState === SSEState.CLOSED) return;

    xhr?.abort();
    setXhr(null);

    updateReadyState(SSEState.CLOSED);
  }, [readyState, updateReadyState, xhr]);

  const onStreamFailure = useCallback(
    (progressEvent: ProgressEvent) => {
      const xhr = progressEvent.currentTarget as XMLHttpRequest;
      const event = new CustomEvent('error', {
        detail: { data: xhr.responseText }
      });

      dispatchEvent(event);
      close();
    },
    [close, dispatchEvent]
  );

  const onStreamProgress = useCallback(
    (progressEvent: ProgressEvent) => {
      if (!xhr) return;

      if (xhr.status !== 200) {
        onStreamFailure(progressEvent);
        return;
      }

      if (readyState === SSEState.CONNECTING) {
        const event = new CustomEvent('open');
        dispatchEvent(event);
        updateReadyState(SSEState.OPEN);
      }

      const data = xhr.responseText.substring(progress);
      setProgress((prev) => prev + data.length);

      const parts = data.split(/(\r\n|\r|\n){2}/g);
      const numParts = parts.length;
      for (let i = 0; i < numParts; i++) {
        const part = parts[i];
        if (part.trim().length === 0) {
          const event = parseEventChunk(chunk.trim());
          if (event) {
            dispatchEvent(event);
          }
          setChunk('');
        } else {
          setChunk((prev) => `${prev}${part}`);
        }
      }
    },
    [chunk, dispatchEvent, onStreamFailure, progress, readyState, updateReadyState, xhr]
  );

  const onStreamLoaded = useCallback(
    (progessEvent: ProgressEvent) => {
      onStreamProgress(progessEvent);

      // Parse the last chunk.
      const event = parseEventChunk(chunk);
      if (event) {
        dispatchEvent(event);
      }
      setChunk('');
    },
    [chunk, dispatchEvent, onStreamProgress]
  );

  const checkStreamClosed = useCallback(() => {
    if (!xhr) return;

    if (xhr.readyState === XMLHttpRequest.DONE) {
      updateReadyState(SSEState.CLOSED);
    }
  }, [updateReadyState, xhr]);

  const stream = (options: RequestOptions) => {
    updateReadyState(SSEState.CONNECTING);

    if (!xhr) return;

    xhr.open(options.method, url);
    for (const key in options.headers) {
      xhr.setRequestHeader(key, options.headers[key]);
    }
    xhr.withCredentials = options.withCredentials;
    xhr.send(options.payload);
  };

  const onStreamAbort = useCallback(() => {
    const event = new CustomEvent('abort');
    dispatchEvent(event);
    close();
  }, [close, dispatchEvent]);

  useEffect(() => {
    if (xhr) {
      xhr.addEventListener('progress', onStreamProgress);
      xhr.addEventListener('load', onStreamLoaded);
      xhr.addEventListener('readystatechange', checkStreamClosed);
      xhr.addEventListener('error', onStreamFailure);
      xhr.addEventListener('abort', onStreamAbort);

      return () => {
        xhr.removeEventListener('progress', onStreamProgress);
        xhr.removeEventListener('load', onStreamLoaded);
        xhr.removeEventListener('readystatechange', checkStreamClosed);
        xhr.removeEventListener('error', onStreamFailure);
        xhr.removeEventListener('abort', onStreamAbort);
      };
    }
  }, [checkStreamClosed, onStreamAbort, onStreamFailure, onStreamLoaded, onStreamProgress, xhr]);

  return {
    readyState,
    addEventListener,
    stream,
    close
  };
};
