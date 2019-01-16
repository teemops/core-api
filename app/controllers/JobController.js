if (typeof Promise === 'undefined') {
    var async = require('asyncawait/async');
    var await = require('asyncawait/await');
    var Promise = require('bluebird');
} 
var schemas = require("../../app/models/");
var appData = require("../../app/drivers/dynamo.js");
var appQ = require("../../app/drivers/sqs.js");
var s3Driver = require("../../app/drivers/s3.js");
var mysql = require("../../app/drivers/mysql.js");
var util = require('util');
var _ = require("lodash");
var mydb= mysql();
var jobQ=appQ();
var s3=s3Driver();
var defaultQs=jobQ.getQs();
console.log(defaultQs.jobsq + "default jobsq");

/**
 * @author: Ben Fellows <ben@teemops.com>
 * @description: Manages jobs for all apps through a Serverless Message Queue
 * @usage: Managing Jobs
 */
module.exports=function(){
    return {
        init:  function init () {  
            mydb.init();
        },
        /**
         * @author: Ben Fellows <ben@teemops.com>
         * @description: Adds new job
         * @usage: request data needs to match schema
         * Lot's TODO
         */
         addJob: async function addJob(authUserid, data){
            var sql="CALL sp_getAppByUserID(?,?)";
            var params = [authUserid,data.appid];

            const addItem=async function(sqldata){
                //SQS
                console.log("JOB being added to Message Queue");
                console.log("data used:"+JSON.stringify(data));
                
                var task = require("../../app/tasks/"+data.action);
                console.log(JSON.stringify(sqldata[0]));
                sqldata.configData=JSON.parse(sqldata.configData);
                sqldata.authData=JSON.parse(sqldata.authData);
                //var Buckets=jobQ.getBuckets();
                var options=Array();
                options['Buckets']=s3.getBuckets();
                var taskBody=task(sqldata, options);

                var message={
                    q: data.task,
                    name: sqldata.name.toString(), 
                    customerid: data.userid,
                    userid: authUserid,
                    appid: data.appid,
                    RoleArn: sqldata.authData.arn,
                    body: taskBody
                };
                const result=await jobQ.putQ(
                    defaultQs.jobsq,
                    JSON.stringify(message),
                    data.appid);
                console.log("Result of Q added is: "+JSON.stringify(result));
                return result;
            }
            
            //query database with sql statement and return results or error through callback function
            try{
                const jobDetails=await mydb.queryPromise(sql, params);
                const addQResult= await addItem(jobDetails[0][0]);
                return addQResult;
            }catch(e){
                throw e
            }

        },
        /**
         * @author: Ben Fellows <ben@teemops.com>
         * @description: Gets latest job from Q to process
         * @usage: To get a job from Q so a back end service job can be run
         * 
         */
        getLatestJob: function getLatestJob(cb){
            
            function readitem(qData){ 
                console.log("DEBUG getLatestJob.readitem qData:"+ qData);
                jobQ.readitem(
                    
                    qData.QueueUrl,
                    function(err, outputdata){
                        if (err) throw err;

                        cb(outputdata);
                    }
                );
            }
            
            jobQ.readQURL(defaultQs.jobsq,
                function readSQSQueue (err, data){
                    if (err) throw err;
                    
                    console.log(data);
                    readitem(data);
                }
  
            );
        },
        /**
         * @author: Ben Fellows <ben@teemops.com>
         * @description: List job tasks type
         * @usage: Lists the type of tasks you can run
         * @returns array[]
         * {
         *  task: [
         *  {
         *   
         * }
         * ]
         * }
         * 
         */
        listTasks: function list(cb){
            
            /**
             * Read Item from Q
             * @param {*} qData 
             */
            function readitem(qData){ 
                console.log("DEBUG getLatestJob.readitem qData:"+ qData);
                jobQ.readitem(
                    
                    qData.QueueUrl,
                    function(err, outputdata){
                        if (err) throw err;

                        cb(outputdata);
                    }
                );
            }
            
            jobQ.readQURL(defaultQs.jobsq,
                function readSQSQueue (err, data){
                    if (err) throw err;
                    
                    console.log(data);
                    readitem(data);
                }
  
            );
        },
        /**
         * @author: Ben Fellows <ben@teemops.com>
         * @description: Removes job from queue
         * @usage: Remove a job from queue
         * 
         */
        removeJob: function removeJob(message, cb){
            
            //deletes item using custom SQS Driver function in drivers folder
            function removeitem(qData, message){ 
                console.log("DEBUG removeJob.removeitem qData:"+ qData);
                jobQ.removeitem(
                    qData.QueueUrl,
                    message,
                    function(err, outputdata){
                        if (err) throw err;

                        cb(outputdata);
                    }
                );
            }
            
            jobQ.readQURL(defaultQs.jobsq,
                function readSQSQueue (err, data){
                    if (err) throw err;
                    
                    console.log(data);
                    removeitem(data, message);
                }
  
            );
        },
    }
};
