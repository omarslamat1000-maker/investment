// سجل قرارات البوابات — مرجع الحوكمة الرسمي
import { repos } from '../../data/repositories.js';
import { html, raw } from '../../core/sanitizer.js';
import { sectionHeader } from '../../ui/components.js';
import { renderTable } from '../../ui/table.js';
import { fmtDate } from '../../core/date-time.js';
import { navigate } from '../../router.js';

const OUTCOMES = { pass: 'اجتياز', reject: 'اعتذار', hold: 'تعليق' };

export async function renderDecisions(container) {
  const [decisions, initiatives] = await Promise.all([repos.decisions.getAll(), repos.initiatives.getAll()]);
  const titleOf = (id) => initiatives.find((i) => i.id === id)?.title || id;

  container.innerHTML = html`
    ${raw(sectionHeader('سجل القرارات', 'القرارات الرسمية الصادرة عند البوابات المرحلية بمسوغاتها'))}
    <div class="mi-table-host"></div>`;

  renderTable(container.querySelector('.mi-table-host'), decisions, [
    { key: 'id', label: 'رقم القرار', width: '10rem' },
    { key: 'at', label: 'التاريخ', map: (r) => fmtDate(r.at), sortValue: (r) => r.at },
    { key: 'initiativeId', label: 'المبادرة', map: (r) => titleOf(r.initiativeId) },
    { key: 'gateId', label: 'البوابة', width: '5rem' },
    { key: 'outcome', label: 'النتيجة', map: (r) => OUTCOMES[r.outcome] || r.outcome },
    { key: 'by', label: 'الجهة المقررة' },
    { key: 'rationale', label: 'المسوغات' }
  ], {
    searchable: true, initialSort: 'at',
    onRowClick: (r) => navigate(`initiatives/${r.initiativeId}`),
    emptyText: 'لا توجد قرارات مسجلة'
  });
}
