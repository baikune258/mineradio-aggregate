const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function findNewestRceditInCache(cacheRoot) {
  if (!cacheRoot || !fs.existsSync(cacheRoot)) return null;
  var newest = null;
  var stack = [cacheRoot];
  while (stack.length) {
    var dir = stack.pop();
    var entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { continue; }
    entries.forEach(function(entry) {
      var fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        return;
      }
      if (entry.isFile() && entry.name.toLowerCase() === 'rcedit-x64.exe') {
        var stat = fs.statSync(fullPath);
        if (!newest || stat.mtimeMs > newest.mtimeMs) newest = { path: fullPath, mtimeMs: stat.mtimeMs };
      }
    });
  }
  return newest && newest.path;
}

function resolveRcedit(projectDir) {
  var candidates = [
    path.join(projectDir, 'node_modules', 'rcedit', 'bin', 'rcedit-x64.exe')
  ];
  var localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    var cached = findNewestRceditInCache(path.join(localAppData, 'electron-builder', 'Cache', 'winCodeSign'));
    if (cached) candidates.push(cached);
  }
  candidates.push(path.join(projectDir, 'node_modules', 'electron-winstaller', 'vendor', 'rcedit.exe'));
  var hit = candidates.find(function(candidate) { return candidate && fs.existsSync(candidate); });
  if (!hit) throw new Error('No usable rcedit executable was found for Mineradio icon injection.');
  return hit;
}

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const appName = context.packager.appInfo.productFilename || 'Mineradio';
  const productName = context.packager.appInfo.productName || appName;
  const companyName = context.packager.appInfo.companyName || productName;
  const exePath = path.join(context.appOutDir, `${appName}.exe`);
  const iconPath = path.join(context.packager.info.buildResourcesDir, 'icon.ico');
  const rceditPath = resolveRcedit(context.packager.projectDir);

  if (!fs.existsSync(exePath)) throw new Error(`Mineradio executable was not found: ${exePath}`);
  if (!fs.existsSync(iconPath)) throw new Error(`Mineradio icon was not found: ${iconPath}`);

  const version = context.packager.appInfo.version;
  console.log(`  • injecting Mineradio resources  rcedit=${rceditPath}`);
  const rceditArgs = [
    exePath,
    '--set-icon', iconPath,
    '--set-version-string', 'FileDescription', productName,
    '--set-version-string', 'ProductName', productName,
    '--set-version-string', 'CompanyName', companyName,
    '--set-version-string', 'OriginalFilename', `${appName}.exe`,
    '--set-file-version', version,
    '--set-product-version', version
  ];
  // Linux 交叉打包 Windows 目标时，rcedit 是 Windows 可执行文件，需经 wine 运行。
  if (process.platform === 'linux') {
    const wineBin = '/usr/bin/wine';
    if (!fs.existsSync(wineBin)) throw new Error(`wine not found: ${wineBin}`);
    execFileSync(wineBin, [rceditPath].concat(rceditArgs), { stdio: 'inherit' });
  } else {
    execFileSync(rceditPath, rceditArgs, { stdio: 'inherit' });
  }
};
