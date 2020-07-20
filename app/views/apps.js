/**
 * Developed by ben@teem.nz Copyright 2016
 * Manages Application Environments adding, deleting, updating and querying status
 *
 */

var config = require('config-json');
config.load('./app/config/config.json');
var appControlller = require("../../app/controllers/AppController.js");
var jobController = require("../../app/controllers/JobController.js");
var eventController = require("../../app/controllers/EventController.js");
var resourceController = require("../controllers/ResourceController");
var log = require('../../app/drivers/log.js');
var express = require('express');
var bodyParser = require('body-parser');
var jmespath = require('jmespath');
var security = require('../../app/security/index');
var log = require('../../app/drivers/log.js');
var router = express.Router();
var myApps = appControlller();
var myJobs = jobController();
var myEvents = eventController();
var resource = resourceController();

//Body Parser required to use json and other body data sent in request
//router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());
// Authentication middleware
router.use(security.middleware);

//Auth middleware for all routes in this view
myApps.init(config);
myJobs.init(config);
resource.init(config);

// define the get route
router.get('/', function (req, res) {
    res.send('Apps API Documentation');
});

// define the list page route GET
router.get('/providers', function (req, res) {
    console.log("Providers");
    myApps.getSupportedApps(
        function (providers) {
            console.log("All supported apps: " + providers);
            res.json(providers);
        }
    );

});

// route to GET list of cloud providers
router.get('/cloudproviders', function (req, res) {

    myApps.getCloudProviders(
        function (providers) {
            console.log("All supported cloud providers: " + providers);
            res.json(providers);
        }
    );

});

// route to GET list of app statues
router.get('/status/list', function (req, res) {

    myApps.getAppStatusList(
        function (list) {
            res.json(list);
        }
    );

});

// define the update page route POST
router.post('/update', async function (req, res) {
    console.log(req.auth_userid);
    const output = await myApps.updateApp(req.auth_userid, req.body);
    console.log("All apps for given user ID: " + output);
    res.json({ result: output });

});

// define the list page route POST
router.post('/list', function (req, res) {
    console.log(req.auth_userid);
    myApps.getAppList(req.auth_userid,
        function (outputList) {
            console.log("All apps for given user ID: " + outputList);
            res.json(outputList);
        }
    );

});

// define the list page route GET
router.get('/list', function (req, res) {
    console.log(req.auth_userid);
    myApps.getAppList(req.auth_userid,
        function (outputList) {
            console.log("All apps for given user ID: " + outputList);
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
router.get('/:id?', async function (req, res) {
    console.log(req.params.id);
    try {
        const app = await myApps.getAppByIDAuth(req.auth_userid, req.params.id);
        res.json(app);
    } catch (e) {
        res.json({ error: e });
    }

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
router.put('/', async function (req, res) {
    try {
        const result = await myApps.addApp(req.auth_userid, req.body);
        res.json({ appid: result });
    } catch (e) {
        res.json({ error: e });
    } finally {
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
router.get('/search/:q?', function (req, res) {
    console.log(req.params.q);
    myApps.searchApps(
        req.auth_userid,
        req.params.q,
        function (outputList) {
            console.log("App Data for query: " + outputList);
            res.json(outputList);
        }
    );
});

/**
 * @author: Ben Fellows <ben@teemops.com>
 * @description: TERMINATES an APP _this terminates instances (But doesn't delete the app record)
 * @usage: request data should include ID of app and query string ?archive=true/false
 */
router.delete('/terminate/:id', async function (req, res) {

    var archive = req.query.archive !== 'false';
    var appId = req.params.id;
    var userId = req.auth_userid;

    //TODO Call AWS to archive app (hasn't been done yet - creates an AMI).

    try {
        const jobData = await myJobs.deleteApp(userId, appId);
        console.log("Queue data: " + jobData);
        const response = await myApps.updateAppStatus(userId, appId, 'cfn.delete');

        if (response && !response.error) {
            console.log("Status " + response);
            //myEvents.publishUpdateForApp(req.body.userid, req.body.appid);
            res.json({ status: response });
        } else {
            throw "Unkown error in DELETE/:id calling updateAppStatus";
        }
    } catch (e) {
        res.json({ status: "Error adding a job." });
    }

});

/**
 * @author: Sarah Ruane <sarah@teem.nz>
 * @description: deletes or archives an app
 * @usage: request data should include ID of app and query string ?archive=true/false
 */
router.delete('/:id', async function (req, res) {

    var appId = req.params.id;
    var userId = req.auth_userid;

    //TODO Call AWS to archive app (hasn't been done yet - creates an AMI).

    try {
        const jobData = await myJobs.deleteApp(userId, appId);
        console.log("Queue data: " + jobData);
        const response = await myApps.updateAppStatus(userId, appId, 'cfn.delete');

        if (response && !response.error) {
            console.log("Status " + response);
            //myEvents.publishUpdateForApp(req.body.userid, req.body.appid);
            res.json({ status: response });
        } else {
            throw "Unkown error in DELETE/:id calling updateAppStatus";
        }
    } catch (e) {
        res.json({ status: "Error adding a job." });
    }

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
router.put('/job', async function (req, res) {
    //console.log("PUT app/job function Req.body.appid"+req.body.appid);

    var adddata = { userid: req.auth_userid, appid: req.body.appid, action: req.body.action, task: req.body.task };

    if (req.auth_userid != req.body.userid) {
        console.log("User " + req.auth_userid + " is not authorised to launch apps for " + req.body.userid);
        res.json({ status: "authorisation error" });
    } else {
        try {
            const jobData = await myJobs.task(req.auth_userid, adddata);
            console.log("Queue data: " + jobData);
            if (jobData) {
                const response = await myApps.updateAppStatus(req.auth_userid, adddata.appid, adddata.action);
                if (response && !response.error) {
                    console.log("Status " + response);
                    //myEvents.publishUpdateForApp(req.body.userid, req.body.appid);
                    res.json({ status: response });
                } else {

                }
            }

        } catch (e) {
            res.json({ status: "Error adding a job." });
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
router.post('/launch', async function (req, res) {
    //console.log("PUT app/job function Req.body.appid"+req.body.appid);

    var addData = { userid: req.auth_userid, appid: req.body.appid, action: req.body.action, task: req.body.task };

    if (req.auth_userid != req.body.userid) {
        res.json(log.error(log.EXCEPTIONS.forbidden, "User is not authorised to launch"));
    } else {
        try {
            var jobData;
            if (addData.action == 'update') {
                jobData = await myJobs.launchApp(req.auth_userid, addData, true);
            } else {
                jobData = await myJobs.launchApp(req.auth_userid, addData);
            }

            console.log("Queue data: " + jobData);
            const response = await myApps.updateAppStatus(req.auth_userid, req.body.appid, addData.action);

            if (response && !response.error) {
                console.log("Status " + response);
                //myEvents.publishUpdateForApp(req.body.userid, req.body.appid);
                res.json({ status: response });
            } else {
                throw "Unkown error in updateAppStatus";
            }
        } catch (e) {
            res.json(e);
        }
    }
});


/**
 * @author: Ben Fellows <ben@teemops.com>
 * @description: Deploys Code to App
 * @usage: request data needs to include
 * {
 * userid: <user_id>,
 * action: <action>, e.g. start, stop, remove
 * appid: <app_id>
 * }
 */
router.post('/deploy', async function (req, res) {
    //console.log("PUT app/job function Req.body.appid"+req.body.appid);

    var addData = { userid: req.auth_userid, appid: req.body.appid, action: req.body.action, task: req.body.task };

    if (req.auth_userid != req.body.userid) {
        res.json(log.error(log.EXCEPTIONS.forbidden, "User is not authorised to deploy"));
    } else {
        try {
            var jobData = await myJobs.deployCode(req.auth_userid, addData);

            console.log("Queue data: " + jobData);

            if (response && !response.error) {
                console.log("Status " + response);
                //myEvents.publishUpdateForApp(req.body.userid, req.body.appid);
                res.json({ status: response });
            } else {
                throw "Unkown error in updateAppStatus";
            }
        } catch (e) {
            res.json({ status: "Error adding a job.", details: e });
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
router.post('/task/:task?', async function (req, res) {
    var taskData = {
        userid: req.auth_userid,
        appid: req.body.appid,
        action: req.params.task,
        task: req.body.task
    };

    //check to see if authorised user id is equal to the requested userid in request
    if (req.auth_userid == req.body.userid) {
        myJobs.addJob(
            req.auth_userid,
            taskData,
            async function (jobdata) {
                console.log("Queue data: " + jobdata);
                const response = await myApps.updateAppStatus(req.auth_userid, req.body.appid, adddata.action);
                if (response && !response.error) {
                    console.log("Status " + response);
                    //myEvents.publishUpdateForApp(req.body.userid, req.body.appid);
                    res.json({ status: response.result });
                }
            }
        );
    } else {
        res.json(log.error(log.EXCEPTIONS.forbidden, "User is not authorised"));
    }

});

/**
 * @author: Ben Fellows <ben@teemops.com>
 * @description: returns app infrastructure by ID
 * @usage: request header needs to include
 * GET /<api_base>/apps/infra/<appid>
 */
router.get('/infra/:id?', async function (req, res) {
    if (req.auth_userid) {
        try {
            var result = await myApps.getAppInfra(req.auth_userid, req.params.id);
            if (result != null) {
                res.json({ result: result });
            } else {
                res.json({ error: 'No infrastructure for this app yet.' })
            }
        } catch (e) {
            res.json({ error: e });
        }
    } else {
        // log.error(log.EXCEPTIONS.forbidden, "User is not authorised");
        res.json({ error: "User is not authorised" });
    }
});

router.post('/job/complete', async function (req, res) {

    var status = req.body.type === 'start'
        ? 3 //started
        : 5; //stopped

    const response = await myApps.updateAppStatus(req.body.userid, req.body.appid, status);

    if (response.result && !response.error) {
        myEvents.publishUpdateForApp(req.body.userid, req.body.appid);
        res.json({ status: status });
    }
});
/**
 * request example:
 * {
 *      "awsAccountId":"1234556",
 *      "task": "describeVPCs",
 *      "params": {},
 *      "region": "us-west-2"
 * }
 */
router.post('/ec2', async function (req, res) {
    console.log(req.body.id);

    try {
        var result = await resource.ec2Task(req.auth_userid, req.body.awsAccountId, req.body.task, req.body.params, req.body.region);
        if (result != null) {
            if (req.body.filter != undefined) {
                result = jmespath.search(result, req.body.filter);
            }
            res.json({ data: result });
        } else {
            res.json({ error: 'EC2 Task returned no results' })
        }

    } catch (e) {
        res.json({ error: "Processing error" });
        console.log(e);
    }

});

/**
 * AWS Task 'at'
 * This runs a generic AWS Task
 * 
 * Expected Input
{
    "awsAccountId": 123,
    "className": "ACM",
    "task": "listCertificates",
    "params": {},
    "region": "ap-southeast-2"
}
 */
router.post('/general', async function (req, res) {

    try {
        var result = await resource.genericTask(req.auth_userid, req.body.awsAccountId, req.body.className, req.body.task, req.body.params, req.body.region);
        if (result != null) {
            if (req.body.filter != undefined) {
                result = jmespath.search(result, req.body.filter);
            }
            res.json({ data: result });
        } else {
            res.json({ error: 'Generic Task returned no results' })
        }

    } catch (e) {
        res.json({ error: "Processing error" });
        console.log(e);
    }

});

/**
 * request example:
 * {
 *      "awsAccountId":"1234556",
 *      "task": "describeServices",
 *      "params": {},
 *      "region": "us-west-2"
 * }
 */
router.post('/pricing', async function (req, res) {
    console.log(req.body.id);

    try {
        var result = await resource.priceTask(req.auth_userid, req.body.awsAccountId, req.body.task, req.body.params, req.body.region);
        if (result != null) {
            if (req.body.filter != undefined) {
                result = jmespath.search(result, req.body.filter);
            }
            res.json({ data: result });
        } else {
            res.json({ error: 'Pricing Task returned no results' })
        }

    } catch (e) {
        res.json({ error: "Processing error" });
        console.log(e);
    }

});

router.post('/alb', async function (req, res) {
    try {
        const result = await myApps.updateAlb(req.body);
        res.json({ result: result });
    } catch (e) {
        res.json({ error: e });
    }
});

module.exports = router;
