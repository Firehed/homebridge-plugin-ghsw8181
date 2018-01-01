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
const fetch = require('node-fetch');

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
    this.lastCheck = null;
    this.lastValue = null;
    this.checkInterval = 5000; // milliseconds
    this.checking = false;

    this.log = this.log.bind(this);
  }

  /**
   * return a promise that reoslves to the current port
   */
  getCurrentPort() {
    const now = Date.now(); // milliseconds
    if (this.lastCheck && this.lastCheck > (now - this.checkInterval)) {
      this.log("Using cached port");
      return new Promise((resolve, reject) => {
        resolve(this.lastValue);
      });
    } else if (this.checking) { // esp8266 will get trampled at more than a couple req/sec
      this.log("Sleeping for result");
      const wait = (resolve, reject) => {
        if (!this.checking) {
          resolve(this.lastValue);
        } else {
          setTimeout(wait, 250, resolve, reject);
        }
      };
      return new Promise(wait);
    } else {
      return this.fetchCurrentPort();
    }
  }

  fetchCurrentPort() {
    this.log("Fetching current port");
    this.checking = true;
    return fetch(this.host + '/')
      .then(res => {
        if (!res.ok) {
          throw new Error(res.status + ' ' + res.statusText);
        }
        return res;
      })
      .then(res => res.text())
      .then(text => text.match(/Input: port([1-8])/)[1])
      .then(port => {
        port = parseInt(port, 10);
        this.lastCheck = Date.now();
        this.lastValue = port;
        this.checking = false;
        return port;
      })
      .catch(e => {
        this.checking = false;
        this.log(e);
      });
  }

  setPortTo(port) {
    //const target = this.host + '/select';
    const target = 'http://192.168.1.102/select';

    this.log('POST ' + target);
    const body = 'port='+port;
    this.log(body);
    return fetch(target, { method: 'POST', body: body })
      .then(res => {
        this.log(res.ok);
        this.log(res.status);
        this.log(res.statusText);
        this.log(res.headers.raw());
        this.log(res.headers.get('content-type'));

        this.lastCheck = Date.now();
        this.lastValue = port;
      });
  }
}

class Port {
  constructor(sw, log, num) {
    this.switch = sw;
    this.log = log;
    this.num = num;
    this.name = "HDMI " + num;

    this.log = this.log.bind(this);
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
    this.switch.getCurrentPort()
      .then(portText => {
        this.log(portText);
        return portText;
      })
      .then(portText => cb(null, portText === this.num));
  }

  setState(on, cb) {
    if (!on) {
      this.log('Ignoring request to turn port off');
      cb();
    }

    this.switch.setPortTo(this.num)
      .then(_ => cb());
  }
}
