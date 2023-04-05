# ha-miraie-ac
Home Assistant integration with MirAIe air conditioners using NodeRed over MQTT

Since there is no official HA integration with Panasonic MirAIe air conditioners, this node will provide a bridge between the MirAIe MQTT broker and the local 
MQTT broker receieving updates from the device and updating the state on HA as well as accepting commands from HA to control the device.

## MirAIe Authentication
Authenticate over http using the registered mobile number and password

## Device Discovery
Once authenticated, the list of devices is pulled down exposed to HA using MQTT discovery.

## Usage
* Install the node
* Add the node to a flow and configure
* Search for "climate: entities on HA

![image](https://user-images.githubusercontent.com/20719501/146172849-926ed410-3a45-4368-8311-1192b07d49fa.png)

---
## TODO
1. Show debug messages to help with troubleshooting
2. The MQTT discovery prefix is hard coded to "homeassisstant", this should be configurable on the node.
3. Follow coding standards and best practices

NOTE: Home Assistant HVAC don't have powerful mode option, so using option heat instead of that, setting climate.hvac to heat will turn on powerful mode in the AC.

For UI use HACS library [simple thermostat](https://github.com/nervetattoo/simple-thermostat) and make a card using below yaml code

```yaml
type: custom:simple-thermostat
entity: climate.panasonic_ac
layout:
  mode:
    headings: false
    icons: true
    names: true
step_size: '1'
control:
  hvac:
    auto:
      name: false
    cool:
      name: false
    dry:
      name: false
    fan_only:
      name: false
    heat:
      name: false
      icon: mdi:snowflake-variant
    'off':
      name: false
  fan:
    auto:
      icon: mdi:fan-auto
      name: false
    low:
      icon: mdi:fan-speed-1
      name: false
    medium:
      icon: mdi:fan-speed-2
      name: false
    high:
      icon: mdi:fan-speed-3
      name: false
  swing:
    '0':
      icon: mdi:autorenew
      name: false
    '1':
      icon: mdi:arrow-left-thin
      name: false
    '2':
      icon: mdi:arrow-bottom-left-thin
      name: false
    '3':
      icon: mdi:arrow-down-thin
      name: false
    '4':
      icon: mdi:arrow-bottom-right-thin
      name: false
    '5':
      icon: mdi:arrow-right-thin
      name: false

```

<img width="428" alt="ac_ui" src="https://user-images.githubusercontent.com/93876251/151554889-ab9bd367-d1de-465f-9f20-c05e39be0f23.png">