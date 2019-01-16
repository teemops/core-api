var jwtController = require("../../app/controllers/JWTController.js");
var myJWT=jwtController();

module.exports = function(req, res, next){
    var token=req.headers['x-access-token'];
    var jwtValues=myJWT.verifyJWT(token);

    if(jwtValues){
        req.auth_userid=jwtValues.userid;
        console.log("This is the success of getting token"+req.auth_userid);
        next();
    }else{
        console.log("This is the failure of getting token");
        res.json({err: "No token provided or unauthorised."});
    }
  };
