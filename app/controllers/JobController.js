
var config, cfn, sts, s3;
const DEFAULT_CONFIG_PATH='app/config/config.json';
const CFN_APP_LABEL='app-';
var resourceController = require("../controllers/ResourceController.js"); 
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
var resource=resourceController();

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
            resource.init(config);
            mydb.init();
        },
        launchApp: async function launchApp(authUserid, data){
            var sql="CALL sp_getAppByUserID(?,?)";
            var params = [authUserid,data.appid];
            const KEYSTORE_TEMPLATE=data.task;
            var cfnLaunch=cfn;
            try{
                const sqldata=await mydb.getRow(sql, params);
                
                var stsParams={
                    RoleArn: JSON.parse(sqldata.authData).arn
                }
                var creds=await sts.assume(stsParams);
                //set credentials
                cfnLaunch.creds(sqldata.region, creds);
                var outputResults=await cfnLaunch.getOutputs(CFN_APP_LABEL+data.appid);
                var result;
                if(outputResults!=null && outputResults[0].OutputKey=='InstanceId'){
                    result=outputResults[0].OutputValue;
                }else{
                    var cfnParams=this.ec2Params(sqldata);
                    result=await cfnLaunch.create(CFN_APP_LABEL+data.appid, KEYSTORE_TEMPLATE, cfnParams, false, true);
                }
                return result;
            }catch(e){
                throw e;
            }
            
        },
        task: async function task(authUserid, data){
            var appId=data.appid;
            try{
                switch(data.action){
                    case 'ec2.stop':
                        return await resource.stopApp(authUserid, appId);
                    case 'ec2.start':
                        return await resource.startApp(authUserid, appId);
                    case 'reboot':
                        return await this.rebootApp(appId);
                    default:
                        throw 'No task selected';
                }
            }catch(e){
                throw e;
            }
        },
        deleteApp: async function deleteApp(authUserid, appId){
            var sql="CALL sp_getAppByUserID(?,?)";
            var params = [authUserid,appId];
            var cfnLaunch=cfn;
            try{
                const sqldata=await mydb.getRow(sql, params);
                
                var stsParams={
                    RoleArn: JSON.parse(sqldata.authData).arn
                }
                var creds=await sts.assume(stsParams);

                //set credentials
                cfnLaunch.creds(sqldata.region, creds);
                var result=await cfnLaunch.delete(CFN_APP_LABEL+appId);
                return result;
            }catch(e){
                throw e;
            }
        },
        rebootApp: async function rebootApp(appId){

        },
        cloneApp: async function cloneApp(appId){

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
