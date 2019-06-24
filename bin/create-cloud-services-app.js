#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const shell = require('shelljs');
const prompt = require('prompt');
const chalk = require('chalk');
const tar = require('tar');

const cwd = path.resolve('./');
const templateRepoName = 'vht-cloud-services-ui-template';
const defaultProjectName = path.basename(cwd);
const promptSchema = {
  properties: {
    name: {
      description: 'Project Name:',
      default: defaultProjectName,
      required: true,
    },
    description: {
      description: 'Description:',
      required: true,
    },
  },
};

function isDirEmpty(path) {
  return fs.readdirSync(path).length === 0;
}

function preCreateChecks() {
  if (!isDirEmpty(cwd)) {
    console.warn('This directory is not empty.');
    console.warn('You should run this command from a new empty directory where the project will be created.');
    process.exit(1);
  }
}

function create(config) {
  console.log('[1/4] Copying template files...');
  copyTemplate()
    .then(() => {
      modifyTemplateFiles(config);
      console.log('[2/4] Updating package.json...');
      modifyPackageJson(config);
      console.log('[3/4] Installing dependencies...');
      installDeps();
      installPeerDeps();
      console.log('[4/4] Upgrading dependencies...');
      upgradeDeps();
      success();
    })
    .catch(err => {
      console.error('Failed: ', err);
      process.exit(1);
    });
}

function copyTemplate() {
  return new Promise((resolve, reject) => {
    if (shell.exec(`git clone git@github.com:VHT/${templateRepoName}.git`).code !== 0) {
      reject('Error: git clone failed');
    }
    if (shell.exec(`cd ${templateRepoName} && git archive --format tar --output ./tmp.tar HEAD`).code !== 0) {
      reject('Error: git archive failed');
    }
    tar
      .x({
        file: `${templateRepoName}/tmp.tar`,
      })
      .then(() => {
        shell.rm('-rf', `./${templateRepoName}`);
        resolve();
      })
      .catch(err => {
        reject(`Error: archive extraction failed. ${err}`);
      });
  });
}

function gatherFiles(rootPath, allFiles, allDirs) {
  const allPaths = fs.readdirSync(rootPath).map(file => path.join(rootPath, file));
  for (const childPath of allPaths) {
    const stat = fs.lstatSync(childPath);
    if (stat.isFile()) {
      allFiles.push(childPath);
    }
    if (stat.isDirectory()) {
      gatherFiles(childPath, allFiles, allDirs);
      allDirs.push(childPath);
    }
  }
}

function modifyTemplateFiles(config) {
  const cwd = path.resolve('.');
  const folders = ['.']; // only these directories will be checked for files to modify.
  const files = [];
  const dirs = [];

  folders.forEach(folder => gatherFiles(path.join(cwd, folder), files, dirs));
  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');

    const newContent = content
      .replace(/{{application-name}}/gm, config.name)
      .trim();
    fs.writeFileSync(file, `${newContent}\n`);
  });

  // rename directories
  dirs.forEach(dir => {
    const dirName = path.basename(dir);
    if (dirName.indexOf('{{application-name}}') > -1) {
      const newName = path.resolve(path.dirname(dir), dirName.replace('{{application-name}}', config.name));
      fs.renameSync(dir, newName);
    }
  });
}

function modifyPackageJson(config) {
  const packageJsonPath = path.join(cwd, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  packageJson.description = config.description});
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

function installDeps() {
  if (shell.exec('yarn').code !== 0) {
    shell.echo('Error: Yarn install failed');
    shell.exit(1);
  }
}

function installPeerDeps() {
  if (shell.exec('yarn run react-scripts peerDeps').code !== 0) {
    shell.echo('Error: Adding peer dependencies failed');
    shell.exit(1);
  }
  installDeps();
}

function upgradeDeps() {
  if (shell.exec('yarn run upgradevht').code !== 0) {
    shell.echo('Error: Yarn upgrade failed');
    shell.exit(1);
  }
}

function success() {
  console.log('');
  console.log(chalk.green('⭐️ Application creation complete. ⭐️'));
  console.log(`You should now ${chalk.blue('git init')} this project.`);
  console.log(`Run ${chalk.blue('yarn react-scripts')} for a list of commands.`);
  process.exit(0);
}

prompt.message = '';
prompt.delimiter = '';

console.log('');
console.log(chalk.blue('Create a new VHT Cloud Services UI project.'));
preCreateChecks();
console.log(chalk.blue('Enter project details:'));
prompt.get(promptSchema, (err, responses) => {
  if (err) {
    console.error('Error: ', err);
    process.exit(1);
  }
  create(responses);
});
