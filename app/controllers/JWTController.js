var jwt = require('jsonwebtoken');
var configService = require("../../app/drivers/configDriver.js");
var config = require('config-json');

module.exports=function(){
  return {
    /**
    * @author: Ben Fellows <ben@teemops.com>
    * @description: JWT.io token
    * Used in Authorization Header
    */
    createJWT: function(paylod){
       config.load('./app/config/config.json');
       var secret=config.get("mysecrets","secret");
       var token=jwt.sign(paylod, secret, { expiresIn: '2h' });
       return token;
    },

    /**
    * @author: Ben Fellows <ben@teemops.com>
    * @description: JWT.io token
    * Verify
    */
    verifyJWT: function(str){
       config.load('./app/config/config.json');
       var secret=config.get("mysecrets","secret");
       var values=jwt.verify(str, secret);
       return values;
    },

    /**
    * @author: Ben Fellows <ben@teemops.com>
    * @description: JWT.io token
    * Decode
    */
    decodeJWT: function(token){
        try{
            return myJWT.decodeJWT(token);
        }catch(err){
            return false;
        }
    },

    /**
    * @author: Sarah Ruane <sarah@teem.nz>
    * @description: JWT.io refresh token
    * Refresh JWT - if a user is actively using our app we don't want the token to expire
    * This function takes a valid (and not expired) token and returns it with a new expiry date set
    */
    refreshJWT: function (token, cb){

      try {
        var originalPayload = this.verifyJWT(token);

        var optionMapping = {
          iat: 'timestamp',
          exp: 'expiresIn',
          aud: 'audience',
          nbf: 'notBefore',
          iss: 'issuer',
          sub: 'subject',
          jti: 'jwtid',
          alg: 'algorithm'
        };

        var newPayload = {};

        //Copy values from original to new token
        for (var key in originalPayload) {
          if (Object.keys(optionMapping).indexOf(key) === -1) {
             newPayload[key] = originalPayload[key];
          }
        }

        var refreshedToken = this.createJWT(newPayload);

        if(refreshedToken){
          cb(null, { token: refreshedToken, success: true });
        }
        else {
          cb('refresh-error');
        }
      }
      catch(err){
        var errorMessage = err.name === 'TokenExpiredError' ? 'expired' : err.name;
        cb(errorMessage);
      }
    }

  }
};
