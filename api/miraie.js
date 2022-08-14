const { default: axios } = require('axios');
const Logger = require('../utilities/logger');
const LoginErrorMsg = 'There was an error logging in.';
const HomeDetailsErrorMsg = 'There was an error getting home details.';
const DeviceStatusErrorMsg = 'There was an error getting device status.';
const PopulateDeviceDetailsErrorMsg = 'There was an error getting device details.';

let _home;
let _authDetails;
let _accessToken;

const constants = {
  httpClientId: 'PBcMcfG19njNCL8AOgvRzIC8AjQa',
  loginUrl: 'https://auth.miraie.in/simplifi/v1/userManagement/login',
  homesUrl: 'https://app.miraie.in/simplifi/v1/homeManagement/homes',
  statusUrl: 'https://app.miraie.in/simplifi/v1/deviceManagement/devices/{deviceId}/mobile/status',
  deviceDetailsUrl: 'https://app.miraie.in/simplifi/v1/deviceManagement/devices/deviceId'
};

const getScope = () => `an_${Math.floor(Math.random() * 1000000000)}`;

const login = async function () {
  Logger.logDebug('Logging in to MirAIe.');

  var data = {
    password: _authDetails.password,
    clientId: constants.httpClientId,
    scope: getScope()
  };

  data[_authDetails.authType || 'mobile'] = _authDetails.userId;
  const resp = await axios.post(constants.loginUrl, data);
  const user = parseLoginResponse(resp);
  _accessToken = user.accessToken;

  return _accessToken;
};

const parseLoginResponse = resp => {
  if (resp && resp.data && resp.data.userId && resp.data.accessToken) {
    return {
      userId: resp.data.userId,
      accessToken: resp.data.accessToken
    };
  }

  return null;
};

const buildHttpConfig = () => ({
  headers: {
    Authorization: `Bearer ${_accessToken}`
  }
});

const getHomeDetails = async function () {
  Logger.logDebug('Getting MirAIe Home details.');

  const config = buildHttpConfig();
  const response = await axios.get(constants.homesUrl, config);
  return parseHomeDetails(response);
};

const getFormattedName = name => name.toLowerCase().replace(/\s/g, '-');

const parseHomeDetails = response => {
  if (!response.data || response.data.length == 0) {
    return null;
  }

  const data = response.data[0];
  const homeId = data.homeId;
  const devices = [];

  data.spaces.map(s => {
    const devicesInSpace = s.devices.map(d => {
      const deviceName = getFormattedName(d.deviceName);
      const device = {
        id: d.deviceId,
        name: deviceName,
        friendlyName: d.deviceName,
        controlTopic: d.topic ? `${d.topic[0]}/control` : null,
        statusTopic: d.topic ? `${d.topic[0]}/status` : null,
        connectionStatusTopic: d.topic ? `${d.topic[0]}/connectionStatus` : null,
        haStatusTopic: `miraie-ac/${deviceName}/state`,
        haAvailabilityTopic: `miraie-ac/${deviceName}/availability`,
        haActionTopic: `miraie-ac/${deviceName}/action`,
        haCommandTopic: `miraie-ac/${deviceName}/+/set`
      };

      return device;
    });

    devices.push(...devicesInSpace);
  });

  _home = { homeId, accessToken: _accessToken, devices };
  return _home;
};

const getDeviceDetails = (deviceIds) => {
  const config = buildHttpConfig();
  return axios.get(`${constants.deviceDetailsUrl}/${deviceIds}`, config).then(resp => resp.data);
}

const populateDeviceDetails = async function () {
  const deviceIds = _home.devices.map(d => d.id).join(',');
  const deviceDetails = await getDeviceDetails(deviceIds) ;

  _home.devices.map(d => {
    const details = deviceDetails.find(x => x.deviceId === d.id) || {};
    
    d.details = {
      modelName: details.modelName || '',
      macAddress: details.macAddress  || '',
      category: details.category  || '',
      brand: details.brand  || '',
      firmwareVersion: details.firmwareVersion || '',
      serialNumber: details.serialNumber || '',
      modelNumber: details.modelNumber || '',
      productSerialNumber: details.productSerialNumber || ''
    };
  });

  return _home;
}

const getDeviceStatus = (url, config) => axios.get(url, config).then(resp => resp.data);

const getAllDeviceStatus = async function () {
  Logger.logDebug('Getting MirAIe device status.');

  const config = buildHttpConfig(_accessToken);
  const statusList = [];
  for (let i = 0; i < _home.devices.length; i++) {
    const d = _home.devices[i];
    const url = constants.statusUrl.replace('{deviceId}', d.id);
    const status = await getDeviceStatus(url, config);
    statusList.push({ ...d, status });
  }

  return statusList;
};

const rethrow = (e, message) => {
  throw { ...e, message: `${message} ${e.message}` };
};

module.exports = Miraie;
function Miraie() {}

Miraie.prototype.initialize = (authType, userId, password) => {
  _authDetails = { authType, userId, password };
};

Miraie.prototype.getHomeDetails = () => {
  return login()
    .then(getHomeDetails, e => rethrow(e, LoginErrorMsg))
    .then(populateDeviceDetails, e => rethrow(e, HomeDetailsErrorMsg))
    .then(
      home => home,
      e => rethrow(e, PopulateDeviceDetailsErrorMsg)
    );
};

Miraie.prototype.getDeviceStatus = () => {
  return getAllDeviceStatus().then(
    devices => devices,
    e => rethrow(e, DeviceStatusErrorMsg)
  );
};
