var AWS = require('aws-sdk'); 
var awsTask=require("../../app/drivers/awsTask");
var file=require("../../app/drivers/file");

const STATE_COMPLETED="CREATE_COMPLETE";
const ERROR_CODE_NOSTACK=400;
var config, cfn, templatesURL, snsTopicArn;

function init (appConfig) {
    config=appConfig;
    templatesURL=config.get("cfn", "templates");
    var ep = new AWS.Endpoint(config.get("cfn", "endpoint"));
    cfn = new AWS.CloudFormation({endpoint: ep, region: config.get("default_region")});
    snsTopicArn=config.get("SNS");
    return {
        create: createStack,
        getOutputs: getStackOutputs,
        creds: useSTSCredentials
    }
}

/**
 * Uses the AWS STS assume credentials from an STS Assume call
 * 
 * @param {*} credentials 
 */
function useSTSCredentials(region, credentials){
    AWS.config.update({
        accessKeyId:credentials.accessKeyId,
        secretAccessKey:credentials.secretAccessKey,
        sessionToken:credentials.sessionToken,
        region:region
    });
    var ep = new AWS.Endpoint('https://cloudformation.'+region+'.amazonaws.com');
    cfn = new AWS.CloudFormation({endpoint: ep, region: region});
}

async function cfnTask(task, params=null){
    try{
        return await awsTask(cfn, task, params);
    }catch(e){
        throw e;
    }
}

async function waitFor(waitCommand, params){
    return new Promise(function(resolve, reject){
        cfn.waitFor(
            waitCommand, 
            params, 
            function(err, data){
                if(err){
                    reject(err);
                }else{
                    resolve(data);
                }
        });
    });
}

/**
 * Launches create CloudFormation stack and optionally waits for CREATE_COMPLETE state 
 * before returning a result.
 * 
 * @param {*} label 
 * @param {*} template 
 * @param {*} parameters 
 * @param {*} wait 
 * @param {*} url Is the template a URL or local file?
 */
async function createStack(label, templateName, parameters=null, wait=false, url=false, notify=true){
    try{
        var stackName="teemops-"+label;
        
        if(url){
            
            const template=templatesURL+templateName+".cfn.yaml";
            
            var params = {
                StackName: stackName,
                TemplateURL: template,
                Parameters: getParams(parameters)
            };
        }else{
            const templateBody=await file.read("cloudformation/"+templateName+".cfn.yaml");
        
            var params = {
                StackName: stackName,
                TemplateBody: templateBody,
                Parameters: getParams(parameters)
            };
        }
        if(notify){
            params.NotificationARNs=[snsTopicArn];
        }
        const result=await cfnTask('createStack', params);
        
        if(wait){
            //await sleep(2000);
            const waitResult=await checkStackStatus(stackName);
            return waitResult;
        }else{
            return result;
        }
        
    }catch(e){
        if(e.code==="AlreadyExistsException"){
            const waitResult=await checkStackStatus(stackName);
            return waitResult;
        }
        throw e;
    }
}

/**
 * Gets list of outputs for a given stack name
 * 
 * @param {*} stackName Unique name of stack
 * @returns {Output}
 * Example:
 * {
 *  [
 *      OutputKey: 'BucketName',
 *      OutputValue: 'some-bucket-name-l7sxgadxh6r'
 *  ],...
 * }
 */
async function getStackOutputs(stackName){
    var params = {
        StackName: stackName
    };
    try{
        const describeStacks= await cfnTask('describeStacks', params);
        if(describeStacks.Stacks.length!=0){
            return describeStacks.Stacks[0].Outputs;
        }else{
            return null;
        }
    }catch(e){
        if(e.statusCode==ERROR_CODE_NOSTACK){
            return null;
        }
        throw e;
    }
    
}

async function checkStackStatus(stackName){
    params={
        StackName: stackName
    }
    const wait=await waitFor('stackCreateComplete', params);
    if(wait.StackStatus==STATE_COMPLETED){
        if(wait.Stacks[0].Outputs[0].OutputKey=='BucketName'){
            return wait.Stacks[0].Outputs[0].OutputValue;
        }
    }
}
/**
 * Converts an object to an Array of CloudFormation compatible
 * ParameterKey/ParameterValue pairs.
 * @param {*} params just an object
 */
function getParams(params){
    var cfnParamsArray=[];
    if(params==null){
        return cfnParamsArray;
    }
    Object.keys(params).forEach(function(value, index, array){
        cfnParamsArray.push({
            ParameterKey: value,
            ParameterValue: params[value].toString()
        });
    });
    return cfnParamsArray;
}

function sleep(ms){
    return new Promise(resolve=>{
        setTimeout(resolve,ms)
    })
}

module.exports=init;