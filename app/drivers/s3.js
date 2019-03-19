var AWS    = require('aws-sdk'); 
// Check if environment supports native promises
if (typeof Promise === 'undefined') {
    AWS.config.setPromisesDependency(require('bluebird'));
}  
var config, Buckets, s3, appPath;
var awsTask=require("../../app/drivers/awsTask");

module.exports=function(appConfig){ 
    config=appConfig;
    Buckets={meta: config.get("s3", "app_bucket"), main: "teemops"};
    s3 = new AWS.S3({region: config.get("s3meta", "region")});
    appPath=config.get("s3", "app_path");

    return { 
        getBuckets:  getBuckets,
        readitem: readitem,
        save: saveItem,
        task: s3Task
    }
}

/**
 * @author: Ben Fellows <ben@teemops.com>
 * @description: Returns all names of buckets as object
 * @returns: object of bucket names
 */
function getBuckets () {
    return Buckets;
}

/**
 * @author: Ben Fellows <ben@teemops.com>
 * @description: Reads an item in S3
 * @returns: url or err
 */
async function readitem(oName, bucketName, callback){
            
    try{
        var params = {
            Bucket: bucketName,
            Key: appPath+oName
        };
        console.log(bucketName);
        console.log(appPath+oName);
        s3.getObject(params, function(err, data) {
            if (err){
                callback(err, null);
            }
            else{
                callback(null, data);
            }         // successful response
        });
    }catch(e){
        callback(err, null);
    }finally{

    }

}

async function s3Task(task, params=null){
    try{
        return await awsTask(s3, task, params);
    }catch(e){
        throw e;
    }
}

async function saveItem(oName, bucketName, body){
    try{
        var params = {
            Body: body,
            Bucket: bucketName,
            Key: oName
        };
        const result=await s3Task('putObject', params);
        if(result!=null){
            return true;
        }else{
            return false;
        }
    }catch(e){
        throw e;
    }
}


