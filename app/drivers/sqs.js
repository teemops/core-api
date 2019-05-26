var AWS    = require('aws-sdk'); 
var config = require('config-json');  
// Check if environment supports native promises
// if (typeof Promise === 'undefined') {
//     AWS.config.setPromisesDependency(require('bluebird'));
// } 

config.load('./app/config/config.json');
const DEFAULT_SQS_VIS_TIMEOUT=30;
const DEFAULT_SQS_WAIT_TIMEOUT=20;
var ep = new AWS.Endpoint(config.get("sqs", "endpoint"));
var sqs = new AWS.SQS({endpoint: ep, region: config.get("sqs", "region")});
var Queues={jobsq: config.get("sqs", "jobsq"), notifyq: "notify_all"};

module.exports=function(){
    return {
        init:  function init () {
            
        },
         /**
         * @author: Ben Fellows <ben@teemops.com>
         * @description: Returns all names of queues as object
         * @returns: object of queue names
         */
        getQs:  function getQs () {
            return Queues;
        },
        /**
         * @author: Ben Fellows <ben@teemops.com>
         * @description: Adds item to queue
         * @returns: success or err
         */
        putQ: async function putJobInQ(qName, params, attrId){
            try{
                const qURL=await this.readQURL(qName);
                const addResult= await this.addItem(qURL, params, attrId);

                return (addResult!=null); 
            }catch(e){
                throw e;
            }
            
        },
        /**
         * 
         * @param {array} params sends parameters for Q
         * @returns Promise<any>
         */
        addItem: function addItem(qURL, params, attrId){
            var qParams = {
                MessageBody: params, /* required */
                QueueUrl: qURL, /* required */
                DelaySeconds: 0,
                MessageAttributes: {
                    mainKey: {
                        DataType: 'Number',
                        StringValue: attrId.toString()
                    }
                }
            };

            return new Promise(function(resolve, reject) {
                sqs.sendMessage(qParams, function(err, data) {
                    if (err){
                        reject(err);
                    }
                    else{
                        if(data!=null){
                            resolve(data);
                        }else{
                            reject('SQS Message failed')
                        }
                        
                    }
                    /*
                    data = {
                        QueueUrl: "https://queue.amazonaws.com/012345678910/MyQueue"
                    }
                    */
                });
            })
        },
        /**
         * @author: Ben Fellows <ben@teemops.com>
         * @description: Reads the Q URL from Queue Name
         * @returns: Promise<any> url or err
         */
        readQURL: function readQURL(qName){
            var params = {
                QueueName: qName
            };

            return new Promise(function(resolve, reject) {
                sqs.getQueueUrl(params, function(err, data) {
                    if (err){
                        reject(err);
                    }
                    else{
                        if(data!=null){
                            resolve(data.QueueUrl);
                        }else{
                            reject('null');
                        }
                        
                    }
                    /*
                    data = {
                        QueueUrl: "https://queue.amazonaws.com/012345678910/MyQueue"
                    }
                    */
                });
            });
            
        },
        /**
         * @author: Ben Fellows <ben@teemops.com>
         * @description: Create Queue
         * @returns: success or err
         */
        addQ: function addQ(qName, callback){

            var params = {
                QueueName: qName
            };

            sqs.createQueue(params, function(err, data) {
                if (err){
                    callback(err, null);
                }
                else{
                    callback(null, data);
                }
                /*
                data = {
                    QueueUrl: "https://queue.amazonaws.com/012345678910/MyQueue"
                }
                */
            });

        },
        /**
         * @author: Ben Fellows <ben@teemops.com>
         * @description: Reads 1 or less items from queue -changed to speed up status updates
         * TODO: Rename to readitems and create another function that retrieves only 1 message.
         * @returns: success or err
         */
        readitem: function readitem(qURL, maxNumMessages=null){
            var qParams = {
                QueueUrl: qURL, /* required */
                MaxNumberOfMessages: (maxNumMessages ? maxNumMessages : 1),
                VisibilityTimeout: DEFAULT_SQS_VIS_TIMEOUT,
                WaitTimeSeconds: DEFAULT_SQS_WAIT_TIMEOUT
            };
            return new Promise(function(resolve, reject) {
                sqs.receiveMessage(
                    qParams, 
                    function(err, data) {
                        if (err){
                            reject(err);
                        }
                        else{
                            resolve(data);
                        }          // successful response
                });
            });
            

        },
        /**
         * @author: Ben Fellows <ben@teemops.com>
         * @description: Removes item from queue
         * @returns: success or err
         */
        removeitem: function removeitem(qURL, message){
            console.log(message.ReceiptHandle);
            var qParams = {
                ReceiptHandle: message.ReceiptHandle, /* required */
                QueueUrl: qURL  /* required */
            };
            return new Promise(function(resolve, reject){
                sqs.deleteMessage(
                    qParams, 
                    function(err, data) {
                        if (err){
                            reject(err);
                        }
                        else{
                            resolve(data);
                        }          // successful response
                });
            });

        }
        
    }
};