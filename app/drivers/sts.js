

var  AWSSTS= require('aws-sdk');
//globals
var config, externalId;
var sts= new AWSSTS.STS();

const sessionName="Teemops_core_api";

module.exports=init;

function init(appConfig){
    config=appConfig;
    externalId=config.get("ExternalId");
    return {
      assume: stsAssume
    }
}

async function stsAssume(event) {
    var params={
      DurationSeconds: 900,
      RoleArn: event.RoleArn,
      ExternalId: externalId,
      RoleSessionName: sessionName
    };
    return new Promise(function(resolve, reject){
        sts.assumeRole(params, function(err, data){
            if (err) {
              reject(err);
            }else{
              if (data.Credentials.length!==0) {
                var creds={
                  accessKeyId:data.Credentials.AccessKeyId,
                  secretAccessKey:data.Credentials.SecretAccessKey,
                  sessionToken:data.Credentials.SessionToken,
                  region:event.region
                };
                resolve(creds);
              }else{
                reject("Error Assuming Role");
              }
            }  
          });
    })

}

