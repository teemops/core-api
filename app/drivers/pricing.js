if (typeof Promise === 'undefined') {
    var async = require('asyncawait/async');
    var await = require('asyncawait/await');
    var Promise = require('bluebird');
} 
var  AWSPrice= require('aws-sdk');

//jmes path query expressions
// use jms.search(inputdata, expression);
//useful for making nice readable output from aws sdk
var jms = require('jmespath');

//config
var config = require('config-json');
config.load('./app/config/config.json');

async function pricingRunTask(event, credentials=null) {
    console.log("Credentials in EC2 lib: "+credentials);
    if(credentials!=null){
        AWSPrice.config.update({
        accessKeyId:credentials.accessKeyId,
        secretAccessKey:credentials.secretAccessKey,
        sessionToken:credentials.sessionToken,
        region:event.region
      });
    }else{
      AWSPrice.config.update({
        region: event.region
      });
    }
    var pricingClient=new AWSPrice.Pricing();
    var params=event.params;
    console.log("Pricing Task Parameters: "+ JSON.stringify(params));
    return new Promise(function(resolve, reject){
        pricingClient[event.task](params, function(err, data) {
            console.log("Starting callback of pricing task"+event.task);
            if (err) {
                console.log("Inside Error"+JSON.stringify(err));
              reject(err);
            }else{
                console.log("Data from pricing"+ event.task+" "+data);
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

module.exports=pricingRunTask;