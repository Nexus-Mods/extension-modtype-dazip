import Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as path from 'path';
import { log, types } from 'vortex-api';

const app = appIn || remote.app;

const DA_CONTENTS_FOLDER = 'contents\\';
const DA_MODULE_ERF_SUFFIX = '_module.erf';

// Dragon age game information.
const DA_GAMES = {
  DragonAge1: {
    id: 'dragonage',
    modPath: path.join(app.getPath('documents'), 'BioWare', 'Dragon Age'),
  },
  DragonAge2: {
    id: 'dragonage2',
    modPath: path.join(app.getPath('documents'), 'BioWare',
                       'Dragon Age 2'/*, 'packages', 'core', 'override'*/),
  },
};

function testDazip(instructions: types.IInstruction[]) {
  // we can't (currently) know the files that are inside a dazip, the outer installer
  // has to tell us
  return Promise.resolve(false);
}

function testSupportedOuter(files: string[]) {
  const dazips = files.filter(file => !file.endsWith(path.sep) && path.extname(file) === '.dazip');
  return Promise.resolve({
    supported: dazips.length > 0,
    requiredFiles: dazips,
  });
}

function testSupportedInner(files: string[], gameId: string) {
  const supported = isDragonAge(gameId)
    && (files.find(file => file.toLowerCase().indexOf(DA_CONTENTS_FOLDER) !== -1) !== undefined)
    && (files.find(file =>
          path.basename(file.toLowerCase()).indexOf(DA_MODULE_ERF_SUFFIX) !== -1) !== undefined);
  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

function installOuter(files: string[],
                      destinationPath: string,
                      gameId: string,
                      progressDelegate): Promise<types.IInstallResult> {
  const dazips = files.filter(file => !file.endsWith(path.sep) && path.extname(file) === '.dazip');
  log('debug', 'install nested', dazips);
  const instructions = dazips.map((dazip: string): types.IInstruction => ({
                              type: 'submodule',
                              key: dazip,
                              path: path.join(destinationPath, dazip),
                              submoduleType: 'dazip',
                            }));
  return Promise.resolve({ instructions });
}

// Dragon Age 2 does not have an official creation kit and any dazip
//  archives targeted at DA2 are created using DA:O's creation kit.
//  Reason why it's safe to assume that both games have the same
//  folder structure.
function installInner(files: string[],
                      destinationPath: string,
                      gameId: string,
                      progressDelegate): Promise<types.IInstallResult> {
  const result: types.IInstallResult = {
    instructions: [],
  };

  let modName = files.find(file => path.basename(file).indexOf(DA_MODULE_ERF_SUFFIX) !== -1);
  modName = path.basename(modName).replace(DA_MODULE_ERF_SUFFIX, '');

  // Go through each file and remove the contents folder.
  files.forEach(file => {
    let newPath = file.toLowerCase();
    if (newPath.indexOf(DA_CONTENTS_FOLDER) !== -1) {
      newPath = newPath.replace(DA_CONTENTS_FOLDER, '');
    }

    // Move the manifest file from the archive's root to avoid
    //  mod conflicts.
    if (newPath === 'manifest.xml') {
      newPath = newPath.replace(newPath, path.join('AddIns', modName, newPath));
    }

    // Ignore any folders as the install manager will
    //  ensure these are created when transferring files.
    if (path.extname(path.basename(newPath)) !== '') {
      result.instructions.push({
        type: 'copy',
        source: file,
        destination: newPath,
      });
    }
  });

  return Promise.resolve(result);
}

function isDragonAge(gameId: string): boolean {
  return [ DA_GAMES.DragonAge1.id, DA_GAMES.DragonAge2.id ].indexOf(gameId) !== -1;
}

function init(context: types.IExtensionContext) {
  const getPath = (game: types.IGame) => {
    if (game.id === DA_GAMES.DragonAge1.id) {
      return DA_GAMES.DragonAge1.modPath;
    } else if (game.id === DA_GAMES.DragonAge2.id) {
      return DA_GAMES.DragonAge2.modPath;
    }
  };

  context.registerModType('dazip', 25, isDragonAge, getPath, testDazip);
  context.registerInstaller('dazipOuter', 15, testSupportedOuter, installOuter);
  context.registerInstaller('dazipInner', 15, testSupportedInner, installInner);

  return true;
}

export default init;
