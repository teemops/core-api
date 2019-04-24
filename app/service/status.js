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
const EC2_STATUS=[
    'stopped',
    'stopping',
    'running',
    'pending'
]
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
                    await waiting(5000);
                });
                
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
    var event = getNotification(Message);
    
    try{
        if (event.notifcationType==NOTIFICATION_TYPES.cfn){
            var appId=getAppId(event);

            if (event.ResourceStatus.toString().indexOf('CREATE_COMPLETE')>=0 && event.ResourceType.toString().indexOf('Stack')>=0) {
                console.log("Updating App Status");
                //update App Status
                var result=await myApps.updateStatusFromNotify(appId, 'cfn.create');
                if(result.error!=undefined){
                    throw result.error;
                }
                return true;
            } else if (event.ResourceStatus.toString().indexOf('CREATE_COMPLETE')>=0 && event.LogicalResourceId.toString() === 'TopsEc2') {
                console.log("Updating Instance Details");
                var data=JSON.parse(event.ResourceProperties);
                
                var instanceId=event.PhysicalResourceId;
                var instance=await resource.describeInstance(appId, instanceId);
                data['Instances']=instance;
                return await myApps.updateMetaData(appId, JSON.stringify(data));
            } else if(event.ResourceStatus.toString().indexOf('PROGRESS')>=0){
                //do nothing if PROGRESS except return true so we can discard the message
                return true;
            } else if (event.ResourceStatus.toString().indexOf('DELETE_COMPLETE')>=0 && event.ResourceType.toString().indexOf('Stack')>=0) {
                console.log("DELETING App");
                //update App Status
                var result = await myApps.updateStatusFromNotify(appId, 'cfn.delete');
                if(result.error!=undefined){
                    throw result.error;
                }
                return true;
            } else{
                console.log("Discarding message - not relevant");
                return true;
            }
        }else{
            if(event.source==NOTIFICATION_TYPES.ec2){
                //get instance Id
                var instanceId=event.detail['instance-id'];
                var awsAccountId=event.account;
                var appId=await resource.getAppIdFromMeta(instanceId, awsAccountId);
                switch(event.detail['state']){
                    case 'stopped':
                        console.log("Updating App Status to Stopped");
                        //update App Status
                        var result=await myApps.updateStatusFromNotify(appId, 'cw.stopped');
                        if(result.error!=undefined){
                            throw result.error;
                        }
                        break;
                    case 'running':
                        console.log("Updating App Status to Running");
                        //update meta data for instance(s)
                        var metaData=await resource.getMetaData(appId);
                        if(metaData!=null){
                            var data=JSON.parse(metaData);
                            var instance=await resource.describeInstance(appId, instanceId);
                            data['Instances']=instance;
                            var updateResult = await myApps.updateMetaData(appId, JSON.stringify(data));
                            if(updateResult){
                                console.log("Meta data updated for App");
                            }
                        }

                        //update App Status
                        var result=await myApps.updateStatusFromNotify(appId, 'cw.running');
                        if(result.error!=undefined){
                            throw result.error;
                        }
                        break;
                    default:
                        return true;
                }
                return true;
            }
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
 * Returns Notification as an object, sample format below:
 * StackId='arn:aws:cloudformation:us-west-2:561280630638:stack/teemops-app-20/9945a430-4aa8-11e9-bc57-066b98e74c72'\\nTimestamp='2019-03-20T00:39:26.550Z'\\n...
 * or if an aws.ec2 event from CloudWatch:
 * {\"version\":\"0\",\"id\":\"f742f599-0ac8-f18b-6119-cbc72a0a74cd\",\"detail-type\":\"EC2 Instance State-change Notification\",\"source\":\"aws.ec2\",\"account\":\"561280630638\",...
 */
function getNotification(Message) {
    var newObject=getMessageLines(Message);

    //check if newObject is a line separated notification or JSON
    if(newObject!=undefined){
        if(newObject.ResourceStatus!=undefined){
            newObject['notifcationType']= NOTIFICATION_TYPES.cfn;
        }
    }else{
        newObject=JSON.parse(Message);
        if(newObject.source!=undefined){
            newObject['notifcationType']= newObject.source;
        }
    }

    return newObject;
}

function getMessageLines(Message){
    var newObject={
        topscode: 'teemops'
    };
    var messageLines = Message.split('\n');
    if(messageLines.length==1){
        newObject=null;
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

function getInstanceId(ec2Event){

}

function getCustomerId(cfnStack){
    var instanceData=JSON.parse(cfnStack.ResourceProperties);
    var tags=instanceData.Tags;
    var tag=tags.filter(tag=>tag.Key=='topscustomerid');
    return tag[0].Value;
}

