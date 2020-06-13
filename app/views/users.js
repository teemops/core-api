var userController = require("../../app/controllers/UserController.js");
var express = require('express');
var bodyParser = require('body-parser');
var auth = require("../../app/utils/auth.js");
var userAuth = require("../../app/auth/user")

var router = express.Router();
var myUser = userController();

//Body Parser required to use json and other body data sent in request
//router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());
myUser.init();

// define the home  route
router.get('/', function (req, res) {
    res.send('Users API Documentation');
});

/**
 * @author: Ben Fellows <ben@teemops.com>
 * @description: add a user
 * @usage: request data needs to include fields:
 * {
 * "username":"",
 * "password":"",
 * "first",
 * "last",
 * "email",
 * "address":{
 *  <loose address definition>
 * },
 * [optional]
 * "mfa_token": "hvsdv8fd82viuvd"
 * }
 * 
 */
router.put('/', async function (req, res) {

    try {
        const userId = await myUser.addUser(req.body);
        res.json({ userId });
    } catch (e) {
        res.status(e.status).send({ error: e });
    }

});

router.get('/confirm/:code?', function (req, res) {
    myUser.confirmUser(
        req.params,
        function (outputMessage) {
            console.log("ID Added for new user: " + outputMessage);
            res.json({ status: outputMessage });
        }
    );
});

router.get('/check/:user?', function (req, res) {
    myUser.doesUserExist(req.params,
        function (err, result) {
            res.json({ result });
        }
    );
});

/**
 * @author: Sarah Ruane
 * @description: retrieve user by id (authenticated)
 * @usage: request header needs to include userid and auth token
 * GET /<api_base>/users/:id
 */
router.get('/:id?', auth, function (req, res) {

    //This check is to ensure that logged in users can only retrieve their own user details
    //This will likely change in the future if a partner user needs to access details of their clients
    if (req.auth_userid == req.params.id) {
        myUser.getUserByID(req.params.id,
            function (result) {
                res.json(result);
            });
    }
    else {
        console.log("User authenticated (id: " + req.auth_userid + "), but not authorised to retrieve details for user id: " + req.params.id);
        res.json({ err: "Not authorised" });
    }
});

router.post('/login', function (req, res) {
    myUser.loginUser(req.body,
        function (err, token) {
            if (err) {
                res.json({ err });
            } else {
                res.json(token);
            }


        }
    );
});

router.post('/reset', async function (req, res) {
    try {
        const sendCode = await userAuth().reset(req.body.email)
        res.json(sendCode)
    } catch (e) {
        res.status(500).send({ error: e });
    }

});

router.post('/reset/code', async function (req, res) {
    try {
        const provideCode = await userAuth().provide(req.body.email, req.body.code, req.body.password)
        res.json(provideCode)
    } catch (e) {
        res.status(500).send({ error: e });
    }

});

module.exports = router;
