var appController = require("../../app/controllers/AppController.js");
var express = require('express');

var router = express.Router();
var myApps=appController();

// route to GET list of app statuses
router.get('/list', function(req, res) {

    myApps.getAppStatusList(
        function (list){
            res.json(list);
        }
    );

});

module.exports = router;
