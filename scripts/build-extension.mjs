import { cp, mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageZip = process.argv.includes('--zip');
for (const browser of ['chrome', 'firefox']) {
    const output = path.join(root, 'dist', 'extension', browser);
    // Somente estes dois diretórios gerados são reconstruídos; nunca o código-fonte.
    await rm(output, { recursive: true, force: true });
    await mkdir(output, { recursive: true });
    for (const directory of ['background', 'content', 'shared', 'popup', 'runner', 'assets']) {
        await cp(path.join(root, 'extension', directory), path.join(output, directory), { recursive: true });
    }
    const manifest = JSON.parse(await readFile(path.join(root, 'extension', 'manifests', `${browser}.json`), 'utf8'));
    await writeFile(path.join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    await mkdir(path.join(output, 'vendor'), { recursive: true });
    await cp(path.join(root, 'node_modules/@mozilla/readability/Readability.js'), path.join(output, 'vendor/Readability.js'));
    await cp(path.join(root, 'node_modules/@mozilla/readability/LICENSE.md'), path.join(output, 'vendor/Readability-LICENSE.md'));
    await cp(path.join(root, 'extension/PRIVACY.md'), path.join(output, 'PRIVACY.md'));
    await cp(path.join(root, 'LICENSE'), path.join(output, 'LICENSE'));
    await cp(path.join(root, 'static/img/Logo_header.png'), path.join(output, 'assets/Logo_header.png'));
    for (const [source, target] of [['styleglobal.css', 'site-global.css'], ['style-pesquisa.css', 'site-pesquisa.css'], ['style-resultado.css', 'site-resultado.css']]) {
        const css = await readFile(path.join(root, 'static/style', source), 'utf8');
        // Extensões não carregam fontes remotas: fonts.css usa os WOFF2 locais.
        await writeFile(path.join(output, 'vendor', target), css.replace(/^@import[^\n]*\n/gm, ''));
    }
    for (const [family, weight] of [['newsreader', 600], ['source-serif-pro', 400], ['ibm-plex-mono', 500]]) {
        const fonts = path.join(root, 'node_modules/@fontsource', family);
        await cp(path.join(fonts, 'files', `${family}-latin-${weight}-normal.woff2`), path.join(output, 'vendor', `${family}.woff2`));
        await cp(path.join(fonts, 'LICENSE'), path.join(output, 'vendor', `${family}-LICENSE`));
    }
    // Recriar o pacote versionado para não conservar arquivos de versões anteriores.
    if (packageZip) {
        const zip = path.join(root, 'dist/extension', `verificaai-${browser}-${manifest.version}.zip`);
        await rm(zip, { force: true });
        execFileSync('zip', ['-q', '-r', zip, '.'], { cwd: output });
        console.log(`Pacote: ${zip}`);
    }
    await access(path.join(output, (manifest.action || manifest.browser_action).default_popup));
    console.log(`Extensão ${browser}: ${output}`);
}
