var schemas = require("../../app/models/");
var appData = require("../../app/drivers/dynamo.js");
var mysql = require("../../app/drivers/mysql.js");
var mail = require("../../app/drivers/mail.js");
var configService = require("../../app/drivers/configDriver.js");
var jwtController = require("../../app/controllers/JWTController.js");
var log = require('../drivers/log.js');

var config = require('config-json');
config.load('./app/config/config.json');
const crypto = require('crypto');
var util = require('util');
var _ = require("lodash");
var express = require('express');
var mydb = mysql();
var myEmail = mail();
var myJWT = jwtController();
var router = express.Router();
var cfg = configService();

myEmail.init(config);

module.exports = function () {
    return {
        init: function init() {

        },

        getUserByID: function getUserByID(id, cb) {

            var sql = "CALL sp_getUserById(?)";
            var params = [id];

            //query database with sql statement and return results or error through callback function
            mydb.query(sql, params,
                function (err, results) {
                    if (err) {
                        throw err;
                    }

                    if (results != null) {
                        cb({
                            result: results[0]
                        });
                    } else {
                        cb({
                            error: "No rows"
                        });
                    }
                });
        },

        doesUserExist: function exists(data, cb) {
            var sql = "SELECT count(*) as count FROM user WHERE email = ? OR username = ?";

            var params = [data.user, data.user];
            console.log("Emailusername:" + data.user);

            mydb.query(
                sql, params,
                function (err, results) {
                    if (err) cb(err, null);

                    if (results != null) {
                        if (results[0].count > 0) {
                            cb(null, true);
                        } else {
                            cb(null, false);
                        }
                    } else {
                        cb(null, null);
                    }
                }
            );

        },

        loginUser: function loginUser(data, cb) {

            var sql = "SELECT userid, username, status FROM user WHERE email = ? AND password = MD5(?)";
            var params = [data.email, this.createPassword(data.password)];

            mydb.query(
                sql, params,
                function (err, results) {
                    if (err) throw err;

                    if (results != null) {

                        if (results.length == 1) {
                            if (results[0].status == 1) {
                                var jwtPayload = {
                                    userid: results[0].userid,
                                    username: results[0].username,
                                    email: data.email,
                                    role: 'user'
                                };
                                //TODO: Update this function to handle different roles, by now default role is user role.
                                var jwtToken = myJWT.createJWT(jwtPayload);

                                cb(null, {
                                    token: jwtToken,
                                    status: true
                                });
                            } else {
                                cb("unverified", false);
                            }
                        } else {
                            cb(null, {
                                status: false
                            });
                        }

                    } else {
                        cb(null, {
                            status: false
                        });
                    }
                }
            );
        },
        /**
         * @author: Ben Fellows <ben@teemops.com>
         * @description: Adds new user
         * @usage: request data needs to match schema
         * Lot's TODO
         */
        addUser: async function addUser(data) {

            var defaultStatus = 0; //disabled by default
            var timeNow = Date.now();
            var confirmCode = this.createConfirmCode(data.username + data.email + timeNow);
            var sql = "INSERT INTO user(email, username, password, status, timestamp, confirmcode, first, last)";
            sql += " VALUES(?, ?, MD5(?), ?, ?, ?, ?, ?)";
            var params = [
                data.email,
                data.username,
                this.createPassword(data.password),
                defaultStatus,
                timeNow,
                confirmCode,
                data.first,
                data.last
            ];

            try {
                const results = await mydb.insertPromise(sql, params);
                if (results != null) {
                    sendConfirmEmail(results);
                    return results;
                }
            } catch (e) {
                if (e.code != null) {
                    switch (e.code) {
                        case 'ER_DUP_ENTRY':
                            throw log.EXCEPTIONS.DUPLICATE;
                            break;
                        default:
                            throw e;
                    }
                } else {
                    throw e;
                }
            } finally {

            }

            function sendConfirmEmail(results) {
                var subject = "Please confirm your Teem Ops Registration";
                var message = "<p>Confirmation Link: " + cfg.item("ui_site", "base_url").base_url + "/public/confirm/" + confirmCode + "</p>";

                myEmail.sendEmail(
                    data.email, subject, message,
                    function (err, messageResult) {
                        if (err) cb(err, null);

                        if (messageResult != null) {
                            cb(null, results);
                        }
                    }
                );
            };

        },
        requestPass: function requestPass(userName, cb) {
            var sql = "UPDATE user SET password=MD5(?) where userid=?";
            var params = [
                this.createPassword(data.password),
                authUserid
            ];

            //insert query with sql, parameters and return results or error through callback function
            mydb.update(
                sql, params,
                function (err, results) {
                    if (err) throw err;

                    if (results != null) {
                        console.log(results);
                        cb({
                            result: results
                        });
                    } else {
                        cb({
                            error: "update_error"
                        });
                    }
                }
            );
        },
        updatePass: function updatePass(authUserid, pass, cb) {
            var sql = "UPDATE user SET password=MD5(?) where userid=?";
            var params = [
                this.createPassword(data.password),
                authUserid
            ];

            //insert query with sql, parameters and retrun results or error through callback function
            mydb.update(
                sql, params,
                function (err, results) {
                    if (err) throw err;

                    if (results != null) {
                        console.log(results);
                        cb({
                            result: results
                        });
                    } else {
                        cb({
                            error: "update_error"
                        });
                    }
                }
            );
        },
        updateUser: function updateUser(authUserid, data, cb) {
            var sql = "UPDATE user SET first=?, last=? where userid=?";
            var params = [
                data.first,
                data.last,
                authUserid
            ];

            //insert query with sql, parameters and retrun results or error through callback function
            mydb.update(
                sql, params,
                function (err, results) {
                    if (err) throw err;

                    if (results != null) {
                        console.log(results);
                        cb({
                            result: results
                        });
                    } else {
                        cb({
                            error: "update_error"
                        });
                    }
                }
            );
        },
        confirmUser: function confirmUser(data, cb) {
            var sql = "UPDATE user set status=1, confirmcode=null WHERE confirmcode=? and confirmcode IS NOT NULL";

            var params = [
                data.code
            ];

            //insert query with sql, parameters and retrun results or error through callback function
            mydb.update(
                sql, params,
                function (err, results) {
                    if (err) throw err;

                    if (results != null) {
                        console.log(results);
                        cb(results);
                    }
                }
            );
        },
        /**
         * TODO: 
         * This needs minimum scrypt functionality found in https://github.com/barrysteyn/node-scrypt
         * 
         * TODO:
         * This needs to be moved to a security driver - potentially using
         * an internal OS provided library (scrypt C++ implementation)
         * or external KMS type service, which has
         * more robust protecion and means secret will be not stored on OS, only
         * available in protected memory for app as required. 
         * 
         * TODO:
         * At the moment this is not the best place
         * to have a function that handles security - would be too easy for 
         * someone to accidentally make a change and then do a PR that
         * causes this to be overlooked as part of that PR.
         * @param {*} str 
         */
        createPassword: function createPassword(str) {
            config.load('./app/config/config.json');

            var hash = crypto.createHmac('sha256', config.get("mysecrets", "secret"))
                .update(str)
                .digest('hex');
            return hash;
        },
        createConfirmCode: function createConfirmCode(str) {
            config.load('./app/config/config.json');

            var hash = crypto.createHmac('sha256', config.get("mysecrets", "confirm_secret"))
                .update(str)
                .digest('hex');
            return hash;
        }
    }
};