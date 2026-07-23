import { describe, it, expect } from 'vitest';
import {
  resolveCardImagePath,
  getRarityBorderColor,
  getElementBaseColor,
  shouldUsePlaceholder,
} from '../src/ui/CardImageResolver';

describe('CardImageResolver - resolveCardImagePath', () => {
  it('返回 assets/cards/{slug}.png 格式路径', () => {
    expect(resolveCardImagePath('goddess-athena')).toBe('assets/cards/goddess-athena.png');
  });

  it('处理简单 slug', () => {
    expect(resolveCardImagePath('slime')).toBe('assets/cards/slime.png');
  });

  it('处理含数字的 slug', () => {
    expect(resolveCardImagePath('agent-nine')).toBe('assets/cards/agent-nine.png');
  });
});

describe('getRarityBorderColor', () => {
  it('N 返回灰色', () => {
    expect(getRarityBorderColor('N')).toBe(0x9e9e9e);
  });

  it('R 返回蓝色', () => {
    expect(getRarityBorderColor('R')).toBe(0x42a5f5);
  });

  it('SR 返回金色', () => {
    expect(getRarityBorderColor('SR')).toBe(0xffa726);
  });

  it('UR 返回粉红', () => {
    expect(getRarityBorderColor('UR')).toBe(0xef5350);
  });

  it('LR 返回紫色', () => {
    expect(getRarityBorderColor('LR')).toBe(0xab47bc);
  });

  it('H 前缀变体返回对应基础色', () => {
    expect(getRarityBorderColor('HR')).toBe(0x42a5f5);
    expect(getRarityBorderColor('HSR')).toBe(0xffa726);
    expect(getRarityBorderColor('HUR')).toBe(0xef5350);
  });

  it('未知稀有度返回白色', () => {
    expect(getRarityBorderColor('XX' as any)).toBe(0xffffff);
  });
});

describe('getElementBaseColor', () => {
  it('Passion 返回红色系', () => {
    expect(getElementBaseColor('Passion')).toBe(0xc62828);
  });

  it('Cool 返回蓝色系', () => {
    expect(getElementBaseColor('Cool')).toBe(0x1565c0);
  });

  it('Light 返回绿色系', () => {
    expect(getElementBaseColor('Light')).toBe(0x2e7d32);
  });

  it('Dark 返回紫色系', () => {
    expect(getElementBaseColor('Dark')).toBe(0x6a1b9a);
  });

  it('Special 返回金色系', () => {
    expect(getElementBaseColor('Special')).toBe(0xf57f17);
  });
});

describe('shouldUsePlaceholder', () => {
  it('无可用纹理时返回 true', () => {
    expect(shouldUsePlaceholder('nonexistent-slug', [])).toBe(true);
  });

  it('纹理列表中存在该 slug 时返回 false', () => {
    expect(shouldUsePlaceholder('goddess-athena', ['goddess-athena', 'slime'])).toBe(false);
  });

  it('纹理列表中不存在该 slug 时返回 true', () => {
    expect(shouldUsePlaceholder('demon-lucifer', ['goddess-athena', 'slime'])).toBe(true);
  });
});
