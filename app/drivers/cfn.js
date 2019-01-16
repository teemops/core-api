var AWS = require('aws-sdk'); 
var awsTask=require("../../app/drivers/awsTask");
var file=require("../../app/drivers/file");

const STATE_COMPLETED="CREATE_COMPLETE";
var config, cfn;

function init (appConfig) {
    config=appConfig;
    var ep = new AWS.Endpoint(config.get("cfn", "endpoint"));
    cfn = new AWS.CloudFormation({endpoint: ep, region: config.get("default_region")});

    return {
        create: createStack
    }
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
 */
async function createStack(label, template, parameters=null, wait=false){
    try{
        var stackName="teemops-"+label;
        
        const templateBody=await file.read("cloudformation/"+template+".cfn.yaml");
        
        var params = {
            StackName: stackName,
            TemplateBody: templateBody,
            Parameters: parameters
        };
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

async function getStackOutputs(stackName){
    var params = {
        StackName: stackName
    };
    try{
        const describeStacks= await cfnTask('describeStacks', params);
        if(describeStacks.Stacks.length!=0){
            return describeStacks.Stacks[0].Outputs[0].OutputValue;
        }
    }catch(e){
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

function sleep(ms){
    return new Promise(resolve=>{
        setTimeout(resolve,ms)
    })
}

module.exports=init;