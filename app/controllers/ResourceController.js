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
var price=require("../../app/drivers/pricing");
var appQ = require("../../app/drivers/sqs.js");
var mysql = require("../../app/drivers/mysql.js");
var jmespath = require('jmespath');
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
                var instances=jmespath.search(result, "Reservations[].Instances[]");
                
                return instances;
            }catch(e){
                throw e;
            }
            
        },
        /**
         * Get App ID From Meta Data search and AWS Account lookup
         * 
         * @param {*} metaSearch 
         * @param {*} AWSAccountId 
         */
        getAppIdFromMeta: async function(metaSearch, AWSAccountId){
            var sql="CALL sp_getAppIdFromMeta(?,?)";
            var params=[metaSearch, AWSAccountId];
            try{
                const sqldata=await mydb.getRow(sql, params);
                if(sqldata.id!=undefined){
                    return sqldata.id;
                }else{
                    return null;
                }
                
            }catch(e){
                throw e;
            }
        },
        getMetaData: async function(appId){
            var sql="CALL sp_getMetaData(?)";
            var params=[appId];
            try{
                const sqldata=await mydb.getRow(sql, params);
                if(sqldata.metaData!=undefined){
                    return sqldata.metaData;
                }else{
                    return null;
                }
                
            }catch(e){
                throw e;
            }
        },
        stopApp: async function stopApp(authUserid, appId){
            
            try{
                var setupData=await this.setupTask(authUserid, appId);
                var sqldata=setupData.data;
                var creds=setupData.creds;

                var metaData=JSON.parse(sqldata.metaData);
                var instanceIds=jmespath.search(metaData, "Instances[].InstanceId");

                var event = {
                    task: 'stopInstances',
                    params: {
                        InstanceIds: instanceIds
                    },
                    region: sqldata.region
                };

                var result=await ec2(event, creds);
                if(result.StoppingInstances!=undefined){
                    return true;
                }else{
                    return false;
                }
            }catch(e){
                throw e;
            }

        },
        startApp: async function startApp(authUserid, appId){
            try{
                var setupData=await this.setupTask(authUserid, appId);
                var sqldata=setupData.data;
                var creds=setupData.creds;

                var metaData=JSON.parse(sqldata.metaData);
                var instanceIds=jmespath.search(metaData, "Instances[].InstanceId");

                var event = {
                    task: 'startInstances',
                    params: {
                        InstanceIds: instanceIds
                    },
                    region: sqldata.region
                };

                var result=await ec2(event, creds);
                if(result.StartingInstances!=undefined){
                    return true;
                }else{
                    return false;
                }
            }catch(e){
                throw e;
            }
        },
        setupTask: async function setup(authUserid, appId){
            var sql="CALL sp_getAppByUserID(?,?)";
            var params = [authUserid,appId];

            try{
                const sqldata=await mydb.getRow(sql, params);
                
                var stsParams={
                    RoleArn: JSON.parse(sqldata.authData).arn
                }
                var creds=await sts.assume(stsParams);

                return {
                    data: sqldata,
                    creds: creds
                }
            }catch(e){
                throw e;
            }
        },
        /**
         * This can be used as a generic call to a child AWS account using EC2 library
         * Examples:
         * var instances=await resource.ec2Task(123, '123456789', 'describeInstances', {InstanceIds:['i-12345678910']}, 'us-west-2');
         * console.log(JSON.stringify(instances));
         * 
         * Can also use jmespath to format output and only display relevant fields/ data etc...
         * var jmesQuery=jmespath.search(result, "Reservations[ ].Instances[ ]");
         * 
         * @param {*} authUserid Authenticated UserId
         * @param {*} AWSAccountId AWS Account to be queried (must be one that is accessible from this user)
         * @param {*} task 
         * @param {*} params 
         */
        ec2Task: async function(authUserid, AWSAccountId, task, params, region){
            var sql='CALL sp_getSTSCredsUserAccount(?, ?)';
            var sqlParams=[authUserid, AWSAccountId];
            try{
                const sqldata=await mydb.getRow(sql, sqlParams);
                
                var stsParams={
                    RoleArn: JSON.parse(sqldata.authData).arn
                }
                var creds=await sts.assume(stsParams);
                //set credentials
                var event = {
                    task: task,
                    params: params,
                    region: region
                };

                var result=await ec2(event, creds);
                return result;
            }catch(e){
                throw e;
            }

        },
        priceTask: async function(authUserid, AWSAccountId, task, params, region){
            // var sql='CALL sp_getSTSCredsUserAccount(?, ?)';
            // var sqlParams=[authUserid, AWSAccountId];
            try{
                // const sqldata=await mydb.getRow(sql, sqlParams);
                
                // var stsParams={
                //     RoleArn: JSON.parse(sqldata.authData).arn
                // }
                // var creds=await sts.assume(stsParams);
                //set credentials
                var event = {
                    task: task,
                    params: params,
                    region: 'ap-south-1'
                };

                var result=await price(event);
                return result;
            }catch(e){
                throw e;
            }

        }
    }
};
