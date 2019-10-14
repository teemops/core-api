
var userCloudConfigController = require("../../app/controllers/UserCloudConfigController.js");
var pricingController = require("../../app/controllers/PricingController");
var auth = require("../../app/utils/auth.js");
var bodyParser = require('body-parser');
var express = require('express');

var router = express.Router();
var userCloudConfig = userCloudConfigController();
var pricing = pricingController();
router.use(bodyParser.json());
router.use(auth);

/**
 * @author: Sarah Ruane
 * @description: Get all user cloud config data(VPN, subnet etc)
 * @usage: userid
 * GET /<api_base>/usercloudconfigs
 */
router.get('/listByUserId/:userId?', function (req, res) {
  if (req.auth_userid == req.params.userId) {
    userCloudConfig.getAWSConfigsByUserId(req.params.userId,
      function (err, result) {

        if (!err) {
          res.json(result);
        } else {
          res.json(err);
        }
      });
  }else{
    res.json({error:"access denied"});
  }

});

/**
 * @author: Sarah Ruane
 * @description: add new aws config to user's profile (authenticated)
 * @usage: name, userId, userCloudProviderId, vpc, appSubnet, appSecurityGroup, appInstanceType, customData, region
 * PUT /<api_base>/usercloudconfigs
 */
router.put('/', async function (req, res) {
  if (req.auth_userid == req.body.userId) {
    try {
      var result = await userCloudConfig.addAWSConfig(req.body);
      res.json({ id: result });
    } catch (e) {
      res.json({ error: e });
    }
  }else{
    res.json({error:"access denied"});
  }
  
});

/**
 * @author: Sarah Ruane
 * @description: remove cloud config from user's profile (authenticated)
 * @usage: pass user_aws_config_id as param. user id also required for authorisation
 * DELETE /<api_base>/usercloudconfigs
 */
router.delete('/:params', function (req, res) {

  var params = JSON.parse(req.params.params);

  //This check is to ensure that logged in users can only update their own user details
  //This will likely change in the future if a partner user needs to access details of their clients
  if (req.auth_userid == params.userId) {

    userCloudConfig.deleteAWSConfig({ userId: params.userId, id: params.id },
      function (err, result) {

        if (result) {
          res.json({ success: result });
        }

        if (err) {
          console.log(err);

          if (err.code === 'ER_ROW_IS_REFERENCED_2') {
            res.json({ error: 'FK_ERROR' });
          }
        }
      });
  }
  else {
    console.log("User authenticated (id: " + req.auth_userid + "), but not authorised to update details for user id: " + params.userId);
    res.json({ error: "Not authorised" });
  }
});


router.post('/instance_types', async function (req, res) {
  if (req.body.region != undefined) {
    var types = await pricing.getInstanceTypes(req.body.region);
    res.json({ data: types });
  }

});

/**
 * @author: Sarah Ruane
 * @description: update user's aws config (authenticated)
 * @param: idm name, userId, userCloudProviderId, vpc, appSubnet, appSecurityGroup, appInstanceType, customData, region
 * POST /<api_base>/usercloudconfigs
 */
router.post('/', function (req, res) {

  //This check is to ensure that logged in users can only update their own user details
  //This will likely change in the future if a partner user needs to access details of their clients
  if (req.auth_userid == req.body.userId) {

    userCloudConfig.updateAWSConfig(req.body,
      function (err, result) {

        if (result) {
          res.json({ success: result });
        }

        if (err) {
          res.json({ error: err });
        }
      });
  }
  else {
    console.log("User authenticated (id: " + req.auth_userid + "), but not authorised to update details for user id: " + req.body.userId);
    res.json({ error: "Not authorised" });
  }
});



module.exports = router;
