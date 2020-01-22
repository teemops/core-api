
var  AWSEC2= require('aws-sdk');

//jmes path query expressions
// use jms.search(inputdata, expression);
//useful for making nice readable output from aws sdk
var jms = require('jmespath');

//config
var config = require('config-json');
config.load('./app/config/config.json');

async function ec2RunTask(event, credentials=null) {
    if(credentials!=null){
      AWSEC2.config.update({
        accessKeyId:credentials.accessKeyId,
        secretAccessKey:credentials.secretAccessKey,
        sessionToken:credentials.sessionToken,
        region:event.region
      });
    }else{
      AWSEC2.config.update({
        region: event.region
      });
    }
    var ec2Client=new AWSEC2.EC2();
    var params=event.params;

    return new Promise(function(resolve, reject){
        ec2Client[event.task](params, function(err, data) {
            
            if (err) {
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

module.exports=ec2RunTask;