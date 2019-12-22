var AWS = require('aws-sdk'); 
var awsTask=require("../../app/drivers/awsTask");
var file=require("../../app/drivers/file");
var log=require("../../app/drivers/log");
const STATE_COMPLETED="CREATE_COMPLETE";
const STACK_STATE_ACTIVE="ACTIVE";
const STACK_INSTANCE_STATUS_OK="CURRENT";
const ERROR_CODE_NOSTACK=400;
const ERROR_CODE_NOSTACKSET=404;
const IAM_ROLE_CFN_STACKSET='teemops-root';
var config, cfn, templatesURL, snsTopicName, awsAccountId;

function init (appConfig) {
    config=appConfig;
    templatesURL=config.get("cfn", "templates");
    var ep = new AWS.Endpoint(config.get("cfn", "endpoint"));
    cfn = new AWS.CloudFormation({endpoint: ep, region: config.get("default_region")});
    snsTopicName=config.get("SNS");
    awsAccountId=config.get("AWSAccountId");
    return {
        create: createStack,
        delete: deleteStack,
        getOutputs: getStackOutputs,
        creds: useSTSCredentials,
        createSet: createStackSet,
        checkStackSetExists:checkStackSetExists,
        createInstances:createStackSetInstances,
        deleteInstances:deleteStackSetInstances,
        setRegion:setRegion,
        task: cfnTask
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

function setRegion(region){
    AWS.config.update({
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
 * @param {*} notify Whether or not to send an SNS notification back once CFN CREATE is done
 */
async function createStack(label, templateName, parameters=null, wait=false, url=false, notify=true){
    try{

        var stackName="teemops-"+label;
        if(url){
            
            const template=templatesURL+templateName+".cfn.yaml";
            
            var params = {
                StackName: stackName,
                TemplateURL: template,
                Parameters: getParams(parameters),
                Capabilities: [
                    'CAPABILITY_IAM'
                ]
            };
        }else{
            const templateBody=await file.read("cloudformation/"+templateName+".cfn.yaml");
        
            var params = {
                StackName: stackName,
                TemplateBody: templateBody,
                Parameters: getParams(parameters),
                Capabilities: [
                    'CAPABILITY_IAM'
                ]
            };
        }
        var notifyARN='arn:aws:sns:'+cfn.config.region+':'+awsAccountId+':'+snsTopicName;
        if(notify){
            params.NotificationARNs=[notifyARN];
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
 * Deletes a CloudFormation stack and optionally waits for DELETE_COMPLETE state 
 * before returning a result.
 * 
 * @param {*} label 
 * @param {*} wait 
 */
async function deleteStack(label, wait=false){
    try{

        var stackName="teemops-"+label;
        
        var params = {
            StackName: stackName
        };
        const result=await cfnTask('deleteStack', params);
        
        if(wait){
            //await sleep(2000);
            const waitResult=await checkStackStatus(stackName);
            return waitResult;
        }else{
            return result;
        }
        
    }catch(e){
        throw e;
    }
}

async function createStackSet(label, templateName, parameters=null, url=false){
    try{
        var stackSetName="teemops-"+label;
        const iamRoleAll='arn:aws:iam::'+awsAccountId+':role/'+IAM_ROLE_CFN_STACKSET;

        if(url){
            
            const template=templatesURL+templateName+".cfn.yaml";
            
            var params = {
                StackSetName: stackSetName,
                TemplateURL: template,
                AdministrationRoleARN: iamRoleAll,
                ExecutionRoleName: IAM_ROLE_CFN_STACKSET,
                Parameters: getParams(parameters)
            };
        }else{
            const templateBody=await file.read("cloudformation/"+templateName+".cfn.yaml");
        
            var params = {
                StackSetName: stackSetName,
                TemplateBody: templateBody,
                AdministrationRoleARN: iamRoleAll,
                ExecutionRoleName: IAM_ROLE_CFN_STACKSET,
                Parameters: getParams(parameters)
            };
        }

        const result=await cfnTask('createStackSet', params);
        var done=false;

        while(!done){
            const check=await checkStackSetExists(stackSetName);
            if(check){
                done=true;
            }else{
                await waiting(5000);
            }

        }

        return true;
        
    }catch(e){
        throw e;
    }
}

async function createStackSetInstances(label, accounts, regions){
    
    try{
        var stackSetName="teemops-"+label;

        var params = {
            StackSetName: stackSetName,
            Accounts: accounts,
            Regions: regions,
            OperationPreferences: {
                RegionOrder: regions
            }
        };
        
        const result=await cfnTask('createStackInstances', params);
        if(result.OperationId!=undefined){
            const firstRegion=regions[0];
            const firstAccount=accounts[0];
            const checkFirstRegionHasRunOK=await checkStackInstanceInRegion(stackSetName, firstAccount, firstRegion);
            if(checkFirstRegionHasRunOK){
                return true;
            }else{
                return false;
            }
        }else{
            log.out(500, 'Teemops ERROR: createStackSetInstances failed.');
        }
        
        
    }catch(e){
        throw e;
    }
}

async function deleteStackSetInstances(label, accounts, regions){
    
    try{
        var stackSetName="teemops-"+label;

        var params = {
            StackSetName: stackSetName,
            Accounts: accounts,
            Regions: regions,
            RetainStacks: false
        };
        
        const result=await cfnTask('deleteStackInstances', params);
        if(result.OperationId!=undefined){
            return true;
        }else{
            log.out(500, 'Teemops ERROR: deleteStackSetInstances failed.', log.LOG_TYPES.ERROR);
        }
        
        
    }catch(e){
        log.out(500, 'Internal error '+e, log.LOG_TYPES.ERROR);
    }
}

function waiting(ms){
    return new Promise(resolve=>setTimeout(resolve, ms));
}

/**
 * Checks if a stack instance in a region has run and completed succesfully
 * 
 * @param {*} stackSetName 
 * @param {*} region 
 */
async function checkStackInstanceInRegion(stackSetName, account, region){
    var tries, check, result, done=false;

    while(!done){
        var params = {
            StackSetName: stackSetName,
            StackInstanceAccount: account,
            StackInstanceRegion: region
        };
        try{
            result=await cfnTask('describeStackInstance', params);
            if(result.StackInstance.Status!=undefined){
                check=(result.StackInstance.Status==STACK_INSTANCE_STATUS_OK);
            }
        }catch(e){
            log.out(400, e, log.LOG_TYPES.ERROR);
        }
        if(tries==5){
            log.out(504, 'Operation checkStackInstanceInRegion timed out after 5 attempts', log.LOG_TYPES.ERROR);
        }
        tries++;
        if(check){
            done=true;
        }else{
            await waiting(10000);
        }

    }
    return true;
}

async function checkStackSetExists(stackSetName){
    var params={
        StackSetName: stackSetName
    }
    try{
        const describeStackSet= await cfnTask('describeStackSet', params);
        if(describeStackSet.StackSet!=undefined){
            return (describeStackSet.StackSet.Status==STACK_STATE_ACTIVE);
        }else{
            return null;
        }
    }catch(e){
        if(e.statusCode==ERROR_CODE_NOSTACKSET){
            return null;
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
    var params={
        StackName: stackName
    }
    try{
        const wait=await waitFor('stackCreateComplete', params);
        if(wait.StackStatus==STATE_COMPLETED){
            if(wait.Stacks[0].Outputs[0].OutputKey=='BucketName'){
                return wait.Stacks[0].Outputs[0].OutputValue;
            }
        }
    }catch(e){
        if(e.code=="ResourceNotReady"){
            return true;
        }
        throw e;
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
        try{
            if(params[value]!=null){
                cfnParamsArray.push({
                    ParameterKey: value,
                    ParameterValue: params[value].toString()
                });
            }else{
                const error={
                    code: "NullParameter",
                    message: "Parameter "+ value + " does not exist."
                }
                throw error;
            }
            
        }catch(e){
            throw e;
        }
    });
    return cfnParamsArray;
}

function sleep(ms){
    return new Promise(resolve=>{
        setTimeout(resolve,ms)
    })
}

module.exports=init;