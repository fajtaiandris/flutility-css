# flutility-css

Generate fluid typography, fluid spacing and color CSS variables from a small JSON config.


## Use the CLI

Create `flutility.config.json` in your app:

```json
{
  "type": {
    "minWidth": 320,
    "maxWidth": 1240,
    "minFontSize": 18,
    "maxFontSize": 20,
    "minTypeScale": 1.2,
    "maxTypeScale": 1.25,
    "positiveSteps": 3,
    "negativeSteps": 2
  },
  "colors": {
    "surface": "#fff",
    "text": "#171717",
    "brand": { "primary": "#6246ea" }
  },
  "themes": {
    "dark": {
      "colors": { "surface": "#171717", "text": "#f5f5f5" }
    }
  }
}
```

Generate the stylesheet, then import `src/flutility.css` from your app:

```sh
npx flutility-css --out src/flutility.css
npx flutility-css --out src/flutility.css --watch
```