# homebridge-plugin-ghsw8181

Homekit connectivity for a network-connected GHSW8181/GHSW8141 HDMI switch.

Designed to work in combination with [ESP8266-GHSW8181](https://github.com/Firehed/ESP8266-GHSW8181), which takes the RS-232 control port and exposes it to the network with an ESP-8266.

## How it works

The above Arduino code creates a tiny HTTP server to read and set the currently-selected HDMI port.
See its documentation for further information, including how to wire things up.
This uses that API to create a bunch of Switch accessories in Homekit; one for each port on the device (per the configuration; see below).
It will treat the currently-selected HDMI port as "on" and the others as "off"; turning a different switch on should cause the previously-selected port to turn off.

This isn't exactly ideal since you end up with four or eight devices in the Home app (instead of just one), but as of the iOS 11 SDKs, there isn't a single device type to represent a multi-state switch like this.
Hopefully iOS 12 adds better support for A/V gear.

## Installation

Assuming you already have Homebridge running somewhere, just install this plugin like you would with any other: `npm i -g homebridge-platform-ghsw8181`.

If you don't have Homebridge set up with at least one other device, it's probably best to not start with this one.
While this plugin should work with very little work or configuration, the hardware side has a decent chance of being quite fiddly and you won't want to deal with that _in addition to_ getting Homebridge up and running.

## Configuration

In your existing Homebridge configration, add an accessory with the following structure:

```json
"platforms": [
    {
        "platform": "GHSW8181",
        "host": "http://ghsw8181.local",
        "ports": 8
    }
]
```

Make sure that the `host` field includes the `http` protocol.
Depending on your network setup, you may need to use a different host name, or the IP address directly.

`ports` can be 4 or 8, depending on which model switch you are connecting to.

On the Homekit side, making a fake "room" to hold all of these switches should help reduce clutter a bit without impacting functionality.
You may need to use goofy Siri commands to toggle the switch directly ("turn on HDMI 3 in Bridges"), but it's probably best to manage them with Scenes.

## Contributing

Send a pull request or open an issue.

## License

MIT
