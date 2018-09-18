import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as path from 'path';
import { log, types } from 'vortex-api';

const app = appIn || remote.app;
const settingsPath = (game: string) => path.join(app.getPath('documents'), 'BioWare', game, 'Settings');

// Dragon age game information.
const DA_GAMES = {
  DragonAge1: {
    id: 'dragonage',
    modPath: path.join(app.getPath('documents'), 'BioWare', 'Dragon Age', 'AddIns'),
    settings: settingsPath('Dragon Age'),
},
  DragonAge2: {
    id: 'dragonage2',
    modPath: path.join(app.getPath('documents'), 'BioWare', 'Dragon Age 2', 'packages', 'core', 'override'),
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
  // the dazip itself is installed like a "regular" fomod, but it will have the dazip
  // modtype set from dazipOuter

  return true;
}

export default init;
