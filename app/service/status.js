#!/usr/bin/env node

/**
 * updates the status of Apps from the SQS Queue
 * Source and data flow:
 * -Teemops launches, updates or deletes a CloudFormation (EC2)
 * -CloudFormation triggers SNS
 * -SNS triggers SQS
 * -This service picks up SQS item
 */

//how long between checking SQS??
const WAIT_TIME = 500;
const NOTIFICATION_TYPES = {
    discard: "none",
    cfn: "CloudFormation",
    ec2: "aws.ec2",
    rds: "aws.rds"
}
const STATUS_TYPES = {
    starting: 'STARTING',
    started: 'STARTED',
    running: 'RUNNING',
    stopped: 'STOPPED',
    stopping: 'STOPPING',
    restarting: 'RESTARTING',
    deleting: 'DELETING',
    deleted: 'DELETED'
}
const CFN_STATUS = {
    CREATE_IN_PROGRESS: STATUS_TYPES.starting,
    CREATE_COMPLETE: STATUS_TYPES.started
}
const EC2_STATUS = [
    'stopped',
    'stopping',
    'running',
    'pending'
]
const CUSTOM_RESOURCE_IDENTIFIER = "AWS CloudFormation custom resource request";
var util = require('util'),
    spawn = require('child_process').spawn;

var config = require('config-json');
var axios = require('axios').default;
var log = require('../drivers/log.js');
config.load('./app/config/config.json');
var appQ = require("../../app/drivers/sqs.js");
var userController = require("../controllers/UserController.js");
var appController = require("../controllers/AppController.js");
var resourceController = require("../controllers/ResourceController.js");
var userCloudProviderController = require("../controllers/UserCloudProviderController.js");
var credentialController = require("../controllers/CredentialController.js");
const { param } = require('express-validator/check');

var jobQ = appQ();
var myUsers = userController();
var myApps = appController();
var resource = resourceController();
var userClouds = userCloudProviderController();
var credentials = credentialController();
resource.init(config);

var defaultQs = jobQ.getQs();
console.log('Running status service... Ctrl-C to stop. Use supervisor to run as a service on OS.');
console.log(defaultQs.jobsq + " is the default JOBS Q");

var code = 0;
var qURL;

const start = async function () {
    try {
        qURL = await jobQ.readQURL(defaultQs.jobsq);
    } catch (e) {
        throw e;
    }

    myService();
}
start();

const myService = async function service() {

    try {
        const message = await jobQ.readitem(qURL, 10);
        if (message.Messages != undefined) {
            log.out(0, "Processing messages from Queue...", log.LOG_TYPES.INFO);
            var value = message.Messages[0];
            var key = 0;
            message.Messages.forEach(async function (value, key) {
                var msgBody = JSON.parse(value.Body.toString());

                if (msgBody.Type != "Notification") {
                    err = "This function only supports notification events.";
                    throw err;
                }
                var statusResult;

                if (msgBody.Subject == CUSTOM_RESOURCE_IDENTIFIER) {
                    statusResult = await sendCustomCFNResponse(msgBody.Message);
                } else {
                    statusResult = await updateStatus(msgBody.Message);
                }

                if (statusResult) {
                    const removeResult = await removeMessage(qURL, value);
                    if (removeResult) {
                        console.log('PROCESSED MessageId ' + message.Messages[key].MessageId);
                    }
                } else {
                    const removeResult = await removeMessage(qURL, value);
                    if (removeResult) {
                        console.log('ERROR: PURGED MessageId ' + message.Messages[key].MessageId);
                    }
                }
            });

        } else {
            log.out(404, "No messages to process yet...", log.LOG_TYPES.INFO);
        }

    } catch (e) {
        console.log("Error: " + e);
        throw e;
    }
    myService();
    await waiting(WAIT_TIME);

}


function waiting(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

if (code === 1) {
    console.log('exiting');
    process.exit();
}

/**
 * Returns true, updates the status of the app based on cloudformation stack event (completed or delete)
 * 
 * @param {*} Message 
 */
async function updateStatus(Message) {
    var event = getNotification(Message);
    if (event == null) {
        return true;
    }
    try {
        log.out('INFO', 'CFN SQS Message', log.LOG_TYPES.DEBUG)
        log.out('INFO', JSON.stringify(event, null, 4), log.LOG_TYPES.DEBUG)

        if (event.notifcationType == NOTIFICATION_TYPES.cfn) {
            var appId = getAppId(event);

            if (event.ResourceStatus.toString().indexOf('CREATE_COMPLETE') >= 0 && event.ResourceType.toString().indexOf('Stack') >= 0) {
                console.log("Updating App Status");
                //update App Status
                var result = await myApps.updateStatusFromNotify(appId, 'cfn.create', 'completed', true);
                if (result.error != undefined) {
                    throw result.error;
                }
                return true;
            } else if (event.ResourceStatus.toString().indexOf('CREATE_COMPLETE') >= 0 && event.LogicalResourceId.toString() === 'TopsEc2') {
                console.log("Updating Instance Details");
                var data = JSON.parse(event.ResourceProperties);

                var instanceId = event.PhysicalResourceId;
                var instance = await resource.describeInstance(appId, instanceId);
                data['Instances'] = instance;
                return await myApps.updateMetaData(appId, JSON.stringify(data));
            } else if (event.ResourceStatus.toString().indexOf('PROGRESS') >= 0) {
                //do nothing if PROGRESS except return true so we can discard the message
                return true;
            } else if (event.ResourceStatus.toString().indexOf('DELETE_COMPLETE') >= 0 && event.ResourceType.toString().indexOf('Stack') >= 0) {
                console.log("DELETED App");
                //update App Status
                var result = await myApps.updateStatusFromNotify(appId, 'cfn.delete');
                if (result.error != undefined) {
                    throw result.error;
                }
                return true;
            } else if (event.ResourceStatus.toString().indexOf('CREATE_FAILED') >= 0 && event.LogicalResourceId.toString() === 'TopsEc2') {
                console.log("Instance launch failure due to AWS CloudFormation Error");
                var data = JSON.parse(event.ResourceProperties);
                //update App Status
                var result = await myApps.updateStatusFromNotify(appId, 'cfn.fail', event.ResourceStatusReason);
                if (result.error != undefined) {
                    throw result.error;
                }
                return true;
            } else {
                console.log("Discarding message - not relevant");
                return true;
            }
        } else {
            if (event.source == NOTIFICATION_TYPES.ec2) {
                //get instance Id
                var instanceId = event.detail['instance-id'];
                var awsAccountId = event.account;
                var appId = await resource.getAppIdFromMeta(instanceId, awsAccountId);
                if (appId == null) {
                    var error = {
                        code: 404,
                        message: 'AppId is not able to be located, because it is either already deleted or not connected to an Instance in AWS.'
                    };
                    throw error;
                }
                switch (event.detail['state']) {
                    case 'stopped':
                        console.log("Updating App Status to Stopped");
                        //update App Status
                        var result = await myApps.updateStatusFromNotify(appId, 'cw.stopped');
                        if (result.error != undefined) {
                            throw result.error;
                        }
                        break;
                    case 'running':
                        console.log("Updating App Status to Running");
                        //update meta data for instance(s)
                        var metaData = await resource.getMetaData(appId);
                        if (metaData != null) {
                            var data = JSON.parse(metaData);
                            var instance = await resource.describeInstance(appId, instanceId);
                            data['Instances'] = instance;
                            var updateResult = await myApps.updateMetaData(appId, JSON.stringify(data));
                            if (updateResult) {
                                console.log("Meta data updated for App");
                            }
                        }

                        //update App Status
                        var result = await myApps.updateStatusFromNotify(appId, 'cw.running');
                        if (result.error != undefined) {
                            throw result.error;
                        }
                        break;
                    default:
                        return true;
                }
                return true;
            }
        }

    } catch (e) {
        if (e.code == 404) {
            //we assume this App/Instance has already been processed and/or since deleted.
            log.out(e.code, e.message, log.LOG_TYPES.WARNING)
            return true;
        }
        throw e;
    }
}


/**
 * Remove SQS Message by given ID
 * @param {*} MessageId 
 */
async function removeMessage(qURL, Message) {
    try {
        const message = await jobQ.removeitem(qURL, Message);

        return true;
    } catch (e) {
        throw e;
    }

}

/**
 * Returns Notification as an object, sample format below:
 * StackId='arn:aws:cloudformation:us-west-2:561280630638:stack/teemops-app-20/9945a430-4aa8-11e9-bc57-066b98e74c72'\\nTimestamp='2019-03-20T00:39:26.550Z'\\n...
 * or if an aws.ec2 event from CloudWatch:
 * {\"version\":\"0\",\"id\":\"f742f599-0ac8-f18b-6119-cbc72a0a74cd\",\"detail-type\":\"EC2 Instance State-change Notification\",\"source\":\"aws.ec2\",\"account\":\"561280630638\",...
 */
function getNotification(Message) {


    var newObject = getMessageLines(Message);

    //check if newObject is a line separated notification or JSON
    if (newObject != undefined) {
        if (newObject.ResourceStatus != undefined) {
            newObject['notifcationType'] = NOTIFICATION_TYPES.cfn;
        }
    } else {
        try {
            newObject = JSON.parse(Message);
        } catch (e) {
            return null;
        }
        if (newObject.source != undefined) {
            newObject['notifcationType'] = newObject.source;
        }
    }

    return newObject;


}

function getMessageLines(Message) {
    var newObject = {
        topscode: 'teemops'
    };
    var messageLines = Message.split('\n');
    if (messageLines.length == 1) {
        newObject = null;
    }
    var key, value;
    messageLines.forEach(element => {
        key = element.split('=')[0];
        value = element.split('=')[1];
        if (value != undefined) {
            if (value.indexOf('\'') > -1) {
                value = value.replace(/\'/g, '');
            }
            newObject[key] = value;
        }

    });
    return newObject;
}

/**
 * Gets Teemops AppId from CFN Stack Details
 * format passed in example: teemops-app-123
 * return example: 123
 * @param {*} cfnStack 
 */
function getAppId(cfnStack) {
    return parseInt(cfnStack.StackName.split('-')[2]);
}

function getInstanceId(ec2Event) {

}

function getCustomerId(cfnStack) {
    var instanceData = JSON.parse(cfnStack.ResourceProperties);
    var tags = instanceData.Tags;
    var tag = tags.filter(tag => tag.Key == 'topscustomerid');
    return tag[0].Value;
}

/**
 * Adds this new Credential to existing customer
 * To do this we need to extract the TopsExternalId from the 
 * ResourceProperties of the Message.
 * 
 */
async function sendCustomCFNResponse(message) {


    try {
        const event = JSON.parse(message);
        const resourceProperties = event.ResourceProperties;
        const externalId = resourceProperties.TopsExternalId;
        const roleArn = resourceProperties.TopsRoleArn;
        var awsAccountId = roleArn.split("arn:aws:iam::")[1].split(":")[0];
        const preSignedUrl = event.ResponseURL;

        const userId = await myUsers.getUserByExternalId(externalId);
        const cloudAccount = await userClouds.addCloudProviderAccount({
            userId: userId,
            cloudProviderId: 1,
            awsAccountId: awsAccountId,
            name: awsAccountId,
            isDefault: true
        })
        const authData = {
            name: awsAccountId,
            arn: roleArn,
            createdById: userId,
            createdByUsername: "autogenerated",
            createdDate: new Date()
        }
        const addCredential = await credentials.addUserDataProvider({
            userCloudProviderId: cloudAccount.id,
            awsAuthMethod: "IAM",
            authData: JSON.stringify(authData)
        })
        const params = {
            Status: "SUCCESS",
            PhysicalResourceId: externalId,
            StackId: event.StackId,
            RequestId: event.RequestId,
            LogicalResourceId: event.LogicalResourceId,
            Data: {
                process: 'teemopsStatus'
            }
        }
        const request = await axios.put(preSignedUrl, params);
        if (request.status == 200) {
            return true;
        } else {
            throw {
                code: request.status,
                message: `Error with axios request to Presigned URL ${preSignedUrl} Event details: ${JSON.stringify(event)}`
            }
        }
    } catch (e) {
        throw e;
    }

}