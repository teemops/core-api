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
var schemas = require("../../app/models/");
var appData = require("../../app/drivers/dynamo.js");
var appQ = require("../../app/drivers/sqs.js");
var s3Driver = require("../../app/drivers/s3.js");
var mysql = require("../../app/drivers/mysql.js");
var util = require('util');
var _ = require("lodash");
var mydb= mysql();
var jobQ=appQ();
var defaultQs=jobQ.getQs();
console.log(defaultQs.jobsq + "default jobsq");

/**
 * @author: Ben Fellows <ben@teemops.com>
 * @description: Manages jobs for all apps through a Serverless Message Queue
 * @usage: Managing Jobs
 */
module.exports=function(){
    return {
        init:  function init (appConfig) {  
            config=appConfig;
            cfn=cfnDriver(appConfig);
            sts=stsDriver(appConfig);
            s3=s3Driver(appConfig);
            mydb.init();
        },
        launchApp: async function launchApp(authUserid, data){
            var sql="CALL sp_getAppByUserID(?,?)";
            var params = [authUserid,data.appid];
            const KEYSTORE_TEMPLATE=data.task;

            try{
                const sqldata=await mydb.getRow(sql, params);
                
                var stsParams={
                    RoleArn: JSON.parse(sqldata.authData).arn
                }
                var creds=await sts.assume(stsParams);
                //set credentials
                cfn.creds(sqldata.region, creds);
                var outputResults=await cfn.getOutputs(CFN_APP_LABEL+data.appid);
                var result;
                if(outputResults!=null && outputResults[0].OutputKey=='InstanceId'){
                    result=outputResults[0].OutputValue;
                }else{
                    var cfnParams=this.ec2Params(sqldata);
                    result=await cfn.create(CFN_APP_LABEL+data.appid, KEYSTORE_TEMPLATE, cfnParams, false, true);
                }
                return result;
            }catch(e){
                throw e;
            }
            
        },
        stopApp: async function stopApp(authUserid, data){

        },
        startApp: async function startApp(authUserid, data){

        },
        deleteApp: async function deleteApp(authUserid, data){

        },
        rebootApp: async function rebootApp(authUserid, data){

        },
        cloneApp: async function cloneApp(authUserid, data){

        },
        /**
         * Parameters for the CloudFormation launch of an Ec2 Instance
         * 
         * @param {*} data 
         */
        ec2Params:function ec2Params(data){
            data.configData=JSON.parse(data.configData);
            if(data.keyPair==undefined){
                data.keyPair='teemops-'+data.userID;
            }
            return {
                AMI: data.aimageid,
                InstanceType: data.appInstanceType,
                RootVolumeSize: data.configData.cloud.diskSize,
                AppId: data.appId,
                AppName: data.name,
                CustomerId: data.userID,
                KeyPair: data.keyPair,
                Subnet: data.appSubnet,
                SecurityGroup: data.appSecurityGroup
            }
        }
    }
};
