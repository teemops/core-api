var AWS    = require('aws-sdk'); 
// Check if environment supports native promises
if (typeof Promise === 'undefined') {
    AWS.config.setPromisesDependency(require('bluebird'));
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