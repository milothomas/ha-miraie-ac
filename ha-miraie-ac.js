const Logger = require('./utilities/logger');
const Miraie = require('./api/miraie');
const BrokerBridge = require('./broker/broker-bridge');

const settings = {};
const _brokerBridge = new BrokerBridge();
const _miraieApi = new Miraie();

let _logToSidebar = () => {};

const isConfigValid = () => {
  const errors = [];
  if (!settings.mobile) {
    errors.push('Mobile number is empty.');
  }

  if (!settings.password) {
    errors.push('Password is empty.');
  }

  if (!settings.haBrokerHost) {
    errors.push('HA Broker Host is empty.');
  }

  if (!settings.haBrokerPort) {
    errors.push('HA Broker Port is empty.');
  }

  if (errors.length) {
    console.log(errors);
    Logger.logFatal({ message: 'Configuration error.', errors });
    return false;
  }

  return true;
};

const initializeNode = (node, config) => {
  settings.authType = config.authType;
  settings.mobile = node.credentials.mobile;
  settings.password = node.credentials.password;
  settings.haBrokerHost = config.haBrokerHost;
  settings.haBrokerPort = config.haBrokerPort;
  settings.haBrokerUsername = node.credentials.haBrokerUsername;
  settings.haBrokerPassword = node.credentials.haBrokerPassword;
  settings.useCleanSession = config.useCleanSession;
  settings.useSsl = config.useSsl;

  Logger.initialize(node, config.logLevel, _logToSidebar);
};

const handleError = (node, error) => {
  node.error(error);
  node.status({
    fill: 'red',
    shape: 'ring',
    text: 'Error getting data from MirAIe servers.'
  });
};

const setNodeStatus = (node, message) => {
  node.status({ fill: 'green', shape: 'dot', text: message });
};

const setNodeError = (node, e, message) => {
  node.status({ fill: 'red', shape: 'ring', text: message });
  if (e) {
    node.error(e);
  }
};

const processHome = (node, home) => {
  const devices = home.devices;
  var deviceNames = devices
    .reduce((prev, curr) => `${prev}, ${curr.friendlyName}`, '')
    .slice(1)
    .trim();

  Logger.logInfo(`Found ${devices.length} devices: ${deviceNames}`);

  _brokerBridge.initialize(home, settings);
  setNodeStatus(node, 'Connected');
};

const refreshStatus = node => {
  _miraieApi
    .getDeviceStatus()
    .then(_brokerBridge.publishDeviceStatus)
    .catch(e => setNodeError(node, e, 'Error connecting to MirAIe servers.'));
};

module.exports = function (RED) {
  function MirAIeNode(config) {
    const node = this;
    _logToSidebar = logToSidebar;

    RED.nodes.createNode(node, config);
    initializeNode(node, config);

    if (!isConfigValid()) {
      setNodeError(node, null, 'Configuration error');
      return;
    }

    Logger.logInfo('Starting MirAIe node...');

    node.on('close', function () {
      disconnectBrokers();
    });

    node.on('input', function () {
      refreshStatus(node);
    });

    _miraieApi.initialize(config.authType, node.credentials.mobile, node.credentials.password);
    _miraieApi
      .getHomeDetails()
      .then(home => processHome(node, home))
      .catch(e => handleError(node, e));
  }

  RED.nodes.registerType('ha-miraie-ac', MirAIeNode, {
    credentials: {
      mobile: { type: 'text' },
      password: { type: 'password' },
      haBrokerUsername: { type: 'text' },
      haBrokerPassword: { type: 'password' }
    }
  });

  const logToSidebar = debugMsg => {
    var msg = RED.util.encodeObject(debugMsg, { maxLength: 1000 });
    RED.comms.publish('debug', msg);
    console.log(debugMsg);
  };
};
