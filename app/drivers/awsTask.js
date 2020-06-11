var AWSGen    = require('aws-sdk'); 

/**
 * Must be a valid AWS SDK class e.g EC2, RDS, ACM, CloudFormation
 * 
 * @param {*} libType 
 * @returns AWS Client Object
 */
function client(region, credentials, className){
    if(credentials!=null){
        AWSGen.config.update({
            accessKeyId:credentials.accessKeyId,
            secretAccessKey:credentials.secretAccessKey,
            sessionToken:credentials.sessionToken,
            region:region
        });
    }else{
        AWSGen.config.update({
            region: region
        });
    }
    
    var client=new AWSGen[className]();
    return client;
}

/**
 * Runs AWS Task as a Promise
 * 
 * @param {*} awsObject The object that is going to perform the task created from AWS.<>, e.g. AWS.S3()
 * @param {*} task 
 * @param {*} params 
 */
function Task(awsObject, task, params=null){
    return new Promise(function(resolve, reject){
        awsObject[task](params, function(err, data){
            if(err){
                reject(err);
            }else{
                resolve(data);
            }
        });
    });
}

module.exports=Task;
module.exports.client=client;