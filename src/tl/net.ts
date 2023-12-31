/**
 * @module tl/net
 */
import {getUid} from './util';

/**
 * Simple JSONP helper. Supports error callbacks and a custom callback param.
 * The error callback will be called when no JSONP is executed after 10 seconds.
 *
 * @param {string} url Request url. A 'callback' query parameter will be
 *     appended.
 * @param {Function} callback Callback on success.
 * @param {Function} [errback] Callback on error.
 * @param {string} [callbackParam] Custom query parameter for the JSONP
 *     callback. Default is 'callback'.
 */
export function jsonp(url: string, callback: Function, errback?: Function, callbackParam?: string): void {
  const script = document.createElement('script');
  const key = 'olc_' + getUid(callback);
  function cleanup() {
    delete window[key];
    script.parentNode.removeChild(script);
  }
  script.async = true;
  script.src =
    url +
    (url.includes('?') ? '&' : '?') +
    (callbackParam || 'callback') +
    '=' +
    key;
  const timer = setTimeout(function () {
    cleanup();
    if (errback) {
      errback();
    }
  }, 10000);
  window[key] = function (data) {
    clearTimeout(timer);
    cleanup();
    callback(data);
  };
  document.head.appendChild(script);
}

export class ResponseError extends Error {
  /**
   * @param {XMLHttpRequest} response The XHR object.
   */

  public response: XMLHttpRequest;

  constructor(response: XMLHttpRequest) {
    const message = 'Unexpected response status: ' + response.status;
    super(message);

    /**
     * @type {string}
     */
    this.name = 'ResponseError';

    /**
     * @type {XMLHttpRequest}
     */
    this.response = response;
  }
}

export class ClientError extends Error {
  /**
   * @param {XMLHttpRequest} client The XHR object.
   */

  public client: XMLHttpRequest;

  constructor(client: XMLHttpRequest) {
    super('Failed to issue request');

    /**
     * @type {string}
     */
    this.name = 'ClientError';

    /**
     * @type {XMLHttpRequest}
     */
    this.client = client;
  }
}

/**
 * @param {string} url The URL.
 * @return {Promise<Object>} A promise that resolves to the JSON response.
 */
export function getJSON(url: string): Promise<any> {
  return new Promise(function (resolve, reject) {
    /**
     * @param {ProgressEvent<XMLHttpRequest>} event The load event.
     */
    function onLoad(event: ProgressEvent<XMLHttpRequest>): void {
      const client = event.target;
      // status will be 0 for file:// urls
      if (!client.status || (client.status >= 200 && client.status < 300)) {
        let data;
        try {
          data = JSON.parse(client.responseText);
        } catch (err) {
          const message = 'Error parsing response text as JSON: ' + err.message;
          reject(new Error(message));
          return;
        }
        resolve(data);
        return;
      }

      reject(new ResponseError(client));
    }

    /**
     * @param {ProgressEvent<XMLHttpRequest>} event The error event.
     */
    function onError(event) {
      reject(new ClientError(event.target));
    }

    const client = new XMLHttpRequest();
    client.addEventListener('load', onLoad);
    client.addEventListener('error', onError);
    client.open('GET', url);
    client.setRequestHeader('Accept', 'application/json');
    client.send();
  });
}

/**
 * @param {string} base The base URL.
 * @param {string} url The potentially relative URL.
 * @return {string} The full URL.
 */
export function resolveUrl(base: string, url: string): string {
  if (url.includes('://')) {
    return url;
  }
  return new URL(url, base).href;
}

let originalXHR;
export function overrideXHR(xhr: XMLHttpRequest): void {
  if (typeof XMLHttpRequest !== 'undefined') {
    originalXHR = XMLHttpRequest;
  }
  global.XMLHttpRequest = xhr;
}

export function restoreXHR(): void {
  global.XMLHttpRequest = originalXHR;
}
