// جدول بيانات قابل للفرز والبحث — يُصيَّر داخل حاوية ويعيد واجهة تحديث
import { escapeHtml } from '../core/sanitizer.js';
import { sortBy } from '../core/utils.js';

// columns: [{ key, label, map?, sortValue?, width?, htmlMap? }]
// options: { searchable, emptyText, onRowClick(row), rowKey }
export function renderTable(container, rows, columns, options = {}) {
  const state = {
    rows: [...rows],
    sortKey: options.initialSort || null,
    sortDir: 'asc',
    query: ''
  };

  function visibleRows() {
    let out = state.rows;
    if (state.query) {
      const q = state.query.toLowerCase();
      out = out.filter((r) => columns.some((c) => {
        const v = c.map ? c.map(r) : r[c.key];
        return String(v ?? '').toLowerCase().includes(q);
      }));
    }
    if (state.sortKey) {
      const col = columns.find((c) => c.key === state.sortKey);
      out = sortBy(out, (r) => (col?.sortValue ? col.sortValue(r) : (col?.map ? col.map(r) : r[state.sortKey])), state.sortDir);
    }
    return out;
  }

  function draw() {
    const rowsToShow = visibleRows();
    const head = columns.map((c) => {
      const active = state.sortKey === c.key;
      const arrow = active ? (state.sortDir === 'asc' ? ' ▲' : ' ▼') : '';
      return `<th ${c.width ? `style="width:${c.width}"` : ''}>
        <button class="mi-th-sort" data-key="${escapeHtml(c.key)}" aria-sort="${active ? (state.sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}">${escapeHtml(c.label)}${arrow}</button>
      </th>`;
    }).join('');

    const body = rowsToShow.length
      ? rowsToShow.map((r) => {
        const cells = columns.map((c) => {
          if (c.htmlMap) return `<td>${c.htmlMap(r)}</td>`; // HTML جاهز ومعقّم من المنادي
          const v = c.map ? c.map(r) : r[c.key];
          return `<td>${escapeHtml(v ?? '—')}</td>`;
        }).join('');
        const key = options.rowKey ? options.rowKey(r) : (r.id || '');
        return `<tr data-row="${escapeHtml(key)}" ${options.onRowClick ? 'tabindex="0" role="button"' : ''}>${cells}</tr>`;
      }).join('')
      : `<tr><td colspan="${columns.length}" class="mi-table-empty">${escapeHtml(options.emptyText || 'لا توجد سجلات مطابقة')}</td></tr>`;

    container.innerHTML = `
      ${options.searchable ? `<div class="mi-table-tools"><input type="search" class="mi-input mi-table-search" placeholder="بحث في الجدول…" value="${escapeHtml(state.query)}" aria-label="بحث في الجدول"><span class="mi-table-count">${rowsToShow.length} سجل</span></div>` : ''}
      <div class="mi-table-wrap"><table class="mi-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;

    container.querySelectorAll('.mi-th-sort').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        if (state.sortKey === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        else { state.sortKey = key; state.sortDir = 'asc'; }
        draw();
      });
    });

    if (options.searchable) {
      const input = container.querySelector('.mi-table-search');
      input.addEventListener('input', () => {
        state.query = input.value;
        draw();
        container.querySelector('.mi-table-search')?.focus();
        const el = container.querySelector('.mi-table-search');
        if (el) el.setSelectionRange(el.value.length, el.value.length);
      });
    }

    if (options.onRowClick) {
      container.querySelectorAll('tbody tr[data-row]').forEach((tr) => {
        const activate = () => {
          const row = state.rows.find((r) => String(options.rowKey ? options.rowKey(r) : r.id) === tr.dataset.row);
          if (row) options.onRowClick(row);
        };
        tr.addEventListener('click', activate);
        tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
      });
    }
  }

  draw();
  return {
    update(newRows) { state.rows = [...newRows]; draw(); }
  };
}
