
var AWS = require('aws-sdk');
var config, defaultKeyName, kms;


module.exports = function (appConfig) {
    config = appConfig;
    ep = new AWS.Endpoint(config.get("kms", "endpoint"));
    defaultKeyName = config.get("kms", "defaultKeyName");
    kms = new AWS.KMS({ endpoint: ep, region: config.get("kms", "region") });

    return {
        addKey: addKey,
        encrypt: encrypt,
        decrypt: decrypt
    }
}

/**
 * Adds a KMS key to the master teemops AWS account
 * 
 * @param {string} keyName the name of the key, defaults to the configuration value
 * @returns {boolean} true or false
 */
async function addKey() {

    try {
        const keyExists = await doesKeyExist(defaultKeyName);
        if (!keyExists) {
            const result = await kmsTask('createKey');
            var keyId = result.KeyMetadata.KeyId;
            var params = {
                AliasName: defaultKeyName,
                TargetKeyId: keyId
            }
            const keyName = await kmsTask('createAlias', params);
            return true;
        } else {
            return true;
        }

    } catch (e) {
        throw e;
    }

}

function kmsTask(task, params = null) {
    return new Promise(function (resolve, reject) {
        kms[task](params, function (err, data) {
            if (err) {
                console.log("Error " + err);
                reject(err);
            } else {
                console.log("Data: " + data);
                resolve(data);
            }
        });
    });
}

/**
 * Returns encrypted value based on text input
 *  
 * @param {*} key 
 * @param {*} text 
 */
async function encrypt(key = defaultKeyName, text) {
    var params = {
        KeyId: key,
        Plaintext: new Buffer(text)
    }
    try {
        const encryptResult = await kmsTask('encrypt', params);
        if (encryptResult.CiphertextBlob != null) {
            return encryptResult.CiphertextBlob;
        } else {
            return false;
        }
    } catch (e) {
        throw e;
    }

}

/**
 * Provides decrypted value based on the text provided
 * 
 * @param {*} text 
 */
async function decrypt(buffer) {
    var params = {
        CiphertextBlob: buffer
    }
    try {
        const decryptedResult = await kmsTask('decrypt', params);
        if (decryptedResult.Plaintext != null) {
            return decryptedResult.Plaintext;
        } else {
            return false;
        }
    } catch (e) {
        throw e;
    }

}

/**
 * Does key with name keyName exist?
 * 
 * @param {*} keyName Name of KMS key
 */
async function doesKeyExist(keyName) {
    const keyList = await kmsTask('listAliases');
    if (keyList.Aliases != null) {
        var keyMatching = keyList.Aliases.filter(alias => alias.AliasName === keyName);
        return keyMatching.length !== 0;
    } else {
        return false;
    }

}

