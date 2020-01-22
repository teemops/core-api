
var  AWSPrice= require('aws-sdk');

//jmes path query expressions
// use jms.search(inputdata, expression);
//useful for making nice readable output from aws sdk
var jms = require('jmespath');

//config
var config = require('config-json');
config.load('./app/config/config.json');

async function pricingRunTask(event, credentials=null) {
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
    return new Promise(function(resolve, reject){
        pricingClient[event.task](params, function(err, data) {
            if (err) {
                console.log("Inside Error"+JSON.stringify(err));
              reject(err);
            }else{
                
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