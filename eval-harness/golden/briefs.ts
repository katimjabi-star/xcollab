import type { ProgramBrief } from "@xcollab/synthesizer";

/**
 * Golden brief set, bucket 1 (stratified realistic briefs, EN+AR).
 * Buckets 2-4 (adversarial, constructed edge cases, shipped-failure replays)
 * grow with the product. Synthetic content only — Connected-profile rule.
 */
export const GOLDEN_BRIEFS: ReadonlyArray<{ key: string; brief: ProgramBrief }> = [
  {
    key: "en-collab-platform",
    brief: {
      mission: "Cross-team collaboration platform for secure environments, three-week pilot",
      language: "en",
      timeline: { start: "2026-09-01", end: "2026-09-22" },
      teamHints: ["design", "qa"],
    },
  },
  {
    key: "en-logistics",
    brief: {
      mission: "Field logistics coordination and asset tracking rollout",
      language: "en",
      timeline: { start: "2026-10-01", end: "2027-01-15" },
    },
  },
  {
    key: "en-training-sim",
    brief: {
      mission: "Immersive training simulator procurement and integration program",
      language: "en",
      timeline: { start: "2026-09-15", end: "2027-03-01" },
      teamHints: ["procurement", "integration", "training"],
    },
  },
  {
    key: "en-minimal",
    brief: { mission: "Radio interoperability upgrade", language: "en" },
  },
  {
    key: "en-long-mission",
    brief: {
      mission:
        "Establish a resilient, multi-site secure communications backbone with redundant links, " +
        "unified monitoring, staged migration from legacy systems, operator training, and full " +
        "acceptance testing across every regional facility",
      language: "en",
      timeline: { start: "2026-11-01", end: "2027-06-30" },
    },
  },
  {
    key: "ar-collab-platform",
    brief: {
      mission: "منصة تعاون بين الفرق للبيئات الآمنة، تجربة لمدة ثلاثة أسابيع",
      language: "ar",
      timeline: { start: "2026-09-01", end: "2026-09-22" },
      teamHints: ["التصميم", "الجودة"],
    },
  },
  {
    key: "ar-logistics",
    brief: {
      mission: "تنسيق الخدمات اللوجستية الميدانية وتتبع الأصول",
      language: "ar",
      timeline: { start: "2026-10-01", end: "2027-01-15" },
    },
  },
  {
    key: "ar-training",
    brief: {
      mission: "برنامج التدريب والتأهيل للمشغلين الجدد",
      language: "ar",
    },
  },
  {
    key: "ar-comms",
    brief: {
      mission: "ترقية شبكة الاتصالات الآمنة عبر المواقع الإقليمية",
      language: "ar",
      timeline: { start: "2026-09-10", end: "2027-02-28" },
    },
  },
  {
    key: "ar-minimal",
    brief: { mission: "تحديث أنظمة الرصد", language: "ar" },
  },
];
