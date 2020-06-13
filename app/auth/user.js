var config = require('config-json');
config.load('./app/config/config.json');

var mysql = require("../../app/drivers/mysql.js");
var mail = require("../../app/drivers/mail.js");
var log = require('../drivers/log.js');
var password = require('./password')
var pass = password(config)

var mydb = mysql();
var myEmail = mail();


myEmail.init(config);
const CODE_TIME_EXPIRY = 15; //minutes until a code expires
const PASSWORD_LENGTH = {
    min: 8,
    max: 25
}

function init(appConfig) {
    config = appConfig;

    return {
        reset: resetPassword,
        provide: provideResetCode
    }
}

async function resetPassword(email) {
    var tempCode = randomCode();
    var currentTime = new Date()
    var timeIn15Mins = new Date(currentTime.getTime() + CODE_TIME_EXPIRY * 60000).getTime()
    var sql = "UPDATE user set temp_code=?, temp_code_expiry=? WHERE email=? and confirmcode IS NULL";

    var params = [
        tempCode,
        timeIn15Mins,
        email,
    ];

    try {
        const result = await mydb.updatePromise(sql, params);
        if (result) {
            const send = await emailResetCode(email, tempCode)
            return true
        }
        return result
    } catch (e) {
        return e
        //return 'There was an error sending you a reset code'
    }

}

/**
 * Check if reset code is valid and the expiry time is greater than now
 * 
 * @param {*} email 
 * @param {*} code 
 */
async function provideResetCode(email, code, newPassword) {
    var timeNow = Date.now()
    var sql = "UPDATE user set password=MD5(?), temp_code=NULL, temp_code_expiry=NULL WHERE email=? and temp_code=? and temp_code_expiry>?"
    var params = [
        pass.create(newPassword),
        email,
        code,
        timeNow
    ]

    try {
        if (newPassword.length < PASSWORD_LENGTH.min && newPassword.length > PASSWORD_LENGTH.max) {
            throw `Password length was not between ${PASSWORD_LENGTH.min} and ${PASSWORD_LENGTH.max} characters long. Please enter a new password.`
        }
        const update = await mydb.updatePromise(sql, params)
        if (update) {
            return 'Password updated'
        } else {
            throw 'Password reset code has expired, you will need to perform another reset'
        }
    } catch (e) {
        return e
    }
}

function emailResetCode(email, code) {
    var subject = "Reset your password";
    var message = `
    Please reset your Teem Ops password by entering the code below into the password reset form in your browser.
    
    Code: ${code}

    Thanks,

    Teem Ops
    https://app.teemops.com
    `;
    return new Promise(function (resolve, reject) {
        myEmail.sendEmail(
            email, subject, message,
            function (err, messageResult) {
                if (err) reject(err)

                if (messageResult != null) {
                    resolve(messageResult)
                }
            }
        );
    })

};

function randomCode() {
    var maximum = 999999
    var minimum = 111111
    return Math.floor(Math.random() * (maximum - minimum)) + minimum;
}

module.exports = init;