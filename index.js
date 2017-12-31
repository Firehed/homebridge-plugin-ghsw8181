/*
 * Expected config:
 *
 * {
 *   "platform": "GHSW8181",
 *   "host": "ghsw8181.local",
 *   "ports": 8 // or 4
 * }
 */
var Accessory, Characteristic, Service, UUIDGen;

const platformName = 'homebridge-plugin-ghsw8181';
const platformPrettyName = 'GHSW8181';

module.exports = (homebridge) => {
  Accessory = homebridge.platformAccessory;
  Characteristic = homebridge.hap.Characteristic;
  Service = homebridge.hap.Service;
  UUIDGen = homebridge.hap.uuid;

  homebridge.registerPlatform(platformName, platformPrettyName, Platform, true);
};

const Platform = class {
  constructor(log, config, api) {
    log('GHSW8181 plugin loaded');
    log(arguments);
    this.log = log;
    this.config = config;
    this.api = api;
    log(config);
  }

  accessories(callback) {
    this.log('accessories');
    this.log(this.config);
    const { ports, host } = this.config;
    if (ports != 8 && ports != 4) {
      throw new Error('Bad number of ports');
    }
    let _switches = [];
    for (let i = 1; i <= ports; i++) {
      this.log("Creating switch " + i);

      const acc = new Switch(this.log, sw); // (this.api.hap, this.log, sw);
      _switches.push(acc);
    }

    callback(_switches);
  }

};

// const SwitchAccessory = require('./SwitchAccessory');

const Switch = class {
  constructor(log, num) {
    this.log = log;
    this.num = num;
    this.name = "HDMI " + num;
  }

  identify(cb) {
    this.log('id requested');
    cb();
  }

  getServices() {
    var infoService = new Service.AccessoryInformation();
    infoService
      .setCharacteristic(Characteristic.Manufacturer, 'IOGear')
      .setCharacteristic(Characteristic.Model, 'GHSW8181')
      .setCharacteristic(Characteristic.SerialNumber, 'GHSW8181-' + this.num);

    switchService = new Service.switch(this.name);
    switchService
      .getCharacteristic(Characteristic.on)
      .on('get', this.getState)
      .on('set', this.setState);

    return [switchService];
  }

  getState(cb) {
    this.log('getstate' + this.num);
    cb(null, true); // todo: http GET state
  }

  setState(on, cb) {
    this.log('POST /select port=' + this.num + '(on=' + on + ')');
    cb();
  }
};
