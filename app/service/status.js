#!/usr/bin/env node
/**
 * updates the status of Apps from the SQS Queue
 * Source and data flow:
 * -Teemops launches, updates or deletes a CloudFormation (EC2)
 * -CloudFormation triggers SNS
 * -SNS triggers SQS
 * -This service picks up SQS item
 */
if (typeof Promise === 'undefined') {
    var async = require('asyncawait/async');
    var await = require('asyncawait/await');
    var Promise = require('bluebird');
} 
//how long between checking SQS??
const WAIT_TIME = 20000;
const NOTIFICATION_TYPES = {
    cfn: "CloudFormation"
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
var util  = require('util'),
    spawn = require('child_process').spawn;

var config = require('config-json');
config.load('./app/config/config.json');
var appQ = require("../../app/drivers/sqs.js");
var userController = require("../controllers/UserController.js"); 
var appController = require("../controllers/AppController.js"); 
var resourceController = require("../controllers/ResourceController.js"); 

var jobQ=appQ();
var myUsers=userController();
var myApps=appController();
var resource=resourceController();
resource.init(config);

var defaultQs=jobQ.getQs();
console.log('Running status service... Ctrl-C to stop. Use supervisor to run as a service on OS.');
console.log(defaultQs.jobsq + " is the default JOBS Q");

var code=0;

const myService=async function service(){
    const qURL=await jobQ.readQURL(defaultQs.jobsq);
    console.log(qURL);
    while(code==0){
        //get QURL
        try{
            const message=await jobQ.readitem(qURL);
            console.log(JSON.stringify(message));
            if(message.Messages!=undefined){
                message.Messages.forEach(async function (value, key) {
                    var msgBody = JSON.parse(value.Body.toString());
    
                    if (msgBody.Type != "Notification") {
                        err = "This function only supports notification events.";
                        throw err;
                    }
    
                    const statusResult=await updateStatus(msgBody.Message);
                    if(statusResult){
                        const removeResult=await removeMessage(qURL, value);
                        if(removeResult){
                            console.log('Processed MessageId '+ message.Messages[key].MessageId);
                        }
                    }
                });
                await waiting(5000);
            }else{
                //await
                await waiting(WAIT_TIME);
            }
            
        }catch(e){
            console.log("Error: "+e);
            throw e;
        }
    }
    
}
myService();

function waiting(ms){
    return new Promise(resolve=>setTimeout(resolve, ms));
}

if(code===1){
    console.log('exiting');
    process.exit();
}

/**
 * Returns true, updates the status of the app based on cloudformation stack event (completed or delete)
 * 
 * @param {*} Message 
 */
async function updateStatus(Message){
    var event = getCFNStack(Message);
    var appId=getAppId(event);
    try{
        if (event.ResourceStatus.toString().indexOf('COMPLETE')>=0 && event.ResourceType.toString().indexOf('Stack')>=0) {
            console.log("Updating App Status");
            //update App Status
            await myApps.updateStatusFromCFN(appId, 'cfn.create');
        } else if (event.ResourceStatus.toString().indexOf('COMPLETE')>=0 && event.LogicalResourceId.toString() === 'TopsEc2') {
            console.log("Updating Instance Details");
            var data=JSON.parse(event.ResourceProperties);
            
            instanceId=event.PhysicalResourceId;
            var instance=await resource.describeInstance(appId, instanceId);
            data['Instance']=instance;
            return await myApps.updateMetaData(appId, JSON.stringify(data));
        }
    }catch(e){
        throw e;
    }
}

/**
 * Remove SQS Message by given ID
 * @param {*} MessageId 
 */
async function removeMessage(qURL, Message){
    try{
        const message=await jobQ.removeitem(qURL, Message);

        return true;
    }catch(e){
        throw e;
    }
    
}

/**
 * Returns Stack as an object, sample format below:
 * StackId='arn:aws:cloudformation:us-west-2:561280630638:stack/teemops-app-20/9945a430-4aa8-11e9-bc57-066b98e74c72'\\nTimestamp='2019-03-20T00:39:26.550Z'\\n...
 */
function getCFNStack(Message) {
    var newObject = {
        notifcationType: NOTIFICATION_TYPES.cfn
    };
    var messageLines = Message.split('\n');
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

function getCustomerId(cfnStack){
    var instanceData=JSON.parse(cfnStack.ResourceProperties);
    var tags=instanceData.Tags;
    var tag=tags.filter(tag=>tag.Key=='topscustomerid');
    return tag[0].Value;
}

