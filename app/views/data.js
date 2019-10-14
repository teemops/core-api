
var regionData=require("../../app/data/regions.json");
var bodyParser = require('body-parser');
var express = require('express');

var router = express.Router();

router.use(bodyParser.json());

router.get('/regions', async function(req, res) {
    res.json(regionData);
});

module.exports = router;
