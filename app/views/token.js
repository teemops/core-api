var jwtController = require("../../app/controllers/JWTController.js");
var express = require('express');

var router = express.Router();
var myJWT=jwtController();

router.post('/refresh', function(req, res) {
  var token = req.headers['x-access-token'];

  myJWT.refreshJWT(token, function(err, refreshToken){
    if (err) {
      res.json({ err : err });
    }
    else {
      res.json(refreshToken);
    }
  });
});

module.exports = router;
