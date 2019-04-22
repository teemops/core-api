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

    var appQ = require("../../app/drivers/sqs.js");
var userController = require("../controllers/UserController.js"); 
var appController = require("../controllers/AppController.js"); 

var jobQ=appQ();
var myUsers=userController();
var myApps=appController();

var defaultQs=jobQ.getQs();
console.log('Running status service... Ctrl-C to stop. Use supervisor to run as a service on OS.');
console.log(defaultQs.jobsq + " is the default JOBS Q");

var code=0;

const myService=async function service(){
    while(code==0){
        //get QURL
        try{
            const qURL=await jobQ.readQURL(defaultQs.jobsq);
            console.log(qURL);
            const message=await jobQ.readitem(qURL);
            console.log(JSON.stringify(message));

            message.Messages.forEach(async function (value, key) {
                var msg = JSON.parse(value.Body.toString());

                if (msg.Type != "Notification") {
                    err = "This function only supports notification events.";
                    throw err;
                }

                var cfnStackEvent = getCFNStack(msg.Message);
                var appId=getAppId(cfnStackEvent);
                //update App Status
                const statusResult=await myApps.updateStatusFromCFN(appId, 'cfn.create');

                console.log('Processed MessageId '+ message.Messages[key].MessageId);
            });
            
        }catch(e){
            console.log("Error: "+e);
            throw e;
        }
    }
    
}
myService();

if(code===1){
    console.log('exiting');
    process.exit();
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

