// مبادرات تجريبية عبر كامل دورة الحياة + السجلات المرتبطة — بيانات توضيحية

// محفظة المبادرات المقترحة — تجميع المبادرات ذات الهدف الواحد وتتبعها كمجموعة
export const DEMO_PORTFOLIOS = [
  {
    id: 'pf-madinah-proposed',
    title: 'محفظة المبادرات المقترحة لأمانة منطقة المدينة المنورة',
    goal: 'رفع جودة الحياة وكفاءة البنية التحتية في المدينة المنورة عبر شراكات مجتمعية ممنهجة',
    description: 'محفظة ثابتة تضم المبادرات المقترحة المعتمدة مبدئيًا، وتتفرع منها الحملات الموسمية مثل «المدينة تُزهر» و«طرق آمنة لمدارسنا».'
  }
];

const PF = 'pf-madinah-proposed';
const PMO_SUBMITTER = {
  submitterName: 'أ. ريم الجهني', submitterEntity: 'مكتب إدارة المبادرات',
  submitterEmail: 'pmo@amana.example', submitterPhone: '0551000010',
  channel: 'internal', status: 'draft', budget: null, spent: 0,
  startDate: null, endDate: null, orgUnitId: 'ou-pmo', ownerName: '', scores: {}, statusHistory: []
};

// المبادرات المقترحة في المحفظة (من وثيقة المحفظة المعتمدة)
export const DEMO_PROPOSED_INITIATIVES = [
  {
    id: 'MDN-INIT-2026-0101', title: 'مبادرة ظلّ المدينة', category: 'shading', district: 'المنطقة المركزية',
    summary: 'إنشاء مظلات حضرية وتشجير ومقاعد وأرضيات منخفضة الامتصاص الحراري ونقاط مياه وريّ ذكي في مسارات المشاة والمواقع عالية الكثافة.',
    beneficiaryGroups: 'المشاة وزوار المواقع عالية الكثافة',
    expectedImpact: 'نسبة تغطية الظل، انخفاض الحرارة السطحية، زيادة حركة المشاة، رضا المستفيدين.',
    notes: 'الشركات الأنسب: البنوك، شركات مواد البناء، الطاقة، التطوير العقاري، الضيافة.'
  },
  {
    id: 'MDN-INIT-2026-0102', title: 'مبادرة مسار آمن', category: 'safety', district: 'العزيزية',
    summary: 'معالجة مواقع الخطورة المرورية حول المدارس والمساجد والمستشفيات، وإنشاء معابر ذكية وتهدئة السرعة وتحسين الإنارة.',
    beneficiaryGroups: 'طلاب المدارس ومرتادو المساجد والمستشفيات',
    expectedImpact: 'انخفاض الحوادث والملاحظات، الالتزام بالسرعة، عدد المواقع المعالجة، رضا المشاة.',
    notes: 'الشركات الأنسب: التأمين، السيارات، النقل، الخدمات اللوجستية، المقاولون.'
  },
  {
    id: 'MDN-INIT-2026-0103', title: 'مبادرة المدينة بلا عوائق', category: 'sidewalks', district: 'المنطقة المركزية',
    summary: 'تهيئة مسارات متصلة للأشخاص ذوي الإعاقة وكبار السن، تشمل المنحدرات ومسارات المكفوفين والإشارات الصوتية ودورات المياه المهيأة.',
    beneficiaryGroups: 'الأشخاص ذوو الإعاقة وكبار السن',
    expectedImpact: 'نسبة المسار المطابق، عدد العوائق المزالة، استمرارية المسار، رضا الأشخاص ذوي الإعاقة.',
    notes: 'الشركات الأنسب: البنوك، الاتصالات، الرعاية الصحية، التأمين، المجمعات التجارية.'
  },
  {
    id: 'MDN-INIT-2026-0104', title: 'مبادرة محطات ضيافة المدينة', category: 'furniture', district: 'قباء',
    summary: 'محطات نقل وانتظار مظللة وذكية، مزودة بالمقاعد والمعلومات متعددة اللغات والشحن والإنارة ومعلومات الرحلات.',
    beneficiaryGroups: 'مستخدمو النقل العام والزوار',
    expectedImpact: 'جاهزية المحطات، عدد المستخدمين، زمن الأعطال، رضا الزوار، استهلاك الطاقة.',
    notes: 'الشركات الأنسب: الاتصالات، التقنية، الطيران، الفنادق، البنوك، النقل.'
  },
  {
    id: 'MDN-INIT-2026-0105', title: 'مبادرة شريك الممر الحضري', category: 'greening', district: 'العوالي',
    summary: 'تبني شركة لممر أو شارع محدد لمدة 3–5 سنوات، يشمل صيانة التشجير والأثاث الحضري والنظافة والإنارة وفق هوية الأمانة.',
    beneficiaryGroups: 'سكان الأحياء ومرتادو الممرات المتبناة',
    expectedImpact: 'حالة الأصول، زمن الاستجابة، نظافة الموقع، بقاء الأشجار، انخفاض البلاغات.',
    notes: 'الشركات الأنسب: المطورون، الفنادق، المجمعات التجارية، الشركات الكبرى القريبة من الموقع.'
  },
  {
    id: 'MDN-INIT-2026-0106', title: 'مبادرة نور المدينة الذكي', category: 'lighting', district: 'الحرة الغربية',
    summary: 'استبدال أو دعم الإنارة عالية الكفاءة والطاقة الشمسية وأنظمة التحكم والمراقبة عن بعد في المواقع المناسبة.',
    beneficiaryGroups: 'سكان الأحياء ومستخدمو الطرق ليلًا',
    expectedImpact: 'وفر الطاقة، نسبة الأعطال، مطابقة مستويات الإنارة، خفض الانبعاثات والتكاليف.',
    notes: 'الشركات الأنسب: شركات الطاقة، الكهرباء، التقنية، الاتصالات.'
  },
  {
    id: 'MDN-INIT-2026-0107', title: 'مبادرة واحات المطر', category: 'rehab', district: 'الرانوناء',
    summary: 'حدائق مطرية وأحواض احتجاز وأسطح نفاذة وحساسات للأمطار والسيول في مواقع تجريبية.',
    beneficiaryGroups: 'سكان الأحياء المعرضة لتجمعات الأمطار',
    expectedImpact: 'كمية مياه الجريان المحتجزة، انخفاض تجمعات المياه، زمن الإنذار، عدد المواقع المحمية.',
    notes: 'الشركات الأنسب: التأمين، البنوك، شركات المياه، المقاولون، الشركات البيئية.'
  },
  {
    id: 'MDN-INIT-2026-0108', title: 'مبادرة قطرة مستدامة', category: 'greening', district: 'النخيل',
    summary: 'شبكات ري ذكية واكتشاف التسرب واستخدام المياه المجددة وخزانات ومراقبة الاستهلاك.',
    beneficiaryGroups: 'مرتادو الحدائق والمسطحات الخضراء العامة',
    expectedImpact: 'كمية المياه الموفرة، انخفاض التسرب، كفاءة الري، تكلفة المتر المربع المزروع.',
    notes: 'الشركات الأنسب: شركات المياه، الزراعة، التقنية، الطاقة، المقاولون.'
  },
  {
    id: 'MDN-INIT-2026-0109', title: 'مبادرة نبض الأصول', category: 'rehab', district: 'الملك فهد',
    summary: 'دعم منصة GIS/BIM وإنترنت الأشياء لمراقبة الطرق والإنارة والري والأرصفة وتصريف الأمطار والصيانة التنبؤية.',
    beneficiaryGroups: 'إدارات التشغيل والصيانة وسكان المدينة',
    expectedImpact: 'نسبة الأصول المسجلة، الأعطال المتنبأ بها، انخفاض زمن الإصلاح، اكتمال بيانات الأصول.',
    notes: 'الشركات الأنسب: الاتصالات، التقنية، الشركات الجيومكانية، الاستشاريون.'
  },
  {
    id: 'MDN-INIT-2026-0110', title: 'مبادرة تنسيق بلا حفر', category: 'rehab', district: 'العيون',
    summary: 'رفع مساحي للمرافق تحت الأرض واستخدام الرادار الأرضي وربط تصاريح الحفر وتجربة ممر خدمات مشترك.',
    beneficiaryGroups: 'مقدمو الخدمات وسكان الأحياء المتأثرة بالحفريات',
    expectedImpact: 'انخفاض الحفر المتكرر، زمن تنسيق التصاريح، جودة إعادة السفلتة، تعارضات المرافق المكتشفة مبكرًا.',
    notes: 'الشركات الأنسب: شركات الخدمات، الكهرباء، المياه، الاتصالات، الاستشاريون.'
  },
  {
    id: 'MDN-INIT-2026-0111', title: 'مبادرة دروب السيرة', category: 'mobility', district: 'سيد الشهداء',
    summary: 'تحسين الوصول إلى المواقع التاريخية عبر مسارات مشاة مظللة ومهيأة وإرشاد متعدد اللغات ومناطق جلوس وخدمات.',
    beneficiaryGroups: 'الزوار والمعتمرون ومرتادو المواقع التاريخية',
    expectedImpact: 'رضا الزائر، سهولة الوصول، عدد مستخدمي المسار، نسبة المواقع المهيأة.',
    notes: 'الشركات الأنسب: الضيافة، الطيران، البنوك، الشركات الثقافية، التقنية.'
  },
  {
    id: 'MDN-INIT-2026-0112', title: 'مبادرة دوّرها للمدينة', category: 'cleanliness', district: 'الجرف',
    summary: 'إعادة تدوير مخلفات الإنشاء والهدم واستخدامها في الأرصفة والبلدورات والأثاث الحضري وفق مواصفات معتمدة.',
    beneficiaryGroups: 'قطاع الإنشاءات وسكان المدينة',
    expectedImpact: 'الأطنان المحولة عن المرادم، نسبة المحتوى المعاد تدويره، تكلفة دورة الحياة.',
    notes: 'الشركات الأنسب: الأسمنت، المقاولون، شركات إدارة النفايات، المصانع.'
  },
  {
    id: 'MDN-INIT-2026-0113', title: 'مبادرة مختبر المدينة الحي', category: 'mobility', district: 'الملك فهد',
    summary: 'مواقع تجريبية لاختبار حلول البنية التحتية الذكية قبل التوسع، بالشراكة مع الجامعات والشركات الناشئة.',
    beneficiaryGroups: 'الجامعات والشركات الناشئة وإدارات الأمانة',
    expectedImpact: 'عدد التجارب، نسبة الحلول الناجحة، الوفر المحقق، مدة الانتقال من التجربة إلى التوسع.',
    notes: 'الشركات الأنسب: التقنية، الاتصالات، الجامعات، شركات الهندسة والابتكار.'
  },
  {
    id: 'MDN-INIT-2026-0114', title: 'مبادرة كفاءات البنية التحتية', category: 'rehab', district: 'المنطقة المركزية',
    summary: 'تدريب وتأهيل الخريجين والموظفين في إدارة المشاريع وBIM وGIS وإدارة الأصول والسلامة والتشغيل والصيانة.',
    beneficiaryGroups: 'الخريجون وموظفو الأمانة',
    expectedImpact: 'عدد المتدربين، الشهادات المكتسبة، التوظيف، ساعات نقل المعرفة، نسبة الكفاءات المحلية.',
    notes: 'الشركات الأنسب: جميع الشركات الكبرى والجامعات والمكاتب الاستشارية.'
  }
].map((p) => ({
  ...PMO_SUBMITTER, ...p, portfolioId: PF,
  // التدرج الهرمي: بعض المبادرات المقترحة تتبع الحملتين الموسميتين مباشرة
  campaignId: {
    'MDN-INIT-2026-0101': 'cmp-green-madinah',
    'MDN-INIT-2026-0105': 'cmp-green-madinah',
    'MDN-INIT-2026-0108': 'cmp-green-madinah',
    'MDN-INIT-2026-0102': 'cmp-safe-paths',
    'MDN-INIT-2026-0103': 'cmp-safe-paths',
    'MDN-INIT-2026-0106': 'cmp-safe-paths'
  }[p.id] || null,
  location: '', lat: null, lng: null, fundingModel: 'coFunding', beneficiaries: null,
  sites: [], geometry: null, imageDataUrl: null, problem: '', costBand: 'tbd',
  durationBand: '', readinessLevel: 'idea', scope: ''
}));

export const DEMO_INITIATIVES = [
  {
    id: 'MDN-INIT-2026-0001', title: 'تشجير محور طريق قباء بالمشاركة المجتمعية',
    summary: 'زراعة 1200 شجرة ظل محلية على جانبي محور قباء مع شبكة ري بالتنقيط وصيانة تشغيلية لمدة سنتين يتكفل بها الشريك.',
    scope: 'المرحلة الأولى: من ميدان قباء حتى تقاطع الهجرة (3.2 كم).',
    category: 'greening', district: 'قباء', location: 'محور طريق قباء', lat: 24.4425, lng: 39.6120,
    sites: [
      { id: 'site-0001-a', name: 'محور قباء — القطاع الشمالي', geometry: { type: 'line', coords: [[24.4425, 39.6120], [24.4372, 39.6131], [24.4300, 39.6140]] } },
      { id: 'site-0001-b', name: 'محور قباء — القطاع الجنوبي', geometry: { type: 'line', coords: [[24.4300, 39.6140], [24.4231, 39.6153]] } }
    ],
    portfolioId: 'pf-madinah-proposed', campaignId: 'cmp-green-madinah',
    status: 'execution', channel: 'partner',
    submitterName: 'أ. مها الصاعدي', submitterEntity: 'جمعية سقيا وظل الأهلية',
    submitterEmail: 'maha@suqya.example', submitterPhone: '0551000002',
    budget: 1850000, spent: 1010000, fundingModel: 'coFunding',
    startDate: '2026-04-01', endDate: '2026-11-30',
    orgUnitId: 'ou-projects', ownerName: 'م. فهد المطيري', beneficiaries: 40000,
    scores: { strategic: 5, impact: 5, feasibility: 4, readiness: 5, risk: 4 },
    notes: 'ضمن حملة «المدينة تُزهر».',
    statusHistory: [
      { from: 'submitted', to: 'screening', at: '2026-01-12T08:00:00Z', by: 'أ. ريم الجهني' },
      { from: 'screening', to: 'study', at: '2026-01-25T08:00:00Z', by: 'لجنة المبادرات', decisionId: 'MDN-DEC-2026-0001' },
      { from: 'study', to: 'approval', at: '2026-02-20T08:00:00Z', by: 'لجنة المبادرات', decisionId: 'MDN-DEC-2026-0002' },
      { from: 'approval', to: 'readiness', at: '2026-03-10T08:00:00Z', by: 'لجنة المبادرات', decisionId: 'MDN-DEC-2026-0003' },
      { from: 'readiness', to: 'execution', at: '2026-04-01T08:00:00Z', by: 'لجنة المبادرات', decisionId: 'MDN-DEC-2026-0004' }
    ]
  },
  {
    id: 'MDN-INIT-2026-0002', title: 'إنارة LED ذكية لممرات حي العوالي',
    summary: 'تمويل كامل من القطاع الخاص لاستبدال 450 وحدة إنارة بممرات العوالي بوحدات LED ذكية تُدار مركزيًا وتخفض الاستهلاك 60%.',
    scope: 'جميع الممرات الداخلية للمربعات السكنية 12–18.',
    category: 'lighting', district: 'العوالي', location: 'ممرات العوالي الداخلية', lat: 24.4210, lng: 39.6290,
    status: 'readiness', channel: 'partner',
    submitterName: 'أ. عمر البلوي', submitterEntity: 'مجموعة نور المدينة القابضة',
    submitterEmail: 'omar@noor.example', submitterPhone: '0551000003',
    budget: 1350000, spent: 0, fundingModel: 'fullFunding',
    startDate: '2026-10-01', endDate: '2027-03-31',
    orgUnitId: 'ou-services', ownerName: 'م. هند العمري', beneficiaries: 26000,
    scores: { strategic: 4, impact: 4, feasibility: 5, readiness: 4, risk: 4 },
    notes: '',
    statusHistory: [
      { from: 'submitted', to: 'screening', at: '2026-05-05T08:00:00Z', by: 'أ. ريم الجهني' },
      { from: 'screening', to: 'study', at: '2026-05-18T08:00:00Z', by: 'لجنة المبادرات', decisionId: 'MDN-DEC-2026-0005' },
      { from: 'study', to: 'approval', at: '2026-06-22T08:00:00Z', by: 'لجنة المبادرات', decisionId: 'MDN-DEC-2026-0006' },
      { from: 'approval', to: 'readiness', at: '2026-08-02T08:00:00Z', by: 'لجنة المبادرات', decisionId: 'MDN-DEC-2026-0007' }
    ]
  },
  {
    id: 'MDN-INIT-2026-0003', title: 'تأهيل أرصفة شارع السلام وممرات المدارس',
    summary: 'إعادة رصف 2.4 كم من أرصفة شارع السلام مع منحدرات وصول شامل وتشجير جانبي، تنفيذًا مباشرًا من شريك مقاولات.',
    scope: 'شارع السلام كاملًا مع تقاطعاته الست.',
    category: 'sidewalks', district: 'الحرة الشرقية', location: 'شارع السلام', lat: 24.4720, lng: 39.6350,
    sites: [
      { id: 'site-0003-a', name: 'المقطع الأول — من التقاطع الأول', geometry: { type: 'line', coords: [[24.4720, 39.6350], [24.4752, 39.6392]] } },
      { id: 'site-0003-b', name: 'المقطع الثاني — حتى الدوار', geometry: { type: 'line', coords: [[24.4752, 39.6392], [24.4790, 39.6440]] } }
    ],
    portfolioId: 'pf-madinah-proposed', campaignId: 'cmp-safe-paths',
    status: 'execution', channel: 'internal',
    submitterName: 'أ. ريم الجهني', submitterEntity: 'مكتب إدارة المبادرات',
    submitterEmail: 'pmo@amana.example', submitterPhone: '0551000010',
    budget: 1800000, spent: 1560000, fundingModel: 'execution',
    startDate: '2026-03-15', endDate: '2026-09-15',
    orgUnitId: 'ou-projects', ownerName: 'م. فهد المطيري', beneficiaries: 18000,
    scores: { strategic: 5, impact: 4, feasibility: 4, readiness: 4, risk: 3 },
    notes: 'مرتبطة بالاحتياج MDN-NEED-2026-0003 وحملة «طرق آمنة لمدارسنا».',
    statusHistory: [
      { from: 'submitted', to: 'screening', at: '2025-12-01T08:00:00Z', by: 'أ. ريم الجهني' },
      { from: 'screening', to: 'study', at: '2025-12-15T08:00:00Z', by: 'لجنة المبادرات' },
      { from: 'study', to: 'approval', at: '2026-01-20T08:00:00Z', by: 'لجنة المبادرات' },
      { from: 'approval', to: 'readiness', at: '2026-02-15T08:00:00Z', by: 'لجنة المبادرات' },
      { from: 'readiness', to: 'execution', at: '2026-03-15T08:00:00Z', by: 'لجنة المبادرات', decisionId: 'MDN-DEC-2026-0008' }
    ]
  },
  {
    id: 'MDN-INIT-2026-0004', title: 'مظلات ساحة مسجد الميقات',
    summary: 'تصميم وتركيب مظلات شراعية تغطي 2800 م² من ساحات الميقات لخدمة الحجاج والمعتمرين، برعاية شريك خاص.',
    scope: 'الساحة الشمالية والشرقية.',
    category: 'shading', district: 'الرانوناء', location: 'ساحات مسجد الميقات', lat: 24.4139, lng: 39.5424,
    status: 'benefits', channel: 'partner',
    submitterName: 'أ. بدر العوفي', submitterEntity: 'مؤسسة عمران للتطوير العقاري',
    submitterEmail: 'badr@omran.example', submitterPhone: '0551000006',
    budget: 2200000, spent: 2150000, fundingModel: 'fullFunding',
    startDate: '2025-10-01', endDate: '2026-05-30',
    orgUnitId: 'ou-projects', ownerName: 'م. فهد المطيري', beneficiaries: 120000,
    scores: { strategic: 5, impact: 5, feasibility: 4, readiness: 4, risk: 4 },
    notes: 'اكتمل التنفيذ — جارٍ قياس المنافع قبل الإقفال عند بوابة G4.',
    statusHistory: [
      { from: 'submitted', to: 'screening', at: '2025-06-10T08:00:00Z', by: 'أ. ريم الجهني' },
      { from: 'screening', to: 'study', at: '2025-06-25T08:00:00Z', by: 'لجنة المبادرات' },
      { from: 'study', to: 'approval', at: '2025-07-30T08:00:00Z', by: 'لجنة المبادرات' },
      { from: 'approval', to: 'readiness', at: '2025-09-01T08:00:00Z', by: 'لجنة المبادرات' },
      { from: 'readiness', to: 'execution', at: '2025-10-01T08:00:00Z', by: 'لجنة المبادرات' },
      { from: 'execution', to: 'benefits', at: '2026-06-05T08:00:00Z', by: 'م. فهد المطيري' }
    ]
  },
  {
    id: 'MDN-INIT-2026-0005', title: 'حديقة حي الجرف المجتمعية',
    summary: 'إنشاء حديقة حي (5600 م²) بتمويل مشترك وتشغيل من جمعية أهلية: مسطحات خضراء وألعاب ومسار مشي 400 م.',
    scope: 'الأرض البلدية رقم 118 بحي الجرف.',
    category: 'parks', district: 'الجرف', location: 'الأرض البلدية 118', lat: 24.5230, lng: 39.5710,
    sites: [
      { id: 'site-0005-a', name: 'أرض الحديقة', geometry: { type: 'polygon', coords: [[24.5233, 39.5706], [24.5233, 39.5714], [24.5227, 39.5715], [24.5226, 39.5706]] } }
    ],
    status: 'closed', channel: 'public',
    submitterName: 'أ. سارة الحسيني', submitterEntity: 'فريق «دربك أخضر» التطوعي',
    submitterEmail: 'sara@darbak.example', submitterPhone: '0551000004',
    budget: 2450000, spent: 2380000, fundingModel: 'coFunding',
    startDate: '2025-03-01', endDate: '2025-12-15',
    orgUnitId: 'ou-community', ownerName: 'أ. ريم الجهني', beneficiaries: 14000,
    scores: { strategic: 4, impact: 5, feasibility: 4, readiness: 4, risk: 4 },
    notes: 'أُقفلت بتحقق منافع 96% — نموذج يحتذى للتشغيل الأهلي.',
    statusHistory: [
      { from: 'submitted', to: 'screening', at: '2024-11-01T08:00:00Z', by: 'أ. ريم الجهني' },
      { from: 'screening', to: 'study', at: '2024-11-20T08:00:00Z', by: 'لجنة المبادرات' },
      { from: 'study', to: 'approval', at: '2024-12-25T08:00:00Z', by: 'لجنة المبادرات' },
      { from: 'approval', to: 'readiness', at: '2025-02-01T08:00:00Z', by: 'لجنة المبادرات' },
      { from: 'readiness', to: 'execution', at: '2025-03-01T08:00:00Z', by: 'لجنة المبادرات' },
      { from: 'execution', to: 'benefits', at: '2025-12-20T08:00:00Z', by: 'م. فهد المطيري' },
      { from: 'benefits', to: 'closed', at: '2026-04-10T08:00:00Z', by: 'لجنة المبادرات', decisionId: 'MDN-DEC-2026-0009' }
    ]
  },
  {
    id: 'MDN-INIT-2026-0006', title: 'نقاط الفرز الذكية لإعادة التدوير',
    summary: 'تبنّي احتياج نقاط الفرز: 40 نقطة ثلاثية الحاويات بتبرع عيني من شريك صناعي وحملة توعية مرافقة.',
    scope: 'أحياء العزيزية والحرة الغربية والعيون.',
    category: 'cleanliness', district: 'العزيزية', location: 'مواقع موزعة', lat: 24.4570, lng: 39.6480,
    status: 'study', channel: 'partner',
    submitterName: 'م. لينا مغربي', submitterEntity: 'شركة الينابيع للمياه والري',
    submitterEmail: 'lina@yanabea.example', submitterPhone: '0551000008',
    budget: 480000, spent: 0, fundingModel: 'inKind',
    startDate: null, endDate: null,
    orgUnitId: 'ou-services', ownerName: 'م. هند العمري', beneficiaries: 30000,
    scores: { strategic: 3, impact: 4, feasibility: 4, readiness: 2, risk: 3 },
    notes: 'بانتظار استكمال دراسة مواقع التوزيع.',
    statusHistory: [
      { from: 'submitted', to: 'screening', at: '2026-08-01T08:00:00Z', by: 'أ. ريم الجهني' },
      { from: 'screening', to: 'study', at: '2026-08-14T08:00:00Z', by: 'لجنة المبادرات', decisionId: 'MDN-DEC-2026-0010' }
    ]
  },
  {
    id: 'MDN-INIT-2026-0007', title: 'ممر ظليل يربط قباء بالمسار النبوي',
    summary: 'مقترح مجتمعي لممر مشاة مظلل بطول 1.8 كم يربط ساحات قباء بالمسار النبوي مع محطات استراحة تفاعلية.',
    scope: 'يتطلب تنسيقًا مع هيئة تطوير المنطقة.',
    category: 'mobility', district: 'قباء', location: 'الرابط بين قباء والمسار النبوي', lat: 24.4460, lng: 39.6090,
    status: 'approval', channel: 'public',
    submitterName: 'م. يوسف قاضي', submitterEntity: 'شركة مسارات الذكية للتقنية',
    submitterEmail: 'y.qadi@masarat.example', submitterPhone: '0551000005',
    budget: 5200000, spent: 0, fundingModel: 'coFunding',
    startDate: null, endDate: null,
    orgUnitId: 'ou-projects', ownerName: 'أ. ريم الجهني', beneficiaries: 60000,
    scores: { strategic: 5, impact: 5, feasibility: 3, readiness: 3, risk: 2 },
    notes: 'درجة الجدوى مشروطة بموافقات جهات خارجية.',
    statusHistory: [
      { from: 'submitted', to: 'screening', at: '2026-06-20T08:00:00Z', by: 'أ. ريم الجهني' },
      { from: 'screening', to: 'study', at: '2026-07-01T08:00:00Z', by: 'لجنة المبادرات' },
      { from: 'study', to: 'approval', at: '2026-08-10T08:00:00Z', by: 'لجنة المبادرات', decisionId: 'MDN-DEC-2026-0011' }
    ]
  },
  {
    id: 'MDN-INIT-2026-0008', title: 'صيانة وتشغيل دورات مياه الحدائق بالشراكة',
    summary: 'عقد تشغيل وصيانة لدورات مياه 12 حديقة عامة لمدة 3 سنوات مع مؤشرات جودة شهرية معلنة.',
    scope: 'حدائق وكالة الخدمات — القائمة أ.',
    category: 'furniture', district: 'المنطقة المركزية', location: 'حدائق متعددة', lat: 24.4680, lng: 39.6110,
    status: 'screening', channel: 'partner',
    submitterName: 'د. أحمد خياط', submitterEntity: 'جمعية إعمار المدينة للتنمية',
    submitterEmail: 'ahmad@emaar-m.example', submitterPhone: '0551000007',
    budget: 900000, spent: 0, fundingModel: 'operation',
    startDate: null, endDate: null,
    orgUnitId: 'ou-services', ownerName: 'أ. ريم الجهني', beneficiaries: 50000,
    scores: {},
    notes: '',
    statusHistory: [
      { from: 'submitted', to: 'screening', at: '2026-08-22T08:00:00Z', by: 'أ. ريم الجهني' }
    ]
  },
  {
    id: 'MDN-INIT-2026-0009', title: 'ملاعب أحياء مصغرة فوق أراضٍ مهملة',
    summary: 'تحويل 5 أراضٍ فضاء إلى ملاعب مصغرة بأرضيات مطاطية وإنارة، بتمويل رعاة محليين وإشراف بلدي.',
    scope: 'أحياء الحرة الغربية وسيد الشهداء والجرف.',
    category: 'parks', district: 'الحرة الغربية', location: 'خمسة مواقع مرشحة', lat: 24.4620, lng: 39.5850,
    status: 'submitted', channel: 'public',
    submitterName: 'أ. ناصر الزهراني', submitterEntity: 'مبادرة فردية',
    submitterEmail: 'partner@example.com', submitterPhone: '0551000009',
    budget: 1500000, spent: 0, fundingModel: 'sponsorship',
    startDate: null, endDate: null,
    orgUnitId: null, ownerName: '', beneficiaries: 20000,
    scores: {},
    notes: '',
    statusHistory: []
  },
  {
    id: 'MDN-INIT-2026-0010', title: 'محطات شرب مبردة على طريق الهجرة',
    summary: 'مقترح تركيب 25 محطة شرب مبردة تعمل بالطاقة الشمسية — اعتُذر عنه لتعارضه مع مشروع قائم للمياه الوطنية.',
    scope: '—',
    category: 'furniture', district: 'العوالي', location: 'طريق الهجرة', lat: 24.4300, lng: 39.6000,
    status: 'rejected', channel: 'public',
    submitterName: 'أ. ماجد السحيمي', submitterEntity: 'مبادرة فردية',
    submitterEmail: 'majed@example.com', submitterPhone: '0551000011',
    budget: 620000, spent: 0, fundingModel: 'fullFunding',
    startDate: null, endDate: null,
    orgUnitId: null, ownerName: '', beneficiaries: 35000,
    scores: { strategic: 2, impact: 3, feasibility: 2, readiness: 3, risk: 2 },
    notes: 'يُعاد توجيه المقترح إلى شركة المياه الوطنية.',
    statusHistory: [
      { from: 'submitted', to: 'screening', at: '2026-07-05T08:00:00Z', by: 'أ. ريم الجهني' },
      { from: 'screening', to: 'rejected', at: '2026-07-19T08:00:00Z', by: 'لجنة المبادرات', decisionId: 'MDN-DEC-2026-0012' }
    ]
  },
  {
    id: 'MDN-INIT-2026-0011', title: 'تحسين السلامة المرورية حول 8 مدارس',
    summary: 'مطبات ذكية وعلامات مضيئة وممرات ملونة حول 8 مدارس ضمن حملة «طرق آمنة لمدارسنا»، بتمويل مشترك.',
    scope: 'مدارس الحرة الشرقية والعزيزية.',
    category: 'safety', district: 'العزيزية', location: 'محيط 8 مدارس', lat: 24.4550, lng: 39.6440,
    sites: [
      { id: 'site-0011-a', name: 'مدرسة العزيزية الابتدائية', geometry: { type: 'point', coords: [[24.4550, 39.6440]] } },
      { id: 'site-0011-b', name: 'مجمع مدارس الحرة الشرقية', geometry: { type: 'point', coords: [[24.4705, 39.6368]] } },
      { id: 'site-0011-c', name: 'متوسطة العزيزية للبنات', geometry: { type: 'point', coords: [[24.4512, 39.6475]] } }
    ],
    portfolioId: 'pf-madinah-proposed', campaignId: 'cmp-safe-paths',
    status: 'onHold', channel: 'partner',
    submitterName: 'م. خالد الرشيدي', submitterEntity: 'شركة واحة البناء للمقاولات',
    submitterEmail: 'k.r@waha.example', submitterPhone: '0551000001',
    budget: 780000, spent: 0, fundingModel: 'coFunding',
    startDate: null, endDate: null,
    orgUnitId: 'ou-projects', ownerName: 'م. هند العمري', beneficiaries: 9500,
    scores: { strategic: 4, impact: 5, feasibility: 4, readiness: 3, risk: 3 },
    notes: 'معلقة لحين اعتماد وزارة التعليم لقائمة المدارس النهائية.',
    statusHistory: [
      { from: 'submitted', to: 'screening', at: '2026-06-01T08:00:00Z', by: 'أ. ريم الجهني' },
      { from: 'screening', to: 'study', at: '2026-06-12T08:00:00Z', by: 'لجنة المبادرات' },
      { from: 'study', to: 'approval', at: '2026-07-08T08:00:00Z', by: 'لجنة المبادرات' },
      { from: 'approval', to: 'onHold', at: '2026-07-25T08:00:00Z', by: 'لجنة المبادرات', decisionId: 'MDN-DEC-2026-0013' }
    ]
  },
  {
    id: 'MDN-INIT-2026-0012', title: 'واجهة سيد الشهداء — أثاث وخدمات زوار',
    summary: 'تبنّي احتياج الأثاث البلدي للواجهة المطلة على جبل أحد: جلسات ومظلات ونوافير شرب برعاية شريكين.',
    scope: 'الواجهة الشمالية كاملة.',
    category: 'furniture', district: 'سيد الشهداء', location: 'واجهة جبل أحد', lat: 24.5040, lng: 39.6130,
    status: 'draft', channel: 'internal',
    submitterName: 'أ. ريم الجهني', submitterEntity: 'مكتب إدارة المبادرات',
    submitterEmail: 'pmo@amana.example', submitterPhone: '0551000010',
    budget: 540000, spent: 0, fundingModel: 'sponsorship',
    startDate: null, endDate: null,
    orgUnitId: 'ou-community', ownerName: '', beneficiaries: 25000,
    scores: {},
    notes: 'مسودة داخلية قبل الطرح.',
    statusHistory: []
  }
];

// ربط المبادرات بالشركاء
export const DEMO_INITIATIVE_PARTNERS = [
  { id: 'ip-001', initiativeId: 'MDN-INIT-2026-0001', partnerId: 'MDN-PRT-2026-0002', model: 'coFunding', contribution: 'تمويل 40% + التشغيل والصيانة لسنتين', signedAt: '2026-03-08' },
  { id: 'ip-002', initiativeId: 'MDN-INIT-2026-0001', partnerId: 'MDN-PRT-2026-0004', model: 'inKind', contribution: 'أيام تطوعية للزراعة (120 متطوعًا)', signedAt: '2026-03-20' },
  { id: 'ip-003', initiativeId: 'MDN-INIT-2026-0002', partnerId: 'MDN-PRT-2026-0003', model: 'fullFunding', contribution: 'تمويل كامل ضمن برنامج المسؤولية المجتمعية', signedAt: '2026-07-28' },
  { id: 'ip-004', initiativeId: 'MDN-INIT-2026-0003', partnerId: 'MDN-PRT-2026-0001', model: 'execution', contribution: 'تنفيذ مباشر بأسعار تفضيلية', signedAt: '2026-03-01' },
  { id: 'ip-005', initiativeId: 'MDN-INIT-2026-0004', partnerId: 'MDN-PRT-2026-0006', model: 'fullFunding', contribution: 'تمويل وتنفيذ كامل المظلات', signedAt: '2025-09-20' },
  { id: 'ip-006', initiativeId: 'MDN-INIT-2026-0005', partnerId: 'MDN-PRT-2026-0004', model: 'inKind', contribution: 'تشغيل تطوعي وبرامج مجتمعية', signedAt: '2025-02-10' },
  { id: 'ip-007', initiativeId: 'MDN-INIT-2026-0005', partnerId: 'MDN-PRT-2026-0007', model: 'coFunding', contribution: 'تمويل 50% من التجهيزات', signedAt: '2025-02-10' },
  { id: 'ip-008', initiativeId: 'MDN-INIT-2026-0008', partnerId: 'MDN-PRT-2026-0007', model: 'operation', contribution: 'تشغيل وصيانة بمؤشرات جودة معلنة', signedAt: null }
];

// معالم التنفيذ
export const DEMO_MILESTONES = [
  { id: 'ms-101', initiativeId: 'MDN-INIT-2026-0001', title: 'تجهيز التربة وشبكة الري', due: '2026-05-15', done: true, doneAt: '2026-05-10' },
  { id: 'ms-102', initiativeId: 'MDN-INIT-2026-0001', title: 'زراعة القطاع الأول (400 شجرة)', due: '2026-07-01', done: true, doneAt: '2026-07-05' },
  { id: 'ms-103', initiativeId: 'MDN-INIT-2026-0001', title: 'زراعة القطاع الثاني (400 شجرة)', due: '2026-09-01', done: false, doneAt: null },
  { id: 'ms-104', initiativeId: 'MDN-INIT-2026-0001', title: 'زراعة القطاع الثالث والتسليم', due: '2026-11-15', done: false, doneAt: null },
  { id: 'ms-301', initiativeId: 'MDN-INIT-2026-0003', title: 'إزالة الرصف القديم', due: '2026-04-15', done: true, doneAt: '2026-04-12' },
  { id: 'ms-302', initiativeId: 'MDN-INIT-2026-0003', title: 'رصف المقطع الأول (1.2 كم)', due: '2026-06-15', done: true, doneAt: '2026-06-25' },
  { id: 'ms-303', initiativeId: 'MDN-INIT-2026-0003', title: 'رصف المقطع الثاني والمنحدرات', due: '2026-08-15', done: false, doneAt: null },
  { id: 'ms-304', initiativeId: 'MDN-INIT-2026-0003', title: 'التشجير الجانبي والتسليم', due: '2026-09-10', done: false, doneAt: null },
  { id: 'ms-401', initiativeId: 'MDN-INIT-2026-0004', title: 'تصنيع وتوريد المظلات', due: '2026-01-30', done: true, doneAt: '2026-01-25' },
  { id: 'ms-402', initiativeId: 'MDN-INIT-2026-0004', title: 'التركيب والتشغيل التجريبي', due: '2026-05-15', done: true, doneAt: '2026-05-20' },
  { id: 'ms-501', initiativeId: 'MDN-INIT-2026-0005', title: 'الأعمال الترابية والبنية', due: '2025-06-30', done: true, doneAt: '2025-06-28' },
  { id: 'ms-502', initiativeId: 'MDN-INIT-2026-0005', title: 'المسطحات والألعاب والتسليم', due: '2025-12-10', done: true, doneAt: '2025-12-08' }
];

// المنافع المستهدفة والمتحققة
export const DEMO_BENEFITS = [
  { id: 'bn-101', initiativeId: 'MDN-INIT-2026-0001', title: 'خفض درجة الحرارة المحسوسة على المحور', unit: 'درجة مئوية', baseline: 0, target: 4, actual: 2.5, measuredAt: '2026-08-15', owner: 'م. فهد المطيري' },
  { id: 'bn-102', initiativeId: 'MDN-INIT-2026-0001', title: 'أشجار مزروعة حية بعد 6 أشهر', unit: 'شجرة', baseline: 0, target: 1200, actual: 780, measuredAt: '2026-08-15', owner: 'جمعية سقيا وظل' },
  { id: 'bn-401', initiativeId: 'MDN-INIT-2026-0004', title: 'مساحة مظللة مضافة', unit: 'م²', baseline: 0, target: 2800, actual: 2800, measuredAt: '2026-06-10', owner: 'م. فهد المطيري' },
  { id: 'bn-402', initiativeId: 'MDN-INIT-2026-0004', title: 'رضا الزوار عن الساحات', unit: '%', baseline: 62, target: 85, actual: 81, measuredAt: '2026-08-01', owner: 'إدارة الشراكة المجتمعية' },
  { id: 'bn-501', initiativeId: 'MDN-INIT-2026-0005', title: 'زوار الحديقة أسبوعيًا', unit: 'زائر', baseline: 0, target: 3500, actual: 4100, measuredAt: '2026-03-01', owner: 'فريق دربك أخضر' },
  { id: 'bn-502', initiativeId: 'MDN-INIT-2026-0005', title: 'رضا سكان الحي عن المرافق', unit: '%', baseline: 48, target: 75, actual: 73, measuredAt: '2026-03-15', owner: 'إدارة الشراكة المجتمعية' },
  { id: 'bn-301', initiativeId: 'MDN-INIT-2026-0003', title: 'طلاب يصلون مشيًا بأمان', unit: 'طالب', baseline: 900, target: 2400, actual: null, measuredAt: null, owner: 'م. هند العمري' }
];

// سجل المخاطر
export const DEMO_RISKS = [
  { id: 'rk-101', initiativeId: 'MDN-INIT-2026-0001', title: 'إجهاد حراري يهدد شتلات الصيف', probability: 3, impact: 3, response: 'جدولة الزراعة مساءً وزيادة دورات الري', owner: 'جمعية سقيا وظل', status: 'open' },
  { id: 'rk-102', initiativeId: 'MDN-INIT-2026-0001', title: 'تعارض مع أعمال حفر لمزود اتصالات', probability: 2, impact: 3, response: 'تنسيق مسبق للمسارات مع إدارة التراخيص', owner: 'م. فهد المطيري', status: 'mitigated' },
  { id: 'rk-301', initiativeId: 'MDN-INIT-2026-0003', title: 'تأخر توريد البلاط المطابق للمواصفة', probability: 3, impact: 4, response: 'اعتماد مورّدين بديلين وتقديم أوامر الشراء', owner: 'م. خالد الرشيدي', status: 'open' },
  { id: 'rk-302', initiativeId: 'MDN-INIT-2026-0003', title: 'إغلاقات مرورية تربك محيط المدارس', probability: 2, impact: 3, response: 'جدولة الأعمال في الإجازة الصيفية', owner: 'م. فهد المطيري', status: 'mitigated' },
  { id: 'rk-201', initiativeId: 'MDN-INIT-2026-0002', title: 'تأخر فسح الأجهزة الذكية جمركيًا', probability: 2, impact: 4, response: 'الشحن المبكر قبل موعد الإطلاق بشهرين', owner: 'مجموعة نور المدينة', status: 'open' },
  { id: 'rk-401', initiativeId: 'MDN-INIT-2026-0004', title: 'تمدد القماش تحت الرياح الموسمية', probability: 2, impact: 2, response: 'فحص شد دوري ضمن عقد الصيانة', owner: 'مؤسسة عمران', status: 'open' }
];

// مؤشرات الأداء على مستوى المنصة
export const DEMO_KPIS = [
  { id: 'kpi-01', initiativeId: null, title: 'مبادرات نشطة', unit: 'مبادرة', target: 25, actual: 6, period: '2026' },
  { id: 'kpi-02', initiativeId: null, title: 'قيمة مساهمات الشركاء', unit: 'ريال', target: 15000000, actual: 8100000, period: '2026' },
  { id: 'kpi-03', initiativeId: null, title: 'متوسط أيام الفرز (G0)', unit: 'يوم', target: 14, actual: 12, period: '2026' },
  { id: 'kpi-04', initiativeId: null, title: 'نسبة المنافع المتحققة عند الإقفال', unit: '%', target: 85, actual: 96, period: '2026' }
];

// المراجعات (تقييمات لجنة عند البوابات)
export const DEMO_REVIEWS = [
  { id: 'rv-001', initiativeId: 'MDN-INIT-2026-0007', gateId: 'G1', reviewer: 'د. سالم الأنصاري', at: '2026-08-05T08:00:00Z', recommendation: 'المضي للاعتماد بشرط موافقة هيئة التطوير', notes: 'الجدوى الفنية تحتاج مسحًا طبوغرافيًا للمقطع الأوسط.' },
  { id: 'rv-002', initiativeId: 'MDN-INIT-2026-0007', gateId: 'G1', reviewer: 'م. هند العمري', at: '2026-08-06T08:00:00Z', recommendation: 'المضي للاعتماد', notes: 'الأثر المجتمعي مرتفع ويخدم مسارًا استراتيجيًا.' },
  { id: 'rv-003', initiativeId: 'MDN-INIT-2026-0006', gateId: 'G1', reviewer: 'د. سالم الأنصاري', at: '2026-08-20T08:00:00Z', recommendation: 'استكمال المتطلبات', notes: 'قائمة المواقع الأولية تتداخل مع عقود نظافة قائمة.' },
  { id: 'rv-004', initiativeId: 'MDN-INIT-2026-0008', gateId: 'G0', reviewer: 'أ. ريم الجهني', at: '2026-08-26T08:00:00Z', recommendation: 'المضي للدراسة', notes: 'الطلب مكتمل والجهة مؤهلة تشغيليًا.' }
];

// قرارات البوابات
export const DEMO_DECISIONS = [
  { id: 'MDN-DEC-2026-0001', initiativeId: 'MDN-INIT-2026-0001', gateId: 'G0', outcome: 'pass', at: '2026-01-25T08:00:00Z', by: 'لجنة المبادرات', rationale: 'طلب مكتمل ضمن نطاق حملة التشجير.' },
  { id: 'MDN-DEC-2026-0002', initiativeId: 'MDN-INIT-2026-0001', gateId: 'G1', outcome: 'pass', at: '2026-02-20T08:00:00Z', by: 'لجنة المبادرات', rationale: 'درجة مفاضلة 92 — أولوية قصوى.' },
  { id: 'MDN-DEC-2026-0003', initiativeId: 'MDN-INIT-2026-0001', gateId: 'G2', outcome: 'pass', at: '2026-03-10T08:00:00Z', by: 'لجنة المبادرات', rationale: 'وُقعت اتفاقية الشراكة مع الجمعية والفريق التطوعي.' },
  { id: 'MDN-DEC-2026-0004', initiativeId: 'MDN-INIT-2026-0001', gateId: 'G3', outcome: 'pass', at: '2026-04-01T08:00:00Z', by: 'لجنة المبادرات', rationale: 'الخطة التنفيذية معتمدة والموقع جاهز.' },
  { id: 'MDN-DEC-2026-0005', initiativeId: 'MDN-INIT-2026-0002', gateId: 'G0', outcome: 'pass', at: '2026-05-18T08:00:00Z', by: 'لجنة المبادرات', rationale: 'ضمن أولويات كفاءة الطاقة.' },
  { id: 'MDN-DEC-2026-0006', initiativeId: 'MDN-INIT-2026-0002', gateId: 'G1', outcome: 'pass', at: '2026-06-22T08:00:00Z', by: 'لجنة المبادرات', rationale: 'جدوى ممتازة وعائد تشغيلي واضح.' },
  { id: 'MDN-DEC-2026-0007', initiativeId: 'MDN-INIT-2026-0002', gateId: 'G2', outcome: 'pass', at: '2026-08-02T08:00:00Z', by: 'لجنة المبادرات', rationale: 'اتفاقية تمويل كامل موقعة.' },
  { id: 'MDN-DEC-2026-0008', initiativeId: 'MDN-INIT-2026-0003', gateId: 'G3', outcome: 'pass', at: '2026-03-15T08:00:00Z', by: 'لجنة المبادرات', rationale: 'التصاريح مكتملة وجدولة الأعمال تراعي المدارس.' },
  { id: 'MDN-DEC-2026-0009', initiativeId: 'MDN-INIT-2026-0005', gateId: 'G4', outcome: 'pass', at: '2026-04-10T08:00:00Z', by: 'لجنة المبادرات', rationale: 'تحقق منافع 96% وتوثيق دروس مستفادة.' },
  { id: 'MDN-DEC-2026-0010', initiativeId: 'MDN-INIT-2026-0006', gateId: 'G0', outcome: 'pass', at: '2026-08-14T08:00:00Z', by: 'لجنة المبادرات', rationale: 'ضمن مستهدفات الفرز من المصدر.' },
  { id: 'MDN-DEC-2026-0011', initiativeId: 'MDN-INIT-2026-0007', gateId: 'G1', outcome: 'pass', at: '2026-08-10T08:00:00Z', by: 'لجنة المبادرات', rationale: 'المضي للاعتماد مع اشتراط موافقة هيئة التطوير.' },
  { id: 'MDN-DEC-2026-0012', initiativeId: 'MDN-INIT-2026-0010', gateId: 'G0', outcome: 'reject', at: '2026-07-19T08:00:00Z', by: 'لجنة المبادرات', rationale: 'تعارض مباشر مع مشروع قائم للمياه الوطنية.' },
  { id: 'MDN-DEC-2026-0013', initiativeId: 'MDN-INIT-2026-0011', gateId: 'G2', outcome: 'hold', at: '2026-07-25T08:00:00Z', by: 'لجنة المبادرات', rationale: 'بانتظار اعتماد قائمة المدارس من الوزارة.' }
];

// فحوص الجودة
export const DEMO_QUALITY_CHECKS = [
  { id: 'qc-301', initiativeId: 'MDN-INIT-2026-0003', title: 'اختبار ميول المنحدرات وفق كود الوصول الشامل', at: '2026-06-28', result: 'pass', inspector: 'م. هند العمري', notes: 'مطابق في 14 من 15 منحدرًا — أُعيد منحدر واحد.' },
  { id: 'qc-302', initiativeId: 'MDN-INIT-2026-0003', title: 'فحص سماكة البلاط ومقاومة الانزلاق', at: '2026-07-15', result: 'pass', inspector: 'مختبر معتمد', notes: '' },
  { id: 'qc-401', initiativeId: 'MDN-INIT-2026-0004', title: 'اختبار شد المظلات تحت حمل رياح 90 كم/س', at: '2026-05-18', result: 'pass', inspector: 'استشاري الإنشاءات', notes: '' },
  { id: 'qc-101', initiativeId: 'MDN-INIT-2026-0001', title: 'جودة شبكة الري ونسب التسرب', at: '2026-06-01', result: 'fail', inspector: 'م. فهد المطيري', notes: 'تسرب في الخط الفرعي 3 — أُصلح وأُعيد الفحص بنجاح في 2026-06-08.' }
];
