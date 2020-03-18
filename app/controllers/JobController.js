
var config, cfn, sts, s3;
const DEFAULT_CONFIG_PATH='app/config/config.json';
const CFN_APP_LABEL='app-'; //DONT CHANGE EVER
const CFN_CODE_LABEL='code-'; //DONT CHANGE EVER
const CFN_TASKS={
    EC2:{
        template: 'ec2',
        output: 'InstanceId'
    },
    ASG: {
        template: 'asg',
        output: 'ASGGroupName'
    },
    ASG_ALB: {
        template: 'asg.alb',
        output: 'ASGGroupName'
    },
    CODE: {
        template: 'code.build',
        output: 'TopsCodeDeployName'
    }
};

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
        /**
         * This function will do either a stack creation or stack update
         * depending on the update parameter
         * 
         * @param {*} authUserid 
         * @param {*} data 
         * @param {*} update 
         */
        launchApp: async function launchApp(authUserid, data, update=false){
            var sql="CALL sp_getAppByUserID(?,?)";
            var params = [authUserid,data.appid];
            var TEMPLATE_TO_USE;
            var cfnLaunch=cfn;
            var outputKey='InstanceId';
            var cfnParams;
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
                
                //check for if hasALB or hasASG
                //OPTION 1: HAS ALB and HASASG
                if(sqldata.hasALB && sqldata.hasASG){
                    TEMPLATE_TO_USE=CFN_TASKS.ASG_ALB.template;
                    outputKey=CFN_TASKS.ASG_ALB.output;
                    cfnParams=this.asgALBParams(sqldata);
                }else if(sqldata.hasASG){
                    //OPTION 2: Has ASG Only
                    TEMPLATE_TO_USE=CFN_TASKS.ASG.template;
                    outputKey=CFN_TASKS.ASG.output;
                    cfnParams=this.asgParams(sqldata);
                }else{
                    //OPTION X: Has EC2 Only
                    TEMPLATE_TO_USE=CFN_TASKS.EC2.template;
                    outputKey=CFN_TASKS.EC2.output;
                    cfnParams=this.ec2Params(sqldata);
                }

                if(outputResults!=null && outputResults[0].OutputKey==outputKey){
                    result=outputResults[0].OutputValue;
                }else{
                    result=await cfnLaunch.create(CFN_APP_LABEL+data.appid, TEMPLATE_TO_USE, cfnParams, false, true, true, update);
                }
                
                return result;
            }catch(e){
                throw e;
            }
            
        },
        /**
         * This function will do either a stack creation or stack update
         * for deploying codebuild and pipeline
         * 
         * @param {*} authUserid 
         * @param {*} data 
         * @param {*} update 
         */
        deployCode: async function deployCode(authUserid, data, update=false){
            var sql="CALL sp_getAppByUserID(?,?)";
            var params = [authUserid,data.appid];
            var TEMPLATE_TO_USE;
            var cfnLaunch=cfn;
            var outputKey='InstanceId';
            var cfnParams;
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
                
                //check for if hasALB or hasASG
                //OPTION 1: HAS ALB and HASASG
                if(sqldata.hasALB && sqldata.hasASG){
                    outputKey=CFN_TASKS.ASG_ALB.output;
                }else if(sqldata.hasASG){
                    //OPTION 2: Has ASG Only
                    outputKey=CFN_TASKS.ASG.output;
                }else{
                    //OPTION X: Has EC2 Only
                    outputKey=CFN_TASKS.EC2.output;
                }

                if(outputResults!=null && outputResults[0].OutputKey==outputKey){
                    result=outputResults[0].OutputValue;
                    //code deploy
                    if(sqldata.codePath!=undefined){
                        var asgGroupName=result;
                        //TODO: do some code deployment config stuff TBD
                        TEMPLATE_TO_USE=CFN_TASKS.CODE.template;
                        outputKey=CFN_TASKS.CODE.output;
                        cfnParams=this.codeBuildParams(sqldata, asgGroupName);
                        result=await cfnLaunch.create(CFN_CODE_LABEL+data.appid, TEMPLATE_TO_USE, cfnParams, false, true, true, update);
                    }
                    return result;
                }else{
                    throw 'Code cannot be deployed at this time';
                }
                
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
        },
        /**
         * Parameters for the CloudFormation launch of an ASG
         * 
         * @param {*} data 
         */
        asgParams:function asgParams(data){
            var appEnvironment=(data.appEnvironment==undefined ? null : appEnvironment=data.appEnvironment);
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
                SecurityGroup: data.appSecurityGroup,
                AppEnvironment: appEnvironment,
                Min: data.asgMin,
                Max: data.asgMax,
                HasPublicIp: 'true'
            }
        },
        /**
         * Parameters for the CloudFormation launch of an ASG with ALB
         * 
         * @param {*} data
         */
        asgALBParams:function asgALBParams(data){
            //params that can be null
            var appEnvironment=(data.appEnvironment==undefined ? null : appEnvironment=data.appEnvironment);
            var sslArn=(data.albSSLArn==undefined ? null : sslArn=data.albSSLArn);

            data.configData=JSON.parse(data.configData);
            if(data.keyPair==undefined){
                data.keyPair='teemops-'+data.userID;
            }

            var params={
                AMI: data.aimageid,
                InstanceType: data.appInstanceType,
                RootVolumeSize: data.configData.cloud.diskSize,
                AppId: data.appId,
                AppName: data.name,
                CustomerId: data.userID,
                KeyPair: data.keyPair,
                VPC: data.vpc,
                Subnet: data.appSubnet,
                SecurityGroup: data.appSecurityGroup,
                AppEnvironment: appEnvironment,
                Min: data.asgMin,
                Max: data.asgMax,
                ALBSubnets: data.albSubnets,
                HasPublicIp: 'false',
                SSLArn: sslArn
            };

            return params;
        },
        /**
         * Parameters for the CloudFormation launch of a CodeBuild and Pipeline
         * 
         * @param {*} data
         */
        codeBuildParams:function codeBuildParams(data, asgGroupName){
            //params that can be null
            
            data.configData=JSON.parse(data.configData);

            var params={
                AppId: data.appId,
                AppName: data.name,
                GitRepo: data.codePath,
                GitProvider: data.codeSource.toString().toUpperCase(),
                DeploymentPath: '/var/www/html',
                Language: data.system,
                ASGGroup: asgGroupName,
                BuildImage: data.docker
            };

            return params;
        }
    }
};
