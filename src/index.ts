import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as path from 'path';
import { log, types } from 'vortex-api';

const app = appIn || remote.app;
const settingsPath = (game: string) => path.join(app.getPath('documents'), 'BioWare', game, 'Settings');

const DA_CONTENTS_FOLDER = 'contents\\';

// Dragon age game information.
const DA_GAMES = {
  DragonAge1: {
    id: 'dragonage',
    modPath: path.join(app.getPath('documents'), 'BioWare', 'Dragon Age'),
    settings: settingsPath('Dragon Age'),
},
  DragonAge2: {
    id: 'dragonage2',
    modPath: path.join(app.getPath('documents'), 'BioWare', 'Dragon Age 2'/*, 'packages', 'core', 'override'*/),
    settings: settingsPath('Dragon Age II'),
  },
}

function testDazip(instructions: types.IInstruction[]) {
  // we can't (currently) now the files are inside a dazip, the outer installer
  // has to tell us
  return Promise.resolve(false);
}

function testSupportedOuter(files: string[]) {
  const dazips = files.filter(file => path.extname(file) === '.dazip');
  return Promise.resolve({
    supported: dazips.length > 0,
    requiredFiles: dazips,
  });
}

function testSupportedInner(files: string[], gameId: string) {
  const supported = isDragonAge(gameId) 
    && (files.find(file => file.toLowerCase().indexOf(DA_CONTENTS_FOLDER) === 0) !== undefined)
  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

function installOuter(files: string[],
                      destinationPath: string,
                      gameId: string,
                      progressDelegate): Promise<types.IInstallResult> {
  const dazips = files.filter(file => path.extname(file) === '.dazip');
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
      instructions: []
    };
    
    // Go through each file and remove the contents folder.
    files.forEach(file => {
      let newPath = file.toLowerCase();
      if (newPath.indexOf(DA_CONTENTS_FOLDER) !== -1) {
        newPath = newPath.replace(DA_CONTENTS_FOLDER, '');
      }

      // Ignore any folders as the install manager will
      //  ensure these are created when transferring files.
      if (path.extname(path.basename(newPath)) !== '') {
        result.instructions.push({
          type: 'copy',
          source: file,
          destination: newPath,
        })
      }
    })

  return Promise.resolve(result);
}

function isDragonAge(gameId: string): boolean {
  return [ DA_GAMES.DragonAge1.id, DA_GAMES.DragonAge2.id ].indexOf(gameId) !== -1;
}

function testIsSettings(): Promise<boolean> {
  // only used for merged files
  return Promise.resolve(false);
}

function init(context: types.IExtensionContext) {
  const getPath = (game: types.IGame) => {
    if (game.id === DA_GAMES.DragonAge1.id) {
      return DA_GAMES.DragonAge1.modPath;
    } else if (game.id == DA_GAMES.DragonAge2.id) {
      return DA_GAMES.DragonAge2.modPath;
    }
  };

  const getSettingsPath = (game: types.IGame) => {
    if (game.id === DA_GAMES.DragonAge1.id) {
      return DA_GAMES.DragonAge1.settings;
    } else if (game.id === DA_GAMES.DragonAge2.id) {
      return DA_GAMES.DragonAge2.settings;
    }
  };

  context.registerModType('dazip', 25, isDragonAge, getPath, testDazip);
  context.registerModType('dragonage-settings', 999, isDragonAge, getSettingsPath, testIsSettings);
  context.registerInstaller('dazipOuter', 15, testSupportedOuter, installOuter);
  context.registerInstaller('dazipInner', 15, testSupportedInner, installInner);

  return true;
}

export default init;
