import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { generateCss } from "../dist/index.js";

test("generates every configured step and matches the CSS snapshot", (t) => {
  const css = generateCss({
    selector: ".theme",
    prefix: "fluid",
    type: {
      minWidth: 320,
      maxWidth: 1240,
      minFontSize: 18,
      maxFontSize: 20,
      minTypeScale: 1.2,
      maxTypeScale: 1.25,
      positiveSteps: 3,
      negativeSteps: 2,
    },
    space: {
      minWidth: 320,
      maxWidth: 1240,
      minSize: 18,
      maxSize: 20,
      positiveSteps: [1.5, 2, 3],
      negativeSteps: [0.75, 0.5],
      customSizes: ["s-xl"],
    },
    clamps: {
      hero: { minWidth: 320, maxWidth: 1240, minSize: 16, maxSize: 32 },
    },
  });

  assert.equal([...css.matchAll(/^\s+--fluid-step-/gm)].length, 6);
  assert.equal([...css.matchAll(/^\s+--fluid-space-/gm)].length, 12);
  assert.match(css, /--fluid-space-s-xl: clamp\(/);
  assert.match(css, /--fluid-clamp-hero: clamp\(/);
  assert.doesNotMatch(css, /NaN|Infinity/);
  t.assert.fileSnapshot(css, fileURLToPath(new URL("./full.css", import.meta.url)), {
    serializers: [(value) => value],
  });
});

test("rejects empty and invalid width configurations", () => {
  assert.throws(() => generateCss({}), /Provide at least one/);
  assert.throws(
    () =>
      generateCss({
        clamps: {
          bad: { minWidth: 320, maxWidth: 320, minSize: 16, maxSize: 32 },
        },
      }),
    /clamps\.bad\.maxWidth/,
  );
  assert.throws(
    () => generateCss({
      type: {
        minWidth: 320,
        maxWidth: 1240,
        minFontSize: 18,
        maxFontSize: 20,
        minTypeScale: 1.2,
        maxTypeScale: 1.25,
        positiveSteps: [1, 2, 3],
      },
    }),
    /type\.positiveSteps/,
  );
  assert.throws(
    () => generateCss({
      space: {
        minWidth: 320,
        maxWidth: 1240,
        minSize: 18,
        maxSize: 20,
        positiveSteps: 3,
      },
    }),
    /space\.positiveSteps/,
  );
});

test("generates named and grouped colors with partial theme overrides", (t) => {
  const css = generateCss({
    colors: {
      surface: "#fff",
      text: "#171717",
      brand: { primary: "#6246ea", soft: "oklch(0.92 0.05 290)" },
      neutral: { 100: "#f5f5f5" },
    },
    themes: {
      dark: { colors: { surface: "#171717", text: "#f5f5f5", brand: { primary: "#9b8aff" } } },
    },
  });

  assert.match(css, /--flutility-color-neutral-100: #f5f5f5;/);
  assert.match(css, /\[data-theme="dark"\] \{\n  --flutility-color-surface:/);
  assert.doesNotMatch(css.split('[data-theme="dark"]')[1], /--flutility-color-brand-soft/);
  t.assert.fileSnapshot(css, fileURLToPath(new URL("./colors.css", import.meta.url)), {
    serializers: [(value) => value],
  });
});

test("rejects unsafe colors, duplicate names, and unknown theme overrides", () => {
  assert.throws(() => generateCss({ colors: { primary: "#fff; color: red" } }), /colors\.primary/);
  assert.throws(() => generateCss({ colors: { brand: { primary: { deep: "#fff" } } } }), /colors\.brand/);
  assert.throws(() => generateCss({
    colors: { "brand-primary": "#fff", brand: { primary: "#000" } },
  }), /Color names collide at brand-primary/);
  assert.throws(() => generateCss({
    colors: { surface: "#fff" },
    themes: { dark: { colors: { missing: "#000" } } },
  }), /Theme dark overrides unknown color missing/);
});
