var credentialController = require("../../app/controllers/CredentialController.js");
var userCloudProviderController = require("../../app/controllers/UserCloudProviderController");
var express = require('express');
var router = express.Router();
var myCredential = credentialController();
var userCloudProvider = userCloudProviderController();
var security = require('../../app/security/index');

const DEFAULT_CLOUD_PROVIDER = 1; //AWS

// Authentication middleware
router.use(security.middleware);

router.put('/', async function (req, res) {
  /**
   * Check whether or not the usercloudprovider's account is added yet
   * if accountid does not exist then add
   */
  var authData = JSON.parse(req.body.authData);
  var accountId = userCloudProvider.getAccountIdFromAuth(req.body.authData);

  console.log("AccountID: " + accountId);
  try {
    const providers = await userCloudProvider.getByAccountId(req.body.userid, accountId);
    if (providers == undefined) {

      var providerParams = {
        userId: req.body.userId,
        cloudProviderId: DEFAULT_CLOUD_PROVIDER,
        awsAccountId: accountId,
        name: authData.name,
        isDefault: req.body.isDefault
      };
      //TODO: create async request

      const account = await userCloudProvider.addCloudProviderAccount(providerParams);
      var params = {
        userCloudProviderId: account.id,
        awsAuthMethod: req.body.awsAuthMethod,
        authData: req.body.authData
      };

      const newId = await myCredential.addUserDataProvider(params);
      res.json({ credentialId: newId });

    } else {
      var params = {
        userCloudProviderId: providers.id,
        awsAuthMethod: req.body.awsAuthMethod,
        authData: req.body.authData
      };

      const newId = await myCredential.addUserDataProvider(params);
      res.json({ credentialId: newId });
    }
  } catch (e) {
    res.json({ e });
  }

});

router.post('/', function (req, res) {

  myCredential.updateUserDataProvider(req.body,
    function (err, result) {

      if (err) {
        res.json({ err });
      }
      else {
        res.json({ success: result });
      }
    }
  );
});

router.delete('/:id?', function (req, res) {

  myCredential.deleteUserDataProvider(req.params.id,
    function (err, result) {

      if (err) {
        res.json({ err });
      }
      else {
        res.json({ success: result });
      }
    }
  );
});

router.get('/listByUserId/:userId?', function (req, res) {
  if (security.has(req)) {
    myCredential.getDataProvidersByUserId(req.params.userId,
      function (err, result) {

        if (err) {
          res.json({ err });
        }
        else {
          res.json(result);
        }
      }
    );
  } else {
    res.status(401);
    res.json({error:"Access denied"});
  }
});

module.exports = router;
