import {readFile,writeFile} from 'node:fs/promises';
import {auditCatalog} from '../lib/catalog-audit.js';
const data=JSON.parse(await readFile('clubs.json','utf8'));
const report=auditCatalog(data.clubs);
console.log(JSON.stringify(report,null,2));
if(process.argv.includes('--write'))await writeFile('data/catalog-audit.json',JSON.stringify(report,null,2)+'\n');
if(report.genericDiscoverLinks.length)process.exitCode=1;
