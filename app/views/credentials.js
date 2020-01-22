var credentialController = require("../../app/controllers/CredentialController.js");
var userCloudProviderController=require("../../app/controllers/UserCloudProviderController");
var userController = require("../../app/controllers/UserController.js");
var express = require('express');
var bodyParser = require('body-parser');
var auth = require("../../app/utils/auth.js");

var router = express.Router();
var myCredential=credentialController();
var userCloudProvider=userCloudProviderController();
var myUser=userController();

const DEFAULT_CLOUD_PROVIDER=1; //AWS

// Authentication middleware
// router.use(auth);

router.put('/', function(req, res) {
    /**
     * Check whether or not the usercloudprovider's account is added yet
     * if accountid does not exist then add
     */
    var authData=JSON.parse(req.body.authData);
    var accountId=userCloudProvider.getAccountIdFromAuth(req.body.authData);
    
    console.log("AccountID: "+accountId);

    //check if account exists
    userCloudProvider.getByAccountId(
      req.body.userId,
      accountId,
      function (providers){
          console.log("All supported cloud providers: "+providers);

          if(!providers.length){
            var providerParams={
              userId: req.body.userId,
              cloudProviderId: DEFAULT_CLOUD_PROVIDER,
              awsAccountId: accountId,
              name: authData.name,
              isDefault: req.body.isDefault
            };
            
            addUsersCloudAccount(providerParams);
          }else{
            addUsersProvider(providers);
          }    
      }
    );
    
    /**
     * Adding users cloud account details such as aws accountid
     * @param {*} params 
     */
    function addUsersCloudAccount(params){
      userCloudProvider.addCloudProviderAccount(
        params,
        function(err, data){
          if (err) {
            res.json({ err });
          }
          else {
            addUsersProvider(data);
          }
        }
      );
    }
    
    /**
     * Adding Users Cloud provider data/details
     * including auth type and credential information e.g. 
     * IAM Cross account role name.
     */
    function addUsersProvider(userCloudProvider){
      var params={
        userCloudProviderId: userCloudProvider.id,
        awsAuthMethod: req.body.awsAuthMethod,
        authData: req.body.authData
      };

      myCredential.addUserDataProvider(params,
        function (err, result){
  
          if (err) {
            res.json({ err });
          }
          else {
            res.json({ credentialId: result });
          }
        }
      );
    } 
});

router.post('/', function(req, res) {

    myCredential.updateUserDataProvider(req.body,
      function (err, result){

          if (err) {
            res.json({ err });
          }
          else {
            res.json({ success: result });
          }
      }
    );
});

router.delete('/:id?', function(req, res) {

    myCredential.deleteUserDataProvider(req.params.id,
      function (err, result){

        if (err) {
          res.json({ err });
        }
        else {
          res.json({ success: result });
        }
      }
    );
});

router.get('/listByUserId/:userid?', function(req, res) {

    myCredential.getDataProvidersByUserId(req.params.userid,
      function (err, result){

        if (err) {
          res.json({ err });
        }
        else {
          res.json(result);
        }
      }
    );
});

module.exports = router;
