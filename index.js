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

  homebridge.registerPlatform(platformName, platformPrettyName, HDMISwitch, true);
};

/*
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
*/

class HDMISwitch {
  constructor(log, config, api) {
    log('GHSW8181 plugin loaded');
    this.log = log;
    this.api = api;

    const { host, ports } = config;
    if (ports !== 4 && ports !== 8) {
      throw new Error('ports must be 4 or 8');
    }
    this.host = host;
    this.portCount = ports;

    this.lastCheck = null;
    this.lastValue = null;
    this.checkInterval = 5000; // milliseconds
    this.checking = false;
    this.ports = [];

    this.log = this.log.bind(this);
  }

  // HomeBridge accessory registrartion
  accessories(callback) {
    this.ports = [];
    for (let i = 1; i <= this.portCount; i++) {
      const port = new Port(this, this.log, i);
      this.ports.push(port);
    }
    callback(this.ports);
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
      .then(portStr => {
        selectedPort = parseInt(portStr, 10);
        this.lastCheck = Date.now();
        this.lastValue = selectedPort;
        this.checking = false;
        for (const port of this.ports) {
          port.switchService.getCharacteristic(Characteristic.On).updateValue(port.num === selectedPort);

        }
        return selectedPort;
      })
      .catch(e => {
        this.checking = false;
        this.log(e);
      });
  }

  setPortTo(port) {
    // There's a weird interaction (pair of bugs) where this fetch wrapper
    // lowercases all of the HTTP header keys, and the ESP8266WebServer library
    // won't parse the POST body unless the Content-Length header is formatted
    // exactly as such. Fortunately, throwing the value in the query string
    // allows it to go through just fine.
    const target = this.host + '/select?port=' + port;

    this.log('POST ' + target);
    const params = {
      method: 'POST',
    };
    return fetch(target, params)
      .then(res => {
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

    [this.infoService, this.switchService] = this.createServices();
  }

  identify(cb) {
    this.log.debug('id requested');
    cb();
  }

  getServices() {
    return this._services;
  }

  createServices() {
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
