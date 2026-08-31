// الإشعارات الداخلية — تُخزَّن وتُبث عبر قناة مستقلة للتبويبات الأخرى
import { dataProvider } from '../data/data-provider.js';
import { CHANNELS } from '../core/constants.js';
import { uid, sortBy } from '../core/utils.js';
import { nowIso } from '../core/date-time.js';
import { emit, EVENTS } from '../core/events.js';

let channel = null;
function getChannel() {
  if (!channel && typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNELS.notifications);
    channel.onmessage = (msg) => emit(EVENTS.notification, msg.data);
  }
  return channel;
}

export function initNotifications() { getChannel(); }

export async function notify(title, body = '', level = 'info') {
  const record = { id: uid('ntf'), title, body, level, at: nowIso(), read: false };
  await dataProvider.put('notifications', record);
  emit(EVENTS.notification, record);
  getChannel()?.postMessage(record);
  return record;
}

export async function getNotifications(limit = 20) {
  const all = await dataProvider.getAll('notifications');
  return sortBy(all, (n) => n.at, 'desc').slice(0, limit);
}

export async function unreadCount() {
  const all = await dataProvider.getAll('notifications');
  return all.filter((n) => !n.read).length;
}

export async function markAllRead() {
  const all = await dataProvider.getAll('notifications');
  const unread = all.filter((n) => !n.read);
  if (unread.length) {
    await dataProvider.bulkPut('notifications', unread.map((n) => ({ ...n, read: true })));
  }
  return unread.length;
}
