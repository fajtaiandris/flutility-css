import {
  calculateClamp,
  calculateSpaceScale,
  calculateTypeScale,
} from 'utopia-core';
import { parseConfig, type FlutilityCssConfig } from './schema.js';

export { flutilityCssConfigSchema } from './schema.js';
export type { FlutilityCssConfig } from './schema.js';

/** Convert Utopia Core results into a reusable CSS custom-property stylesheet. */
export function generateCss(config: FlutilityCssConfig): string {
  const { type, space, clamps, selector, prefix } = parseConfig(config);

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

  return selector + ' {\n' +
    [...declarations].map(([property, value]) => '  ' + property + ': ' + value + ';').join('\n') +
    '\n}\n';
}
