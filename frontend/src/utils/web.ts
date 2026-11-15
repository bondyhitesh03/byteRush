// Helpers for the HTML, CSS & JavaScript playground.
import { bridgeScript } from './jsWorker';

export const HTML_STARTER = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Page</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <!-- Write your HTML here -->

  <script src="script.js"></script>
</body>
</html>
`;
export const CSS_STARTER = `/* Write your CSS here */

`;
export const JS_STARTER = `// Write your JavaScript here

`;

const CSS_LINK = '<link rel="stylesheet" href="style.css">';
const JS_TAG = '<script src="script.js"></script>';
const cssLinkRe = /<link[^>]*href=["']style\.css["'][^>]*>/i;
const jsTagRe = /<script[^>]*src=["']script\.js["'][^>]*>\s*<\/script>/i;

// The downloaded index.html must point at style.css and script.js so the three files work together.
export function withAssetLinks(html: string): string {
  let out = html;
  if (!cssLinkRe.test(out)) {
    if (/<\/head>/i.test(out)) out = out.replace(/<\/head>/i, () => `  ${CSS_LINK}\n</head>`);
    else if (/<head[^>]*>/i.test(out)) out = out.replace(/<head[^>]*>/i, (m) => `${m}\n  ${CSS_LINK}`);
    else out = `${CSS_LINK}\n${out}`;
  }
  if (!jsTagRe.test(out)) {
    if (/<\/body>/i.test(out)) out = out.replace(/<\/body>/i, () => `  ${JS_TAG}\n</body>`);
    else out = `${out}\n${JS_TAG}\n`;
  }
  return out;
}

// The preview is one self-contained document: style.css and script.js become inline <style> and <script>,
// and a tiny bridge forwards console output and errors to ByteRush's console panel.
export function buildPreview(html: string, css: string, js: string, bridge = true): string {
  const style = `<style>\n${css.replace(/<\/style/gi, '<\\/style')}\n</style>`;
  const script = `<script>\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>`;
  let doc = html.replace(/<link[^>]*href=["']style\.css["'][^>]*>/gi, '');
  if (/<\/head>/i.test(doc)) doc = doc.replace(/<\/head>/i, () => `${style}\n</head>`);
  else if (/<head[^>]*>/i.test(doc)) doc = doc.replace(/<head[^>]*>/i, (m) => `${m}\n${style}`);
  else doc = `${style}\n${doc}`;
  if (jsTagRe.test(doc)) doc = doc.replace(new RegExp(jsTagRe.source, 'gi'), () => script);
  else if (js.trim()) doc = /<\/body>/i.test(doc) ? doc.replace(/<\/body>/i, () => `${script}\n</body>`) : `${doc}\n${script}`;
  if (bridge) {
    const b = bridgeScript();
    doc = /<head[^>]*>/i.test(doc) ? doc.replace(/<head[^>]*>/i, (m) => `${m}\n${b}`) : `${b}\n${doc}`;
  }
  return doc;
}
