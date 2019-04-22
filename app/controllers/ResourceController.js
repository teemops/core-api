if (typeof Promise === 'undefined') {
    var async = require('asyncawait/async');
    var await = require('asyncawait/await');
    var Promise = require('bluebird');
} 
var config, cfn, sts, s3;
const DEFAULT_CONFIG_PATH='app/config/config.json';
const CFN_APP_LABEL='app-';
var cfnDriver=require("../../app/drivers/cfn");
var stsDriver=require("../../app/drivers/sts");
var ec2=require("../../app/drivers/ec2");
var appQ = require("../../app/drivers/sqs.js");
var mysql = require("../../app/drivers/mysql.js");
var util = require('util');
var _ = require("lodash");
var mydb= mysql();
var jobQ=appQ();
var defaultQs=jobQ.getQs();
console.log(defaultQs.jobsq + "default jobsq");

/**
 * @author: Ben Fellows <ben@teemops.com>
 * @description: Query resources in AWS accounts
 * @usage: Query Resources in customers child AWS Accounts
 */
module.exports=function(){
    return {
        init:  function init (appConfig) {  
            config=appConfig;
            cfn=cfnDriver(appConfig);
            sts=stsDriver(appConfig);
            mydb.init();
        },
        describeInstance: async function describe(appId, InstanceId){
            var sql="CALL sp_getSTSCreds(?)";
            var params = [appId];

            try{
                const sqldata=await mydb.getRow(sql, params);
                
                var stsParams={
                    RoleArn: JSON.parse(sqldata.authData).arn
                }
                var creds=await sts.assume(stsParams);
                //set credentials
                var event = {
                    task: 'describeInstances',
                    params: {
                        InstanceIds: [
                            InstanceId
                        ]
                    },
                    region: sqldata.region
                };

                var result=await ec2(event, creds);
                
                
                return result;
            }catch(e){
                throw e;
            }
            
        }
    }
};
