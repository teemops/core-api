if (typeof Promise === 'undefined') {
    var async = require('asyncawait/async');
    var await = require('asyncawait/await');
    var Promise = require('bluebird');
} 

var ec2Driver=require("../../app/drivers/ec2");
var stsDriver=require("../../app/drivers/sts");

var config, ec2, sts;

async function init(appConfig){
    config=appConfig;
    ec2=ec2Driver(appConfig);
    sts=stsDriver(appConfig);
}

/**
 * Creates Ec2 KeyPair for a given account and region labelling as current teemops userid.
 * 
 * @param {*} userId 
 * @param {*} region 
 * @param {*} RoleArn 
 */
async function createEc2Key(userId, region, RoleArn){
    var stsParams={
        RoleArn:RoleArn
    }
    
    var keyPairParams={
        region: region,
        task: 'createKeyPair',
        params:{
            KeyName: "teemops-"+userId
        }
    }

    try{
        const creds=await sts(stsParams);
        const key=await ec2(keyPairParams, creds);
        //now get the unencrypted KeyMaterial(PEM key unencrypted)
        if(key!=null){

        }
    }catch(e){
        throw e;
    }
}

/**
 * Checks if EC2 key pair exists for given account, region and teemops user
 * 
 * @param {*} userId 
 * @param {*} region 
 * @param {*} RoleArn 
 */
async function checkEc2KeyExists(userId, region, RoleArn){
    var stsParams={
        RoleArn:RoleArn
    }
    
    var keyPairParams={
        region: region,
        task: 'describeKeyPairs',
        params:{
            KeyNames: [
                "teemops-"+userId
             ]
        }
    }

    try{
        const creds=await sts(stsParams);
        const keys=await ec2(keyPairParams, creds);
        return keys.KeyPairs.length>0;
    }catch(e){
        throw e;
    }
}
module.exports=init;
module.exports.create=createEc2Key;
module.exports.check=checkEc2KeyExists;