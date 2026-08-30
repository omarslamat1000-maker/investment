// ناقل أحداث داخلي + بث بين التبويبات عبر BroadcastChannel مستقلة القناة
import { CHANNELS } from './constants.js';

const listeners = new Map(); // eventName -> Set<fn>
let channel = null;

function getChannel() {
  if (channel) return channel;
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNELS.events);
    channel.onmessage = (msg) => {
      const { event, payload } = msg.data || {};
      if (event) emitLocal(event, payload);
    };
  }
  return channel;
}

function emitLocal(event, payload) {
  const set = listeners.get(event);
  if (set) for (const fn of [...set]) {
    try { fn(payload); } catch (err) { console.error(`خطأ في مستمع الحدث ${event}`, err); }
  }
  const all = listeners.get('*');
  if (all) for (const fn of [...all]) {
    try { fn({ event, payload }); } catch (err) { console.error('خطأ في مستمع *', err); }
  }
}

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => off(event, fn);
}

export function off(event, fn) {
  listeners.get(event)?.delete(fn);
}

// broadcast=true يبث للتبويبات الأخرى أيضًا
export function emit(event, payload = null, { broadcast = false } = {}) {
  emitLocal(event, payload);
  if (broadcast) {
    const ch = getChannel();
    if (ch) ch.postMessage({ event, payload });
  }
}

// أسماء الأحداث المعتمدة في المنصة
export const EVENTS = {
  dataChanged: 'data:changed',          // { store, action, id }
  routeChanged: 'route:changed',        // { path, params }
  roleChanged: 'auth:roleChanged',      // { role }
  notification: 'notify:new',           // { title, body, level }
  settingsChanged: 'settings:changed'
};
