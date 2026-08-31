// طبقة توجيه البيانات — تختار المزوّد حسب الإعدادات وتبث حدث تغيّر بعد كل كتابة
import { idbProvider } from './indexeddb-provider.js';
import { emit, EVENTS } from '../core/events.js';

let provider = idbProvider;

export async function initDataProvider(config) {
  if (config.storageMode === 'supabase' && config.supabaseUrl && config.supabaseAnonKey) {
    const { cloudProvider } = await import('./cloud-provider.js');
    provider = cloudProvider;
  } else {
    if (config.storageMode === 'supabase') {
      console.warn('storageMode=supabase لكن الإعدادات ناقصة — تم الرجوع إلى IndexedDB');
    }
    provider = idbProvider;
  }
  return provider.name;
}

// هل يتولى المزوّد توليد معرفات هذا المخزن (الترقيم من القاعدة)؟
export function providerAssignsIds(store) {
  return Boolean(provider.assignsIds?.(store));
}

export function providerName() { return provider.name; }

export const dataProvider = {
  getAll: (store) => provider.getAll(store),
  get: (store, id) => provider.get(store, id),
  count: (store) => provider.count(store),
  byIndex: (store, index, value) => provider.byIndex(store, index, value),

  async put(store, record) {
    const result = await provider.put(store, record);
    emit(EVENTS.dataChanged, { store, action: 'put', id: record.id }, { broadcast: true });
    return result;
  },

  async bulkPut(store, records) {
    const result = await provider.bulkPut(store, records);
    emit(EVENTS.dataChanged, { store, action: 'bulkPut', count: records.length }, { broadcast: true });
    return result;
  },

  async remove(store, id) {
    await provider.remove(store, id);
    emit(EVENTS.dataChanged, { store, action: 'remove', id }, { broadcast: true });
  },

  async clear(store) {
    await provider.clear(store);
    emit(EVENTS.dataChanged, { store, action: 'clear' }, { broadcast: true });
  }
};
