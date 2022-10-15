module.exports = MqttDiscovery;

const generateConfigPayload = device => {
  const deviceName = device.name;
  const stateTopic = `miraie-ac/${deviceName}/state`;

  const discoMsg = {
    name: device.friendlyName,
    unique_id: deviceName,
    mode_cmd_t: `miraie-ac/${deviceName}/mode/set`,
    mode_stat_t: stateTopic,
    mode_stat_tpl:
      "{% set mode = value_json.acmd %}{% set power = value_json.ps %}{%- if power == 'off' -%} off {%- else -%} {{ 'fan_only' if mode == 'fan' else mode }} {%- endif -%}",
    avty_t: `miraie-ac/${deviceName}/availability`,
    pl_avail: 'online',
    pl_not_avail: 'offline',

    temp_cmd_t: `miraie-ac/${deviceName}/temp/set`,
    temp_stat_t: stateTopic,
    temp_stat_tpl: '{{ value_json.actmp }}',

    curr_temp_t: stateTopic,
    curr_temp_tpl: '{{ value_json.rmtmp }}',

    max_temp: '30',
    min_temp: '16',

    act_t: `miraie-ac/${deviceName}/action`,
    pow_cmd_t: `miraie-ac/${deviceName}/power/set`,

    fan_mode_cmd_t: `miraie-ac/${deviceName}/fan/set`,
    fan_mode_stat_t: stateTopic,
    fan_mode_stat_tpl: '{{ value_json.acfs }}',

    modes: ['auto', 'cool', 'dry', 'fan_only', 'off'],
    fan_modes: ['auto', 'quiet', 'low', 'medium', 'high'],
    dev: {
      ids: [device.id, device.details.macAddress],
      mf: device.details.brand,
      name: device.friendlyName,
      mdl: device.details.modelNumber,
      sw: device.details.firmwareVersion
    }
  };

  return discoMsg;
};

const generateDailyPowerConsumptionPayload = device => {
  const deviceName = device.name;
  const stateTopic = `miraie-ac/${deviceName}/daily-power-consumption/state`;

  const discoMsg = {
    name: `Daily Power Consumption - ${device.friendlyName}`,
    unique_id: `daily-power-consumption-${deviceName}`,
    mode_stat_t: stateTopic,
    mode_stat_tpl:
      "{% set mode = value_json.acmd %}{% set power = value_json.ps %}{%- if power == 'off' -%} off {%- else -%} {{ 'fan_only' if mode == 'fan' else mode }} {%- endif -%}",
    avty_t: `miraie-ac/${deviceName}/availability`,
    pl_avail: 'online',
    pl_not_avail: 'offline',

    dev: {
      ids: [device.id, device.details.macAddress],
      mf: device.details.brand,
      name: device.friendlyName,
      mdl: device.details.modelNumber,
      sw: device.details.firmwareVersion
    }
  };

  return discoMsg;
};

function MqttDiscovery() {}

MqttDiscovery.prototype.generateDiscoMessage = function (device) {
  return [{
      topic: `homeassistant/climate/${device.name}/config`,
      payload: generateConfigPayload(device)
    }, {
      topic: `homeassistant/sensor/${device.name}/power-consumption/config`,
      payload: generateConfigPayload(device)
    }
  ];
};
