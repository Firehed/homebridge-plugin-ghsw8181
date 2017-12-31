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

class Platform {
  constructor(log, config, api) {
    log('GHSW8181 plugin loaded');
    this.log = log;
    this.config = config;
    this.api = api;
    log(config);

    this.api.on('error', (e) => {
      this.log.error(e);
    });
    this.api.on('warning', (w) => {
      this.log.warn(w);
    });
  }

  accessories(callback) {
    this.log.debug('accessories');
    this.log.debug(this.config);
    const { ports, host } = this.config;
    if (ports != 8 && ports != 4) {
      throw new Error('Bad number of ports');
    }

    const sw = new HDMISwitch(this.log, host);

    let _ports = [];
    for (let i = 1; i <= ports; i++) {
      this.log("Creating switch " + i);

      const acc = new Port(sw, this.log, i); // (this.api.hap, this.log, sw);
      _ports.push(acc);
    }

    callback(_ports);
  }
}

class HDMISwitch {
  constructor(log, host) {
    this.log = log;
    this.host = host;
  }

  getCurrentPort = async () => {
    this.log("Fetching current port");
    const result = await fetch(this.host);
    const data = await result.blob();
    const re = /Input: port([1-8])/;
    return re.match(data);
  }
}

class Port {
  constructor(sw, log, num) {
    this.switch = sw;
    this.log = log;
    this.num = num;
    this.name = "HDMI " + num;
  }

  identify(cb) {
    this.log.debug('id requested');
    cb();
  }

  getServices() {
    const infoService = new Service.AccessoryInformation();
    infoService
      .setCharacteristic(Characteristic.Manufacturer, 'IOGear')
      .setCharacteristic(Characteristic.Model, 'GHSW8181')
      .setCharacteristic(Characteristic.SerialNumber, 'GHSW8181-' + this.num);

    const switchService = new Service.Switch(this.name);
    switchService
      .getCharacteristic(Characteristic.On)
      .on('get', this.getState.bind(this))
      .on('set', this.setState.bind(this));

    return [infoService, switchService];
  }

  getState(cb) {
    this.log('getstate' + this.num);
    const cp = this.switch.getCurrentPort();
    console.log(cp);
    cb(null, true); // todo: http GET state
  }

  setState(on, cb) {
    this.log('POST /select port=' + this.num + '(on=' + on + ')');
    cb();
  }
}
