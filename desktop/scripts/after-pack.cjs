// macOS: give the app (and the bundled Java) a local "ad-hoc" signature. Without it, Apple Silicon Macs report
// the downloaded app as "damaged". Users still see the one-time "Open Anyway" step, because the app is not notarized.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

exports.default = async function afterPack(ctx) {
  if (ctx.electronPlatformName !== 'darwin') return;
  const app = path.join(ctx.appOutDir, `${ctx.packager.appInfo.productFilename}.app`);
  const jdk = path.join(app, 'Contents', 'Resources', 'jdk');
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      const st = fs.lstatSync(p);
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) { walk(p); continue; }
      if (name.endsWith('.dylib') || (st.mode & 0o111)) {
        try { execFileSync('codesign', ['--force', '--sign', '-', p], { stdio: 'ignore' }); } catch { /* not a Mach-O file */ }
      }
    }
  };
  walk(jdk);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  console.log('✓ Ad-hoc signed', app);
};
