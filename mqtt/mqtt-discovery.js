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
    swing_mode_cmd_tpl: "{{ 0 if value == 'auto' else value }}",
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

// On/off MirAIe keys exposed as HA switches; id is also the command topic segment.
const SWITCHES = [
  { id: 'display', name: 'Display', key: 'acdc', icon: 'mdi:led-on' },
  { id: 'powerful', name: 'Powerful', key: 'acpm', icon: 'mdi:rocket-launch' },
  { id: 'eco', name: 'Eco', key: 'acem', icon: 'mdi:leaf' },
  { id: 'clean', name: 'Clean', key: 'acec', icon: 'mdi:broom' },
  { id: 'buzzer', name: 'Buzzer', key: 'bzr', icon: 'mdi:volume-high' }
];

// Numeric MirAIe keys exposed as HA selects, where 0 is shown as zeroOption.
const SELECTS = [
  {
    id: 'h-swing',
    name: 'Horizontal Swing',
    key: 'achs',
    icon: 'mdi:arrow-left-right',
    zeroOption: 'auto',
    options: ['1', '2', '3', '4', '5']
  },
  {
    id: 'converti',
    name: 'Converti',
    key: 'cnv',
    icon: 'mdi:speedometer',
    zeroOption: 'Off',
    options: ['40', '50', '55', '60', '70', '80', '90', '100', '110']
  }
];

const generateSwitchPayload = (device, sw) => {
  const deviceName = device.name;

  const discoMsg = {
    name: `${sw.name} - ${device.friendlyName}`,
    unique_id: `${sw.id}-${deviceName}`,
    avty_t: `miraie-ac/${deviceName}/availability`,
    pl_avail: 'online',
    pl_not_avail: 'offline',
    cmd_t: `miraie-ac/${deviceName}/${sw.id}/set`,
    stat_t: `miraie-ac/${deviceName}/state`,
    val_tpl: `{{ value_json.${sw.key} }}`,
    pl_on: 'on',
    pl_off: 'off',
    stat_on: 'on',
    stat_off: 'off',
    icon: sw.icon,
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

const generateSelectPayload = (device, select) => {
  const deviceName = device.name;

  const discoMsg = {
    name: `${select.name} - ${device.friendlyName}`,
    unique_id: `${select.id}-${deviceName}`,
    avty_t: `miraie-ac/${deviceName}/availability`,
    pl_avail: 'online',
    pl_not_avail: 'offline',
    cmd_t: `miraie-ac/${deviceName}/${select.id}/set`,
    cmd_tpl: `{{ 0 if value == '${select.zeroOption}' else value }}`,
    stat_t: `miraie-ac/${deviceName}/state`,
    val_tpl: `{{ '${select.zeroOption}' if value_json.${select.key} | int == 0 else value_json.${select.key} }}`,
    ops: [select.zeroOption, ...select.options],
    icon: select.icon,
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

const generateWifiSignalPayload = device => {
  const deviceName = device.name;

  const discoMsg = {
    name: `WiFi Signal - ${device.friendlyName}`,
    unique_id: `wifi-signal-${deviceName}`,
    avty_t: `miraie-ac/${deviceName}/availability`,
    pl_avail: 'online',
    pl_not_avail: 'offline',
    stat_t: `miraie-ac/${deviceName}/state`,
    val_tpl: '{{ value_json.rssi }}',
    unit_of_meas: 'dBm',
    dev_cla: 'signal_strength',
    stat_cla: 'measurement',
    ent_cat: 'diagnostic',
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
      topic: `${prefix}/sensor/miraie-wifi-signal/${device.name}/config`,
      payload: generateWifiSignalPayload(device)
    },
    ...SWITCHES.map(sw => ({
      topic: `${prefix}/switch/miraie-${sw.id}/${device.name}/config`,
      payload: generateSwitchPayload(device, sw)
    })),
    ...SELECTS.map(select => ({
      topic: `${prefix}/select/miraie-${select.id}/${device.name}/config`,
      payload: generateSelectPayload(device, select)
    }))
  ];
};
