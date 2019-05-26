
var pricingController=require("../../app/controllers/PricingController");
var bodyParser = require('body-parser');
var express = require('express');

var router = express.Router();
var pricing=pricingController();
router.use(bodyParser.json());

router.post('/instance_types', async function(req, res) {
  if(req.body.region!=undefined){
    var types=await pricing.getInstanceTypes(req.body.region);
    res.json({data: types});
  }

});

module.exports = router;
