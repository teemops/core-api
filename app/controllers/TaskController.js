var appQ = require("../drivers/sqs.js");
var mysql = require("../drivers/mysql.js");
var _ = require("lodash");
var mydb = new mysql();
var taskQ = appQ();

var defaultQs = taskQ.getQs();
console.log(defaultQs.jobsq + "default jobsq");

/**
 * @author: Ben Fellows <ben@teemops.com>
 * @description: Use SQS for simple message queuing
 * @usage: Managing tasks
 */
module.exports = function () {
    return {
        init: function init() {
            mydb.init();
        },
        /**
         * @author: Ben Fellows <ben@teemops.com>
         * @description: Adds new task
         * @usage: request data needs to match schema
         * 
         */
        addTask: function addTask(data, params, cb) {
            //send tasks to queue
            var message={
                task: data.task,
                appid: data.appid,
                RoleArn: sqldata.authData.arn,
                body: taskBody
            };
            taskQ.additem(
                defaultQs.jobsq,

            )
        },
    }
};