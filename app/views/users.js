var userController = require("../../app/controllers/UserController.js");
var express = require('express');
var bodyParser = require('body-parser');
var auth = require("../../app/utils/auth.js");
if (typeof Promise === 'undefined') {
    var async = require('asyncawait/async');
    var await = require('asyncawait/await');
    var Promise = require('bluebird');
} 
var fs = Promise.promisifyAll(require('fs')); // adds Async() versions that return promises
var router = express.Router();
var myUser=userController();
var config;

//Body Parser required to use json and other body data sent in request
//router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());
myUser.init();

// define the home  route
router.get('/', function(req, res) {
  res.send('Users API Documentation');
});

// define the list page route
router.get('/list', function(req, res) {
  res.json({ userid: '1', name: 'ben', email: 'sdsdds@sdjnsjkdn.com' }); 
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
router.put('/', function(req, res) {
    myUser.addUser(
        req.body,
        function(err, result){
            if (err) { res.json({ err });  }
            var userid=result;
             res.json({ userid }); 
        }
    );

});

router.get('/confirm/:code?', function(req, res) {
    myUser.confirmUser(
        req.params,
        function (outputMessage){
            console.log("ID Added for new user: "+outputMessage);
            res.json({ status: outputMessage });
        }
    );
});

router.get('/check/:user?', function(req, res) {
    myUser.doesUserExist(req.params,
    function (err, result){
        console.log("User exists: "+result);
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
router.get('/:id?', auth, function(req, res) {

    //This check is to ensure that logged in users can only retrieve their own user details
    //This will likely change in the future if a partner user needs to access details of their clients
    if(req.auth_userid == req.params.id) {
      myUser.getUserByID(req.params.id,
        function (result){
          res.json(result);
        });
    }
    else {
      console.log("User authenticated (id: " + req.auth_userid + "), but not authorised to retrieve details for user id: " + req.params.id);
      res.json({err: "Not authorised"});
    }
});

/**
 * @author: Ben Fellows <ben@teemops.com>
 * @description: search and filter for users
 * @usage: request header needs to include
 * POST /<api_base>/users/search/<query>
 * 
 */
router.get('/search/:q?', function(req, res) {
    console.log(req.params.q);
    myUser.searchUsers(req.params.q,
        function (outputList){
            console.log("User Data for query: "+outputList);
            res.json(outputList); 
        }
    );
});

router.post('/login', function(req, res) {
    myUser.loginUser(req.body,
    function (err, token){
        if (err) { 
            res.json({ err });  
        }else{
            console.log("Login Result: "+token);
            res.json( token );
        }

        
    }
  );
});




module.exports = router;
