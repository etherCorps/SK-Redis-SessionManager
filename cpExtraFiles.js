import fs from 'fs';

// read file into JSON
const pkgJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
const pkgReadme = fs.readFileSync('README.md', 'utf-8');
const pkfLicense = fs.readFileSync('LICENSE.txt', 'utf-8');

fs.writeFileSync('./dist/package.json', JSON.stringify(pkgJson, null, 2));

fs.writeFileSync('./dist/README.md', pkgReadme);

fs.writeFileSync('./dist/LICENSE', pkfLicense);
