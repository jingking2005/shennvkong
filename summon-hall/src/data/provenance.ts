/**
 * 数据来源等级（变更单 §0.1）：所有接入数据必须字段级标记，禁止混写。
 */

export type DataProvenance =
  | 'direct'         // 归档中实际存在的文件
  | 'wiki-data'      // Wiki 抓取字段
  | 'native-schema'  // APK so 符号/字段名（只证明结构）
  | 'inferred'       // 推测，待验证
  | 'original-fill'; // 离线可玩性原创补齐

export interface Provenance {
  level: DataProvenance;
  sourceFile?: string;
  sourceNote?: string;
  verifiedAt?: string;
}

export const PROVENANCE_LEVELS: readonly DataProvenance[] = [
  'direct', 'wiki-data', 'native-schema', 'inferred', 'original-fill',
];

export function prov(level: DataProvenance, sourceFile?: string, sourceNote?: string): Provenance {
  return { level, sourceFile, sourceNote };
}

export function isProvenance(x: unknown): x is Provenance {
  if (typeof x !== 'object' || x === null) return false;
  const p = x as Record<string, unknown>;
  return typeof p.level === 'string' && (PROVENANCE_LEVELS as readonly string[]).includes(p.level);
}
