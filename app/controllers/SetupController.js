if (typeof Promise === 'undefined') {
    var async = require('asyncawait/async');
    var await = require('asyncawait/await');
    var Promise = require('bluebird');
} 
var config, cfn, jobsQName, jobsQRegion, awsAccountId;
const KEYSTORE_TEMPLATE='s3.keyStore';
const SNS_TEMPLATE='sns.topic';
const DEFAULT_CONFIG_PATH='app/config/config.json';
const CFN_STACK_EXCLUDED_REGIONS=['eu-north-1'];
var appQ = require("../../app/drivers/sqs.js");
var kms=require("../../app/drivers/kms");
var cfnDriver=require("../../app/drivers/cfn");
var ec2=require("../../app/drivers/ec2");
var file=require("../../app/drivers/file");
var jmespath = require('jmespath');

var messageQ=appQ();
var defaultQs=messageQ.getQs();
console.log(defaultQs.jobsq + "default jobsq");

/**
 * This is run on startup of app to ensure settings such 
 * as default message queues and database configuration is set
 */
async function init(appConfig){
    config=appConfig;
    cfn=cfnDriver(appConfig);
    jobsQName=config.get("sqs", "jobsq");
    jobsQRegion=config.get("sqs", "region");
    awsAccountId=config.get("AWSAccountId");

    console.log("appConfig: "+JSON.stringify(appConfig));
    //check Message Queues are setup
    var startQ= await createJobQ();
    if(startQ){
        console.log("New Teemops Main Q Created");
    }
    var createKey=await createKMSKey();
    if(createKey){
        console.log("Teemops Key was created or already present");
    }
    
    var keyStore=await createKeyStore();

    var createTopic=await createSNSTopic();

    return startQ && createKey && keyStore && createTopic;
}

/**
 * Creates default job SQS Queue
 */
function createJobQ(){
    return new Promise(function(resolve, reject) {
        messageQ.addQ(
            defaultQs.jobsq,
            function(err, data){
                if(err) {
                    reject(err);
                }else{
                    resolve(true);
                }                     
            }
        );
    })
}

/**
 * Creates default KMS Key based on config
 * 
 */
async function createKMSKey(){
    try{
        const result=await kms.addKey(); 
        return result;
    }catch(e){
        return e;
    }
}

/**
 * Creates SNS Topic and subscription to SQS that will update status
 * This is done across all 
 */
async function createSNSTopic(){
    //get regions first
    var regionsResult=[], regions, result;
    try{
        regionsResult=await ec2({
            task:'describeRegions',
            params: null,
            region: 'us-west-2'
        });
        
        /**
         * Filter out regions that aren't able to be used for stack sets currently
         * TODO: At moment eu-north-1 is not able to be supported so we need to just create individual stack for this in that region not tied to
         * any Stack Set.
         */
        regions=jmespath.search(regionsResult, "Regions[*].RegionName");
        CFN_STACK_EXCLUDED_REGIONS.forEach(
            function(value){
                regions=regions.filter(region=>region!=value);
            }
        );
        
        
    }catch(e){
        throw e;
    }
    // regions=['us-west-2', 'ap-southeast-2'];
    // try{
    //     var deleteStackResult=await cfn.deleteInstances('snstopic', [awsAccountId], regions);
    //     if(deleteStackResult){
    //         console.log("deleted stack set for SNS Topics");
    //     }
    // }catch(e){
        
    // }
    
    try{
        
        var checkTopicsExist=await cfn.checkStackSetExists('teemops-snstopic');
        if(checkTopicsExist){
            result=checkTopicsExist;
        }else{
            var params={
                SQSLabel: jobsQName,
                SQSRegion: jobsQRegion
            }
            result=await cfn.createSet('snstopic', SNS_TEMPLATE, params);
            
            stackResult=await cfn.createInstances('snstopic', [awsAccountId], regions);
            if(stackResult){
                //now create single Stack for excluded region(s)
                //this will wait for each region to complete
                CFN_STACK_EXCLUDED_REGIONS.forEach(async function(value){
                    console.log("Setup: adding SNS Topic to region: "+value);
                    await createSNSTopicSingle(value);
                });
            }
        }
        return true;
    }catch(e){
        throw e;
    }
}

async function createSNSTopicSingle(region){
    try{
        var regionCFN=cfn;
        regionCFN.setRegion(region);
        var outputResults=await regionCFN.getOutputs('teemops-snstopic');
        var result;
        if(outputResults!=null && outputResults[0].OutputKey=='TopicArn'){
            result=outputResults[0].OutputValue;
        }else{
            result=await regionCFN.create('snstopic', SNS_TEMPLATE, null, true, false, false);
        }

    }catch(e){
        throw e;
    }
}

/**
 * Creates key store in S3 for storing secrets for apps, ec2s etc..
 * Items are stored in S3, but are encrypted with a KMS key 
 * that is not accessible by S3 policy, only once an object is pulled from S3
 * can it be decrypted by having the correct KMS policy.
 */
async function createKeyStore(){
    try{
        var outputResults=await cfn.getOutputs('teemops-keystore');
        var result;
        if(outputResults!=null && outputResults[0].OutputKey=='BucketName'){
            result=outputResults[0].OutputValue;
        }else{
            result=await cfn.create('keystore', KEYSTORE_TEMPLATE, null, true, false, false);
        }
        
        var s3Config=await file.getConfig('s3', DEFAULT_CONFIG_PATH);
        s3Config.key_store=result;
        const updateConfig=file.updateConfig('s3', s3Config, DEFAULT_CONFIG_PATH);
        return true;
    }catch(e){
        return e;
    }
}

module.exports.init=init;
