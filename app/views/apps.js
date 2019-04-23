/**
 * Developed by ben@teem.nz Copyright 2016
 * Manages Application Environments adding, deleting, updating and querying status
 *
 */
if (typeof Promise === 'undefined') {
    var async = require('asyncawait/async');
    var await = require('asyncawait/await');
    var Promise = require('bluebird');
} 
var config = require('config-json');
config.load('./app/config/config.json');
var appControlller = require("../../app/controllers/AppController.js");
var jobController = require("../../app/controllers/JobController.js");
var eventController = require("../../app/controllers/EventController.js");

var express = require('express');
var bodyParser = require('body-parser');
var auth = require("../../app/utils/auth.js");

var router = express.Router();
var myApps=appControlller();
var myJobs=jobController();
var myEvents = eventController();

//Body Parser required to use json and other body data sent in request
//router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());
router.use(auth);

//Auth middleware for all routes in this view
myApps.init(config);
myJobs.init(config);

// define the get route
router.get('/', function(req, res) {
  res.send('Apps API Documentation');
});

// define the list page route GET
router.get('/providers', function(req, res) {
    console.log("Providers");
    myApps.getSupportedApps(
        function (providers){
            console.log("All supported apps: "+providers);
            res.json(providers);
        }
    );

});

// route to GET list of cloud providers
router.get('/cloudproviders', function(req, res) {

    myApps.getCloudProviders(
        function (providers){
            console.log("All supported cloud providers: "+providers);
            res.json(providers);
        }
    );

});

// route to GET list of app statues
router.get('/status/list', function(req, res) {

    myApps.getAppStatusList(
        function (list){
            res.json(list);
        }
    );

});

// define the update page route POST
router.post('/update', async function(req, res) {
    console.log(req.auth_userid);
    const output=await myApps.updateApp(req.auth_userid, req.body);
    console.log("All apps for given user ID: "+output);
    res.json(output);

});

// define the list page route POST
router.post('/list', function(req, res) {
    console.log(req.auth_userid);
    myApps.getAppList(req.auth_userid,
        function (outputList){
            console.log("All apps for given user ID: "+outputList);
            res.json(outputList);
        }
    );

});

// define the list page route GET
router.get('/list', function(req, res) {
    console.log(req.auth_userid);
    myApps.getAppList(req.auth_userid,
        function (outputList){
            console.log("All apps for given user ID: "+outputList);
            res.json(outputList);
        }
    );

});

/**
 * @author: Ben Fellows <ben@teemops.com>
 * @description: returns app by ID
 * @usage: request header needs to include
 * GET /<api_base>/apps/<appid>
 */
router.get('/:id?', function(req, res) {
    console.log(req.params.id);
    myApps.getAppByIDAuth(
        req.auth_userid,
        req.params.id,
        function (outputList){
            console.log("App Data for appID: "+outputList);
            res.json(outputList);
        }
    );

});

/**
 * @author: Ben Fellows <ben@teemops.com>
 * @description: adds new apps
 * @usage: request data needs to include
 * {
 * userid: <user_id>,
 * name: <app_name>,
 * appurl: <app_url>
 * }
 */
router.put('/', function(req, res) {
    try{
        myApps.addApp(
            req.auth_userid,
            req.body,
            function (outputMessage){
                console.log("ID Added for new app: "+outputMessage);
                res.json(outputMessage);
            }
        );
    }catch(e){
        res.json({error:e});
    }finally {
        console.log("Processing completed for adding app.");
    }

});

/**
 * @author: Ben Fellows <ben@teemops.com>
 * @description: search and filter for apps
 * @usage: request header needs to include
 * POST /<api_base>/apps/search/<query>
 *
 */
router.get('/search/:q?', function(req, res) {
    console.log(req.params.q);
    myApps.searchApps(
        req.auth_userid,
        req.params.q,
        function (outputList){
            console.log("App Data for query: "+outputList);
            res.json(outputList);
        }
    );
});

/**
 * @author: Sarah Ruane <sarah@teem.nz>
 * @description: deletes or archives an app
 * @usage: request data should include ID of app and query string ?archive=true/false
 */
router.delete('/:id', function(req, res) {

  var archive = req.query.archive !== 'false';
  var appId = req.params.id;
  var userId = req.auth_userid;

  var status = archive
    ? 8   //Archived
    : 7;  //Deleted

  myApps.updateAppStatus(userId, appId, status,
    function(response){

        if(response.result && !response.error){
            res.json({ success: true });
        }
    });

  //Call AWS to archive app

});


/**
 * @author: Ben Fellows <ben@teemops.com>
 * @description: adds new job
 * @usage: request data needs to include
 * {
 * userid: <user_id>,
 * action: <action>, e.g. start, stop, remove
 * appid: <app_id>
 * }
 */
router.put('/job', async function(req, res) {
    //console.log("PUT app/job function Req.body.appid"+req.body.appid);

    var adddata={userid: req.auth_userid, appid: req.body.appid, action: req.body.action, task: req.body.task};

    if(req.auth_userid!=req.body.userid){
        console.log("User "+req.auth_userid+" is not authorised to launch apps for "+req.body.userid);
        res.json({status: "authorisation error"});
    }else{
        try{
            const jobData=await myJobs.task(req.auth_userid,adddata);
            console.log("Queue data: "+jobData);
            if(jobData){
                myApps.updateAppStatus(req.auth_userid, adddata.appid, adddata.action,
                    function(response){
        
                        if(response && !response.error){
                            console.log("Status "+ response);
                            //myEvents.publishUpdateForApp(req.body.userid, req.body.appid);
                            res.json({status: response});
                        }else{
        
                        }
                    }
                );
            }
            
        }catch(e){
            res.json({status: "Error adding a job."});
        }
    }
});

/**
 * @author: Ben Fellows <ben@teemops.com>
 * @description: Launches App
 * @usage: request data needs to include
 * {
 * userid: <user_id>,
 * action: <action>, e.g. start, stop, remove
 * appid: <app_id>
 * }
 */
router.post('/launch', async function(req, res) {
    //console.log("PUT app/job function Req.body.appid"+req.body.appid);

    var adddata={userid: req.auth_userid, appid: req.body.appid, action: req.body.action, task: req.body.task};

    if(req.auth_userid!=req.body.userid){
        console.log("User "+req.auth_userid+" is not authorised to launch apps for "+req.body.userid);
        res.json({status: "authorisation error"});
    }else{
        try{
            const jobData=await myJobs.launchApp(req.auth_userid,adddata);
            console.log("Queue data: "+jobData);
            myApps.updateAppStatus(req.auth_userid, req.body.appid, adddata.action,
                function(response){
    
                    if(response && !response.error){
                        console.log("Status "+ response);
                        //myEvents.publishUpdateForApp(req.body.userid, req.body.appid);
                        res.json({status: response});
                    }else{
    
                    }
                }
            );
        }catch(e){
            res.json({status: "Error adding a job."});
        }
    }
});

/** @author: Ben Fellows <ben@teemops.com>
 *  @description: adds new task to message queue
 * {
 *  appid: 1234,
 *  action: teem.clone
 * }
 */
router.post('/task/:task?', function(req, res){
    var taskData={
        userid: req.auth_userid, 
        appid: req.body.appid, 
        action: req.params.task, 
        task: req.body.task
    };

    //check to see if authorised user id is equal to the requested userid in request
    if(req.auth_userid==req.body.userid){
        myJobs.addJob(
            req.auth_userid,
            taskData,
            function (jobdata){
                console.log("Queue data: "+jobdata);
                
                myApps.updateAppStatus(req.auth_userid, req.body.appid, adddata.action,
                function(response){

                    if(response && !response.error){
                        console.log("Status "+ response);
                        //myEvents.publishUpdateForApp(req.body.userid, req.body.appid);
                        res.json({status:response.result});
                    }
                }
                );
            }
        );
    }else{
        console.log("User "+req.auth_userid+" is not authorised to launch apps for "+req.body.userid);
        res.json({status: "authorisation error"});
    }

});

/**
 * @author: Ben Fellows <ben@teemops.com>
 * @description: returns app infrastructure by ID
 * @usage: request header needs to include
 * GET /<api_base>/apps/infra/<appid>
 */
router.get('/infra/:id?', function(req, res) {
    console.log(req.params.id);
    try{
        myApps.getAppInfra(
            req.auth_userid,
            req.params.id,
            function (outputList){
                console.log("App Infra Data for appID: "+JSON.stringify(outputList));
                res.json(outputList);
            }
        );
    }catch(e){
        res.json({error:"Processing error"});
        console.log(e);
    }
    

});

router.post('/job/complete', function(req, res){

  var status = req.body.type === 'start'
      ? 3 //started
      : 5; //stopped

  myApps.updateAppStatus(req.body.userid, req.body.appid, status,
    function(response){

      if(response.result && !response.error){
        myEvents.publishUpdateForApp(req.body.userid, req.body.appid);
        res.json({ status: status});
      }
    }
  );
});

module.exports = router;
