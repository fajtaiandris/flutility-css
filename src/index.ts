import {
  calculateClamp,
  calculateSpaceScale,
  calculateTypeScale,
} from 'utopia-core';
import { parseConfig, type FlutilityCssConfig } from './schema.js';

export { flutilityCssConfigSchema } from './schema.js';
export type { FlutilityCssConfig } from './schema.js';

function flattenColors(colors: Record<string, string | Record<string, string>>): Map<string, string> {
  const entries = new Map<string, string>();
  const add = (name: string, value: string): void => {
    if (entries.has(name)) throw new Error(`Color names collide at ${name}`);
    entries.set(name, value);
  };
  for (const [name, value] of Object.entries(colors)) {
    if (typeof value === 'string') {
      add(name, value);
    } else {
      for (const [shade, color] of Object.entries(value)) add(name + '-' + shade, color);
    }
  }
  return entries;
}

function rule(selector: string, declarations: Map<string, string>): string {
  return selector + ' {\n' +
    [...declarations].map(([property, value]) => '  ' + property + ': ' + value + ';').join('\n') +
    '\n}\n';
}

/** Generate CSS custom properties for fluid scales, clamps, and colors. */
export function generateCss(config: FlutilityCssConfig): string {
  const { type, space, clamps, colors, themes, selector, prefix } = parseConfig(config);

  const declarations = new Map<string, string>();
  const add = (name: string, value: string): void => {
    const property = '--' + prefix + '-' + name;
    const previous = declarations.get(property);
    if (previous && previous !== value) throw new Error('Conflicting values for ' + property);
    declarations.set(property, value);
  };

  if (type) {
    for (const step of calculateTypeScale(type)) {
      add('step-' + step.label, step.clamp);
    }
  }

  if (space) {
    const scale = calculateSpaceScale(space);
    for (const size of [...scale.sizes, ...scale.oneUpPairs, ...scale.customPairs]) {
      add('space-' + size.label, size.clamp);
    }
  }

  for (const [name, clamp] of Object.entries(clamps ?? {})) {
    add('clamp-' + name, calculateClamp(clamp));
  }

  const baseColors = flattenColors(colors ?? {});
  for (const [name, value] of baseColors) add('color-' + name, value);

  const rules = [rule(selector, declarations)];
  for (const [theme, { colors: overrides }] of Object.entries(themes ?? {})) {
    const themeDeclarations = new Map<string, string>();
    for (const [name, value] of flattenColors(overrides)) {
      if (!baseColors.has(name)) throw new Error(`Theme ${theme} overrides unknown color ${name}`);
      themeDeclarations.set('--' + prefix + '-color-' + name, value);
    }
    rules.push(rule(`[data-theme="${theme}"]`, themeDeclarations));
  }
  return rules.join('\n');
}
