if (typeof Promise === 'undefined') {
    var async = require('asyncawait/async');
    var await = require('asyncawait/await');
    var Promise = require('bluebird');
}

var AWS    = require('aws-sdk'); 
var config = require('config-json');  
config.load('./app/config/aws.json');

var ep = new AWS.Endpoint(config.get("kms", "endpoint"));
var defaultKeyName=config.get("kms", "defaultKeyName");
var kms = new AWS.KMS({endpoint: ep, region: config.get("kms", "region")});

/**
 * Adds a KMS key to the master teemops AWS account
 * 
 * @param {string} keyName the name of the key, defaults to the configuration value
 * @returns {boolean} true or false
 */
async function addKey(){

    try{
        const keyExists=await doesKeyExist(defaultKeyName);
        if(!keyExists){
            const result=await kmsTask('createKey');
            var keyId=result.KeyMetadata.KeyId;
            var params={
                AliasName: defaultKeyName,
                TargetKeyId: keyId
            }
            const keyName=await kmsTask('createAlias', params);
            return true;
        }else{
            return true;
        }
        
    }catch(e){
        throw e;
    }
    
}

function kmsTask(task, params=null){
    return new Promise(function(resolve, reject){
        kms[task](params, function(err, data){
            if(err){
                console.log("Error " +err);
                reject(err);
            }else{
                console.log("Data: "+data);
                resolve(data);
            }
        });
    });
}

/**
 * Provides encrypted value based on the data parameter
 *  
 * @param {*} key 
 * @param {*} data 
 */
async function encrypt(key, data){

}

/**
 * Provides decrypted value based on the data provided
 * 
 * @param {*} data 
 */
async function decrypt(data){

}

/**
 * Does key with name keyName exist?
 * 
 * @param {*} keyName Name of KMS key
 */
async function doesKeyExist(keyName){
    const keyList=await kmsTask('listAliases');
    if(keyList.Aliases!=null){
        var keyMatching=keyList.Aliases.filter(alias=>alias.AliasName===keyName);
        return keyMatching.length!==0;
    }else{
        return false;
    }
    
}

module.exports.addKey=addKey;
module.exports.encrypt=encrypt;
module.exports.decrypt=decrypt;
