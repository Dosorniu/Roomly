import ts from 'typescript';
import { spawnSync } from 'node:child_process';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
for(const file of ['services/domain','data/catalog','tests/domain.test']){
 const dir='work/test-run/'+file.slice(0,file.lastIndexOf('/'));mkdirSync(dir,{recursive:true});
 const source=readFileSync(file+'.ts','utf8');const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/(from\s+['"])(\.\.?\/[^'"]+)(['"])/g,'$1$2.mjs$3');writeFileSync('work/test-run/'+file+'.mjs',js);
}
const result=spawnSync(process.execPath,['work/test-run/tests/domain.test.mjs'],{stdio:'inherit'});process.exit(result.status??1);
