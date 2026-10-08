// Helpers for the HTML & CSS playground.
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

</body>
</html>
`;
export const CSS_STARTER = `/* Write your CSS here */

`;

const LINK = '<link rel="stylesheet" href="style.css">';
const hasLink = (html: string): boolean => /<link[^>]*href=["']style\.css["'][^>]*>/i.test(html);

// The downloaded index.html must point at style.css so the two files work together.
export function withStylesheetLink(html: string): string {
  if (hasLink(html)) return html;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, () => `  ${LINK}\n</head>`);
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => `${m}\n  ${LINK}`);
  return `${LINK}\n${html}`;
}

// The preview is one self-contained document: the style.css link is replaced by the CSS text.
export function buildPreview(html: string, css: string): string {
  const style = `<style>\n${css.replace(/<\/style/gi, '<\\/style')}\n</style>`;
  const noLink = html.replace(/<link[^>]*href=["']style\.css["'][^>]*>/gi, '');
  if (/<\/head>/i.test(noLink)) return noLink.replace(/<\/head>/i, () => `${style}\n</head>`);
  if (/<head[^>]*>/i.test(noLink)) return noLink.replace(/<head[^>]*>/i, (m) => `${m}\n${style}`);
  return `${style}\n${noLink}`;
}
