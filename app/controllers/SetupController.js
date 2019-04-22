if (typeof Promise === 'undefined') {
    var async = require('asyncawait/async');
    var await = require('asyncawait/await');
    var Promise = require('bluebird');
} 
var config, cfn, jobsQName;
const KEYSTORE_TEMPLATE='s3.keyStore';
const SNS_TEMPLATE='sns.topic';
const DEFAULT_CONFIG_PATH='app/config/config.json';
var appQ = require("../../app/drivers/sqs.js");
var kms=require("../../app/drivers/kms");
var cfnDriver=require("../../app/drivers/cfn");
var file=require("../../app/drivers/file");

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
 * Creates SNS Topic and subscription to Lambda Serverless
 * function that will update status
 * 
 */
async function createSNSTopic(){
    try{
        var outputResults=await cfn.getOutputs('teemops-snstopic');
        var result;
        if(outputResults!=null && outputResults[0].OutputKey=='TopicArn'){
            result=outputResults[0].OutputValue;
        }else{
            var params={
                SQSLabel: jobsQName
            }
            result=await cfn.create('snstopic', SNS_TEMPLATE, params, true, false, false);
            outputResults=await cfn.getOutputs('teemops-snstopic');
            if(outputResults!=null && outputResults[0].OutputKey=='TopicArn'){
                result=outputResults[0].OutputValue;
            }
        }
        
        const updateConfig=file.updateConfig('SNS', result, DEFAULT_CONFIG_PATH);

        return true;
    }catch(e){
        return e;
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
