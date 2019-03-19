if (typeof Promise === 'undefined') {
    var async = require('asyncawait/async');
    var await = require('asyncawait/await');
    var Promise = require('bluebird');
} 
var  AWSEC2= require('aws-sdk');

//jmes path query expressions
// use jms.search(inputdata, expression);
//useful for making nice readable output from aws sdk
var jms = require('jmespath');

//config
var config = require('config-json');
config.load('./app/config/config.json');

async function ec2RunTask(event, credentials) {
    console.log("Credentials in EC2 lib: "+credentials);
    AWSEC2.config.update({
        accessKeyId:credentials.accessKeyId,
        secretAccessKey:credentials.secretAccessKey,
        sessionToken:credentials.sessionToken,
        region:event.region
    });
    var ec2Client=new AWSEC2.EC2();
    var params=event.params;
    console.log("EC2 Task Parameters: "+ JSON.stringify(params));
    return new Promise(function(resolve, reject){
        ec2Client[event.task](params, function(err, data) {
            console.log("Starting callback of ec2Client task"+event.task);
            if (err) {
                console.log("Inside Error"+JSON.stringify(err));
              reject(err);
            }else{
                console.log("Data from EC2Client"+ event.task+" "+data);
              if (data.length!==0) {
                //var output=jms.search(data, "Vpcs[].{ID: VpcId, IPRange: CidrBlock, Tags: Tags[*]}");
                resolve(data);
              }else{
                resolve(null);
              }
            }
        });
    });
    
}

module.exports=ec2RunTask;