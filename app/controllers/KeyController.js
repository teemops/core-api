
const ERROR_CODE_NOKEYPAIR = 'InvalidKeyPair.NotFound';
const KEY_S3_PATH = "customer/keys/";
var ec2 = require("../../app/drivers/ec2");
var stsDriver = require("../../app/drivers/sts");
var s3Driver = require("../../app/drivers/s3");
var kmsDriver = require("../../app/drivers/kms");

var config, ec2, sts, s3, kms, defaultKeyName, keyBucket;

function init(appConfig) {
    config = appConfig;
    sts = stsDriver(appConfig);
    kms = kmsDriver(appConfig);
    s3 = s3Driver(appConfig);
    defaultKeyName = config.get("kms", "defaultKeyName");
    keyBucket = config.get("s3", "key_store");

    return {
        create: createEc2Key,
        check: checkEc2KeyExists,
        get: getEc2Key,
        list: listEc2Keys
    }
}

/**
 * Creates Ec2 KeyPair for a given account and region labelling as current teemops userid.
 * Returns PEM file which needs to be added to the KMS store
 * 
 * @param {*} userId 
 * @param {*} region 
 * @param {*} RoleArn 
 */
async function createEc2Key(userId, region, RoleArn, awsAccountId) {
    var stsParams = {
        RoleArn: RoleArn
    }
    var keyName = "teemops-" + userId;
    var keyPairParams = {
        region: region,
        task: 'createKeyPair',
        params: {
            KeyName: keyName
        }
    }

    try {
        const creds = await sts.assume(stsParams);
        const key = await ec2(keyPairParams, creds);
        //now get the unencrypted KeyMaterial(PEM key unencrypted)
        if (key != null) {
            const encrypted = await kms.encrypt(defaultKeyName, key.KeyMaterial);
            var objectPath = createKeyObjectPath(userId, awsAccountId, region, keyName);
            const savedS3 = await s3.save(objectPath, keyBucket, encrypted);
            if (savedS3) {
                return true;
            } else {
                var error = 'EC2 Key Pair was not saved to S3';
                throw error;
            }
        } else {
            return null;
        }
    } catch (e) {
        throw e;
    }
}

function createKeyObjectPath(userId, awsAccountId, region, keyName) {
    return KEY_S3_PATH + userId + "/" + awsAccountId + "/" + region + "/" + keyName + ".pem";
}

/**
 * Returns unencrypted key
 * 
 * @param {*} userId 
 * @param {*} region 
 * @param {*} RoleArn 
 */
async function getEc2Key(userId, region, awsAccountId) {
    var keyName = "teemops-" + userId;
    var objectPath = createKeyObjectPath(userId, awsAccountId, region, keyName);
    try {
        const savedS3 = await s3.read(objectPath, keyBucket);
        const decrypted = await kms.decrypt(savedS3);
        if (decrypted) {
            return decrypted.toString();
        } else {
            var error = 'EC2 Key Pair was not found in S3';
            throw error;
        }
    } catch (e) {
        throw e;
    }
}

/**
 * Returns list of key names for EC2 Key Pairs
 * 
 * @param {*} userId 
 * @param {*} region 
 * @param {*} RoleArn 
 */
async function listEc2Keys(userId) {
    var prefixPath = KEY_S3_PATH + userId;
    try {
        //list objects under customer id
        const items = await s3.list(prefixPath, keyBucket);
        if (items) {
            return items.Contents.map(function (value) {
                var newKey = value.Key.split('/');
                return {
                    account: newKey[3],
                    region: newKey[4],
                    item: `${newKey[3]}-${newKey[4]}-${newKey[5]}`
                };
            });
        } else {
            return null;
        }

    } catch (e) {
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
async function checkEc2KeyExists(userId, region, RoleArn) {
    var stsParams = {
        RoleArn: RoleArn,
        caller: 'KeyController'
    }

    var keyPairParams = {
        region: region,
        task: 'describeKeyPairs',
        params: {
            KeyNames: [
                "teemops-" + userId
            ]
        }
    }

    try {
        const creds = await sts.assume(stsParams);
        const keys = await ec2(keyPairParams, creds);
        return keys.KeyPairs.length > 0;
    } catch (e) {
        if (e.code == ERROR_CODE_NOKEYPAIR) {
            return false;
        }
        throw e;
    }
}
module.exports = init;