module.exports = MqttDiscovery;

const generateConfigPayload = device => {
  const deviceName = device.name;
  const stateTopic = `miraie-ac/${deviceName}/state`;

  const discoMsg = {
    icon: 'mdi:air-conditioner',
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
    // Newer firmware packs rmtmp, e.g. 150.27 = 27; a fraction other than .0/.5 is the real temperature.
    curr_temp_tpl:
      "{% set t = value_json.rmtmp | string %}{% set p = t.split('.') %}{{ p[1] | int if p | length == 2 and p[1] | int not in [0, 5, 50] else t | float }}",

    max_temp: '30',
    min_temp: '16',

    act_t: `miraie-ac/${deviceName}/action`,
    pow_cmd_t: `miraie-ac/${deviceName}/power/set`,

    fan_mode_cmd_t: `miraie-ac/${deviceName}/fan/set`,
    fan_mode_stat_t: stateTopic,
    fan_mode_stat_tpl: '{{ value_json.acfs }}',

    modes: ['auto', 'cool', 'dry', 'fan_only', 'off'],
    fan_modes: ['auto', 'quiet', 'low', 'medium', 'high'],

    swing_mode_cmd_t: `miraie-ac/${deviceName}/swing/set`,
    swing_mode_stat_t: stateTopic,
    swing_mode_stat_tpl: "{{ 'auto' if value_json.acvs | int == 0 else value_json.acvs }}",
    swing_modes: ['auto', '1', '2', '3', '4', '5'],

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

const generateMonthlyPowerConsumptionPayload = device => {
  const deviceName = device.name;
  const stateTopic = `miraie-ac/${deviceName}/monthly-power-consumption/state`;

  const discoMsg = {
    name: `Monthly Power Consumption - ${device.friendlyName}`,
    unique_id: `monthly-power-consumption-${deviceName}`,
    avty_t: `miraie-ac/${deviceName}/availability`,
    pl_avail: 'online',
    pl_not_avail: 'offline',
    unit_of_meas: 'kWh',
    dev_cla: 'energy',
    state_class: 'total',
    last_reset: device.consumption.monthlyResetDate,
    stat_t: stateTopic,
    icon: 'mdi:lightning-bolt',
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
    avty_t: `miraie-ac/${deviceName}/availability`,
    pl_avail: 'online',
    pl_not_avail: 'offline',
    unit_of_meas: 'kWh',
    dev_cla: 'energy',
    state_class: 'total',
    last_reset: device.consumption.dailyResetDate,
    stat_t: stateTopic,
    icon: 'mdi:lightning-bolt',
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

const generateDisplaySwitchPayload = device => {
  const deviceName = device.name;

  const discoMsg = {
    name: `Display - ${device.friendlyName}`,
    unique_id: `display-${deviceName}`,
    avty_t: `miraie-ac/${deviceName}/availability`,
    pl_avail: 'online',
    pl_not_avail: 'offline',
    cmd_t: `miraie-ac/${deviceName}/display/set`,
    stat_t: `miraie-ac/${deviceName}/state`,
    val_tpl: '{{ value_json.acdc }}',
    pl_on: 'on',
    pl_off: 'off',
    stat_on: 'on',
    stat_off: 'off',
    icon: 'mdi:led-on',
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

MqttDiscovery.prototype.generateDiscoMessage = function (device, prefix) {
  return [{
      topic: `${prefix}/climate/${device.name}/config`,
      payload: generateConfigPayload(device)
    }, {
      topic: `${prefix}/sensor/monthly-power-consumption/${device.name}/config`,
      payload: generateMonthlyPowerConsumptionPayload(device)
    }, {
      topic: `${prefix}/sensor/daily-power-consumption/${device.name}/config`,
      payload: generateDailyPowerConsumptionPayload(device)
    }, {
      topic: `${prefix}/switch/miraie-display/${device.name}/config`,
      payload: generateDisplaySwitchPayload(device)
    }
  ];
};
