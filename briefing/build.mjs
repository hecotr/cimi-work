import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFile(join(root, path), 'utf8');
const [html, styles, tokens, base, data, app, font, license] = await Promise.all([
  read('index.html'), read('styles.css'), read('tokens.css'), read('base.css'), read('data.js'), read('app.js'), readFile(join(root, 'fonts/noto-serif-sc-briefing.woff2')), read('fonts/OFL.txt')
]);
const css = styles.replace('@import url("./tokens.css");', () => tokens).replace('@import url("./base.css");', () => base)
  .replace('./fonts/noto-serif-sc-briefing.woff2', () => `data:font/woff2;base64,${font.toString('base64')}`);
const escapeScript = (source) => source.replace(/<\/script/gi, '<\\/script');
const output = html.replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${css}\n</style>`)
  .replace('<script src="data.js"></script>', () => `<script>\n${escapeScript(data)}\n</script>`)
  .replace('<script src="app.js"></script>', () => `<script>\n${escapeScript(app)}\n</script>`)
  .replace('</head>', () => `<script type="text/plain" id="fontLicense">\n${escapeScript(license)}\n</script>\n</head>`);
if (/<script\b[^>]*\bsrc=|<link\b[^>]*rel="stylesheet"|@import\s/.test(output)) throw new Error('Standalone export still has external code dependencies');
const target = join(root, 'Cimi-Work-产品介绍与蓝图.html');
await writeFile(target, output, 'utf8');
console.log(`Built ${target} (${Buffer.byteLength(output)} bytes); CSS, JavaScript and the display font are embedded.`);
