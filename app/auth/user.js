var mysql = require("../../app/drivers/mysql.js");
var mail = require("../../app/drivers/mail.js");
var configService = require("../../app/drivers/configDriver.js");
var jwtController = require("../../app/controllers/JWTController.js");
var log = require('../drivers/log.js');
const crypto = require('crypto');

function init(appConfig){
    config=appConfig;

    return {
        reset:resetPassword
    }
}


async function resetPassword(user){
    
}

module.exports=init;