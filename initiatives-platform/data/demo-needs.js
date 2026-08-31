// احتياجات بنية تحتية تجريبية مطروحة للشراكة — بيانات توضيحية
export const DEMO_NEEDS = [
  {
    id: 'MDN-NEED-2026-0001', title: 'تظليل ممرات مشاة محيط حديقة الملك فهد',
    description: 'تركيب مظلات قماشية مقاومة للحرارة على مسار المشاة الرئيس بطول 800 متر لخدمة مرتادي الحديقة صيفًا.',
    category: 'shading', district: 'الملك فهد', location: 'محيط حديقة الملك فهد المركزية',
    lat: 24.4850, lng: 39.5920, status: 'published', priority: 'high',
    estimatedCost: 950000, beneficiaries: 15000,
    expectedImpact: 'رفع استخدام المسار صيفًا بنسبة 40% وخفض درجة الحرارة المحسوسة.',
    preferredModels: ['fullFunding', 'coFunding'], publishedAt: '2026-07-10', matchedInitiativeId: null
  },
  {
    id: 'MDN-NEED-2026-0002', title: 'إنارة موفرة للطاقة في ممرات حي قباء',
    description: 'استبدال 320 وحدة إنارة تقليدية بوحدات LED ذكية في الممرات الداخلية للحي مع نظام تحكم مركزي.',
    category: 'lighting', district: 'قباء', location: 'الممرات الداخلية شمال مسجد قباء',
    lat: 24.4390, lng: 39.6170, status: 'published', priority: 'high',
    estimatedCost: 1200000, beneficiaries: 22000,
    expectedImpact: 'خفض استهلاك الطاقة 60% وتحسين الشعور بالأمان ليلًا.',
    preferredModels: ['fullFunding', 'execution'], publishedAt: '2026-07-18', matchedInitiativeId: null
  },
  {
    id: 'MDN-NEED-2026-0003', title: 'تأهيل أرصفة شارع السلام بالحرة الشرقية',
    description: 'إعادة رصف وتسوية أرصفة بطول 2.4 كم مع منحدرات ذوي إعاقة وتشجير جانبي.',
    category: 'sidewalks', district: 'الحرة الشرقية', location: 'شارع السلام — من التقاطع الأول حتى الدوار',
    lat: 24.4720, lng: 39.6350, status: 'matched', priority: 'high',
    estimatedCost: 1800000, beneficiaries: 18000,
    expectedImpact: 'مسار مشاة آمن ومتصل يخدم ثلاث مدارس ومركزًا صحيًا.',
    preferredModels: ['execution', 'coFunding'], publishedAt: '2026-05-02', matchedInitiativeId: 'MDN-INIT-2026-0003'
  },
  {
    id: 'MDN-NEED-2026-0004', title: 'ساحة مجتمعية في حي العيون',
    description: 'تحويل أرض فضاء بلدية (4200 م²) إلى ساحة مجتمعية بمسطحات خضراء وألعاب أطفال وجلسات.',
    category: 'parks', district: 'العيون', location: 'الأرض البلدية خلف مركز الحي',
    lat: 24.5010, lng: 39.5780, status: 'published', priority: 'medium',
    estimatedCost: 2600000, beneficiaries: 9000,
    expectedImpact: 'متنفس قريب لسكان الحي ورفع مؤشر الرضا عن المرافق العامة.',
    preferredModels: ['fullFunding', 'operation'], publishedAt: '2026-08-01', matchedInitiativeId: null
  },
  {
    id: 'MDN-NEED-2026-0005', title: 'نقاط فرز نفايات قابلة لإعادة التدوير',
    description: 'تركيب 40 نقطة فرز ثلاثية الحاويات في الأحياء ذات الكثافة العالية مع حملة توعية مرافقة.',
    category: 'cleanliness', district: 'العزيزية', location: 'مواقع موزعة — قائمة إحداثيات مرفقة',
    lat: 24.4570, lng: 39.6480, status: 'published', priority: 'medium',
    estimatedCost: 480000, beneficiaries: 30000,
    expectedImpact: 'رفع نسبة الفرز من المصدر إلى 15% خلال سنة.',
    preferredModels: ['inKind', 'sponsorship', 'operation'], publishedAt: '2026-08-12', matchedInitiativeId: null
  },
  {
    id: 'MDN-NEED-2026-0006', title: 'مسار دراجات دائري في النخيل',
    description: 'إنشاء مسار دراجات معزول بطول 5 كم مع محطات استراحة ومواقف دراجات عند المداخل.',
    category: 'mobility', district: 'النخيل', location: 'الطريق الدائري الداخلي للحي',
    lat: 24.5150, lng: 39.6050, status: 'draft', priority: 'low',
    estimatedCost: 3400000, beneficiaries: 12000,
    expectedImpact: 'تشجيع التنقل النشط وربط الحي بشبكة المسارات القائمة.',
    preferredModels: ['coFunding'], publishedAt: null, matchedInitiativeId: null
  },
  {
    id: 'MDN-NEED-2026-0007', title: 'معالجة نقاط تجمع مياه الأمطار بالرانوناء',
    description: 'تصريف 6 نقاط تجمع متكررة عبر قنوات سطحية وخلايا تشرّب مع رفع منسوب البلاط المتضرر.',
    category: 'rehab', district: 'الرانوناء', location: 'محاور وادي الرانوناء الفرعية',
    lat: 24.4480, lng: 39.5990, status: 'published', priority: 'high',
    estimatedCost: 760000, beneficiaries: 8000,
    expectedImpact: 'إنهاء احتباس المياه خلال 24 ساعة من الهطول.',
    preferredModels: ['execution'], publishedAt: '2026-08-20', matchedInitiativeId: null
  },
  {
    id: 'MDN-NEED-2026-0008', title: 'جلسات وأثاث بلدي لواجهة سيد الشهداء',
    description: 'توريد وتركيب 60 جلسة خرسانية و30 مظلة و20 نافورة شرب على الواجهة المطلة على جبل أحد.',
    category: 'furniture', district: 'سيد الشهداء', location: 'الواجهة الشمالية — موازية لطريق أحد',
    lat: 24.5040, lng: 39.6130, status: 'published', priority: 'medium',
    estimatedCost: 540000, beneficiaries: 25000,
    expectedImpact: 'تحسين تجربة الزوار في محيط موقع تاريخي بارز.',
    preferredModels: ['fullFunding', 'inKind', 'sponsorship'], publishedAt: '2026-08-25', matchedInitiativeId: null
  }
];
