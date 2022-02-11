const axios = require('axios')
const HABroker = require('./ha-broker');
const MiraieBroker = require('./miraie-broker');
const Logger = require('./logger');
const logger = require('./logger');

const constants = {
    httpClientId: 'PBcMcfG19njNCL8AOgvRzIC8AjQa',
    loginUrl: 'https://auth.miraie.in/simplifi/v1/userManagement/login',
    homesUrl: 'https://app.miraie.in/simplifi/v1/homeManagement/homes',
    mirAIeBrokerHost: 'mqtt.miraie.in',
    mirAIeBrokerPort: 8883,
    userCleanSession: false,
};

const settings = {};
let miraieHome;
let haBroker;
let miraieBroker;

const getFormattedName = (name) => name.toLowerCase().replace(/\s/g, '-');

const getScope = () => `an_${Math.floor(Math.random() * 1000000000)}`;

const parseLoginResponse = (resp) => new Promise((resolve, reject) => {
    if (resp && resp.data && resp.data.userId && resp.data.accessToken) {
        Logger.logDebug("Login successful!");
        resolve({
            userId: resp.data.userId,
            accessToken: resp.data.accessToken
        });
    } else {
        reject('Unable to parse login response.');
    }
});

const parseHomeDetails = (data, accessToken) => {
    const homeId = data.homeId
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

    Logger.logDebug({ message: `Discovered ${devices.length} devices.`, devices: devices.map(d => d.friendlyName) });

    return {
        homeId,
        accessToken,
        devices
    };
};

const onMiraieStateChanged = (topic, payload) => {
    const device = miraieHome.devices.find(d => d.statusTopic === topic || d.connectionStatusTopic === topic);
    if (!device) return;

    if (device.statusTopic == topic) {
        Logger.logDebug({ message: 'Status updated.', device: device.friendlyName });
        haBroker.publishState(device, payload.toString());
    } else {
        Logger.logDebug({ message: 'Availability updated.', device: device.friendlyName });
        haBroker.publishConnectionStatus(device, payload.toString());
    }
};

const onHACommandReceieved = (topic, payload) => {
    const device = miraieHome.devices.find(d => topic.startsWith(`miraie-ac/${d.name}/`));
    if (device) {
        Logger.logDebug({ message: 'Command received.', device: device.friendlyName });
        miraieBroker.publish(device, payload.toString(), topic);
    }
};

const connectBrokers = (homeDetails) => {
    miraieHome = homeDetails;
    const deviceTopics = miraieHome.devices.map(d => [d.statusTopic, d.connectionStatusTopic]);
    const miraieTopics = [].concat(...deviceTopics)

    haBroker = new HABroker(miraieHome.devices, onHACommandReceieved);
    miraieBroker = new MiraieBroker(miraieTopics, onMiraieStateChanged);

    haBroker.connect(settings);
    miraieBroker.connect(constants, homeDetails.homeId, homeDetails.accessToken);

    return new Promise(resolve => resolve({}));
};

const login = (mobile, password) => {
    return axios
        .post(constants.loginUrl, {
            mobile,
            password,
            clientId: constants.httpClientId,
            scope: getScope()
        })
        .then(resp => parseLoginResponse(resp))
        .catch(e => {
            throw new Error('Error logging in. ' + e);
        });
};

const getHomeDetails = (accessToken) => {
    const config = {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    };

    return axios
        .get(constants.homesUrl, config)
        .then(resp => {
            if (resp.data && resp.data.length) {
                return parseHomeDetails(resp.data[0], accessToken);
            }

            throw new Error('No devices added');
        });
};

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
        Logger.logFatal({ message: "Configuration error.", errors })
        return false;
    }

    return true;
}

module.exports = function (RED) {
    function MirAIeNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        Logger.initialize(node, config.logLevel, logToSidebar);

        settings.mobile = this.credentials.mobile;
        settings.password = this.credentials.password;
        settings.haBrokerHost = config.haBrokerHost;
        settings.haBrokerPort = config.haBrokerPort;
        settings.haBrokerUsername = this.credentials.haBrokerUsername;
        settings.haBrokerPassword = this.credentials.haBrokerPassword;
        settings.useCleanSession = config.useCleanSession;
        settings.useSsl = config.useSsl;

        if (!isConfigValid(config, this.credentials)) {
            this.status({ fill: "red", shape: "ring", text: "Configuration error." });
            node.error("Node configuration error. Please see debug panel for more info.");
            return;
        }

        Logger.logInfo('Starting MirAIe node...');
        login(this.credentials.mobile, this.credentials.password)
            .then(userDetiails => getHomeDetails(userDetiails.accessToken))
            .then(homeDetails => connectBrokers(homeDetails))
            .catch(e => {
                this.status({ fill: "red", shape: "ring", text: "Error connecting." });
                node.error(e);
            });

        this.status({ fill: "green", shape: "dot", text: "Connected." });
    }

    RED.nodes.registerType("ha-miraie-ac", MirAIeNode, {
        credentials: {
            mobile: { type: "text" },
            password: { type: "password" },
            haBrokerUsername: { type: "text" },
            haBrokerPassword: { type: "password" },
        }
    });

    const logToSidebar = debugMsg => {
        var msg = RED.util.encodeObject(debugMsg, { maxLength: 1000 });
        RED.comms.publish("debug", msg);
    };
}