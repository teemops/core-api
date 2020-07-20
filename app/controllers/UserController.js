var config = require('config-json');
config.load('./app/config/config.json');

var mysql = require("../../app/drivers/mysql.js");
var mail = require("../../app/drivers/mail.js");
var configService = require("../../app/drivers/configDriver.js");
var jwtController = require("../../app/controllers/JWTController.js");
var keyController = require("../../app/controllers/KeyController");
var log = require('../drivers/log.js');

var util = require('util');
var _ = require("lodash");
var express = require('express');
var mydb = mysql();
var myEmail = mail();
var myJWT = jwtController();
var router = express.Router();
var cfg = configService();

var password = require('../../app/auth/password')
var pass = password(config)

myEmail.init(config);
var key = keyController(config);

module.exports = function () {
    return {
        init: function init() {

        },
        listKeys: async function listKeys(userId) {
            const result = await key.list(userId);
            return result;
        },
        getKey: async function getKey(userId, region, awsAccountId) {
            const result = await key.get(userId, region, awsAccountId);
            return result;
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
            var params = [data.email, pass.create(data.password)];

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
            var confirmCode = pass.confirm(data.username + data.email + timeNow);
            var sql = "INSERT INTO user(email, username, password, status, timestamp, confirmcode, first, last)";
            sql += " VALUES(?, ?, MD5(?), ?, ?, ?, ?, ?)";
            var params = [
                data.email,
                data.username,
                pass.create(data.password),
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
                        if (err) throw err;

                        if (messageResult != null) {
                            return results;
                        }
                    }
                );
            };

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
        }
    }
};