var config, key, metaS3, defaultS3s, resource;
var schemas = require("../../app/models/");
var appData = require("../../app/drivers/dynamo.js");
var mysql = require("../../app/drivers/mysql.js");
var appS3 = require("../../app/drivers/s3.js");
var ec2 = require("../../app/drivers/ec2.js");
var tNotify = require("../../app/drivers/notify");
var keyController = require("../../app/controllers/KeyController");
var resourceController = require("../controllers/ResourceController");
var util = require('util');
var _ = require("lodash");
var mydb = mysql();

module.exports = function () {
    return {
        init: function init(appConfig) {
            config = appConfig;
            mydb.init();
            key = keyController(appConfig);
            resource = resourceController();
            resource.init(appConfig);
            metaS3 = appS3(appConfig);
            defaultS3s = metaS3.getBuckets();
        },
        getKey: async function getKey(userId, region, awsAccountId) {
            const result = await key.get(userId, region, awsAccountId);
        },
        getAppByIDAuth: async function getAppByIDAuth(authUserid, appID, cb) {
            var sql = "CALL sp_getAppByUserID(?,?)";
            var params = [authUserid, appID];

            try {
                const result = await mydb.queryPromise(sql, params);
                if (result != null) {
                    console.log(result[0]);
                    return ({
                        result: result[0]
                    });
                } else {
                    throw ({
                        error: "No rows"
                    });
                }
            } catch (e) {
                throw e;
            }

        },
        getUserFromAppId: function getUserId(appID) {
            var sql = "CALL sp_getUserIdFromApp (?)";

            var params = [appID];
            return new Promise(function (resolve, reject) {
                //query database with sql statement and retrun results or error through callback function
                mydb.query(
                    sql, params,
                    function (err, results) {
                        if (err) reject(err);

                        if (results != null) {

                            resolve(results[0][0].userID);
                        } else {
                            reject("No rows");
                        }
                    }
                );
            });

        },
        /**
         * @author: Ben Fellows <ben@teemops.com>
         * @description: Adds new application
         * @usage: request data needs to match schema
         * Lot's TODO
         */
        addApp: async function addApp(authUserid, data) {

            return addItem(data);
            async function addItem(data) {
                var newAppID;
                var sql = "CALL sp_insertApp (?, ?, ?, ?, ?, ?, ?, ?)";

                var params = [
                    authUserid,
                    data.name,
                    data.status,
                    data.cloud,
                    JSON.stringify(data.configData),
                    data.appurl,
                    data.appProviderId,
                    data.userCloudProviderId
                ];
                try {
                    const results = await mydb.insertSPPromise(sql, params);
                    if (results != null) {
                        newAppID = results;

                    } else {
                        throw "Internal database error."
                    }
                } catch (e) {
                    throw e;
                }
                //adds Autoscaling group and optional Application Load Balancer
                if (data.asg != undefined) {
                    if (data.asg.enabled) {
                        sql = "CALL sp_addASG(?,?,?,?,?)";

                        var params = [
                            newAppID,
                            authUserid,
                            data.asg.loadbalancer,
                            data.asg.groupsize,
                            data.asg.groupmax
                        ];
                        try {
                            const results = await mydb.updatePromise(sql, params);
                            if (results != null) {
                                console.log("ASG added");
                            } else {
                                throw "Internal database error."
                            }
                        } catch (e) {
                            throw e;
                        }
                    }
                }
                //adds code deployment
                if (data.sourceCode != undefined) {
                    if (data.sourceCode.source != null) {
                        sql = "CALL sp_addSourceCode(?, ?, ?)";

                        var params = [
                            newAppID,
                            data.sourceCode.path,
                            data.sourceCode.source
                        ];
                        try {
                            const results = await mydb.updatePromise(sql, params);
                            if (results != null) {
                                console.log(results);
                            } else {
                                throw "Internal database error."
                            }
                        } catch (e) {
                            throw e;
                        }
                    }
                }
                return newAppID;
            }

        },
        /**
         * @author: Ben Fellows <ben@teemops.com>
         * @description: Gets application list
         * @usage: request data should include userid
         * resource to select apps based on user
         */
        getAppList: function getAppList(authUserid, cb) {
            var sql = "CALL sp_getAppListByUserID(?);";

            var params = [authUserid];

            //query database with sql statement and retrun results or error through callback function
            mydb.query(
                sql, params,
                function (err, results) {
                    if (err) throw err;

                    if (results != null) {
                        cb({
                            results: results[0]
                        });
                    } else {
                        cb("No rows");
                    }
                }
            );
        },
        /**
         * @author: Ben Fellows <ben@teemops.com>
         * @description: Gets application list
         * @usage: request data should include userid
         * resource to select apps based on user
         */
        searchApps: function searchApps(authUserid, searchQuery, cb) {
            var searchString = mydb.escape('%' + searchQuery + '%');
            var sql = "SELECT *, CAST(app.data AS char(10000) CHARACTER SET utf8) as config_data FROM app WHERE userid=? and (name LIKE " + searchString + " OR appurl LIKE " + searchString + " OR data LIKE " + searchString + ")";
            var params = [authUserid];

            //query database with sql statement and retrun results or error through callback function
            mydb.query(
                sql, params,
                function (err, results) {
                    if (err) throw err;

                    if (results != null) {

                        cb({
                            results: results
                        });
                    } else {
                        cb("No rows");
                    }
                }
            );
        },
        /**
         * @author: Ben Fellows <ben@teemops.com>
         * @description: Gets list of app providers
         * @usage: request all app providers
         */
        getSupportedApps: function getSupportedApps(cb) {
            var sql = "SELECT * FROM app_provider where enabled=1 order by name";

            //query database with sql statement and retrun results or error through callback function
            mydb.query(
                sql, "",
                function (err, results) {
                    if (err) throw err;

                    if (results != null) {
                        console.log(results);
                        cb({
                            results: results
                        });
                    } else {
                        cb({
                            result: "none"
                        });
                    }
                }
            );
        },

        /**
         * @author: Sarah Ruane
         * @description: Gets list of cloud providers
         * @usage: request all cloud providers
         */
        getCloudProviders: function getCloudProviders(cb) {
            var sql = "SELECT * FROM cloud_provider";

            //query database with sql statement and retrun results or error through callback function
            mydb.query(
                sql, "",
                function (err, results) {
                    if (err) throw err;

                    if (results != null) {
                        console.log(results);
                        cb({
                            results: results
                        });
                    } else {
                        cb({
                            result: "none"
                        });
                    }
                }
            );
        },

        /**
         * @author: Sarah Ruane
         * @description: Gets list of valid app statuses
         * @usage: request all app statuses
         */
        getAppStatusList: function getAppStatusList(cb) {
            var sql = "SELECT * FROM app_status";

            mydb.query(
                sql, "",
                function (err, results) {
                    if (err) throw err;

                    if (results != null) {
                        cb({
                            results: results
                        });
                    } else {
                        cb({
                            result: "none"
                        });
                    }
                }
            );

        },

        /**
         * @author: Ben Fellows <ben@teemops.com>
         * @description: Updates application
         * @usage: request data needs to match schema
         * Lot's TBD
         */
        updateApp: async function updateApp(authUserid, data, cb) {

            var sql = "CALL sp_updateApp(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

            var params = [
                data.appId,
                authUserid,
                data.name,
                data.status,
                data.cloud,
                JSON.stringify(data.configData),
                data.appurl,
                data.appProviderId,
                data.userCloudProviderId,
                data.userDataProviderId,
                data.awsConfigId
            ];
            //check or create keypair for giving awsconfigid
            try {
                await this.addKeyPair(authUserid, data.awsConfigId);
                const results = await mydb.updatePromise(sql, params);
                if (results != null) {
                    console.log(results);
                    return results;
                } else {
                    err = "update_error";
                    throw err;
                }
            } catch (e) {
                throw e;
            }

        },

        /**
         * @description action is used e.g. "ec2.launch"
         * Refer to mysql table job_type which has a list of valid actions
         * Also refer to app_status table for valid status names
         */
        updateAppStatus: function updateApp(authUserid, appId, action, notify = null) {
            if (notify != null) {
                var sql = "UPDATE app SET status=(select newstatus from job_type where action=?), notify=? where id=? and userid=?";
                var params = [action, notify, appId, authUserid];
            } else {
                var sql = "UPDATE app SET status=(select newstatus from job_type where action=?), notify=NULL where id=? and userid=?";
                var params = [action, appId, authUserid];
            }

            return new Promise(function (resolve, reject) {
                //insert query with sql, parameters and retrun results or error through callback function
                mydb.update(
                    sql, params,
                    function (err, results) {
                        if (err) reject(err);

                        if (results != null) {
                            console.log(JSON.stringify(results));
                            var status = 1;
                            switch (action) {
                                case 'cfn.create':
                                    status = 3;
                                    break;
                                case 'cfn.delete':
                                    status = 9;
                                    break;
                                case 'cw.stopped':
                                    status = 5;
                                    break;
                                case 'cw.running':
                                    status = 3;
                                    break;
                                case 'ec2.launch':
                                    status = 2;
                                    break;
                                case 'ec2.stop':
                                    status = 4;
                                    break;
                                case 'ec2.start':
                                    status = 2;
                                    break;
                                case 'ec2.delete':
                                    status = 9;
                                    break;
                                case 'ec2.reboot':
                                    status = 8;
                                    break;
                                case 'rds.create':
                                    status = 2;
                                    break;
                                case 'rds.delete':
                                    status = 9;
                                    break;
                                default:
                                    status = 1;
                            }
                            resolve(status);
                        } else {
                            resolve({
                                error: "update_status_error"
                            });
                        }
                    }
                );
            });
        },
        /**
         * Updates App Status from notification.
         * 
         * @param {*} appId 
         * @param {*} action 
         */
        updateStatusFromNotify: async function updateStatusFromNotify(appId, action, reason = null) {
            try {
                var statusUpdate;
                const userId = await this.getUserFromAppId(appId);
                if (reason != null) {
                    statusUpdate = await this.updateAppStatus(userId, appId, action, reason);
                } else {
                    statusUpdate = await this.updateAppStatus(userId, appId, action);
                }

                return statusUpdate;
            } catch (e) {
                throw e;
            }
        },
        /**
         * Updates meta data column in app table
         * 
         * @param {*} appId 
         * @param {*} data 
         */
        updateMetaData: async function updateMeta(appId, data) {
            try {
                var sql = "UPDATE app SET meta_data=? where id=?";
                var params = [data, appId];

                const result = await mydb.updatePromise(sql, params);

                return result;
            } catch (e) {
                throw e;
            }
        },
        /**
         * Gets the applications or servers infrastructure details which are then
         * displayed in the infrastructure details.
         */
        getAppInfra: async function getAppInfra(authUserid, appId) {
            var metaData = await resource.getMetaData(appId);
            var data = JSON.parse(metaData);
            var instances = data.Instances;
            return instances[0];
        },
        /**
         * Adds key pair fo given user id and aws config
         * 
         * @param {*} appId Teemops appid
         */
        addKeyPair: async function addKeyPair(userId, awsConfigId) {
            var sql = "CALL sp_getAWSConfigRegionARN(?)";
            var params = [awsConfigId];
            /**
             * Returns
             * {
             *  Region,
             *  AuthData
             * }
             */
            try {
                const data = await mydb.getRow(sql, params);
                if (data != null) {
                    const roleArn = JSON.parse(data.auth_data).arn;
                    const doesKeyPairExist = await key.check(userId, data.region, roleArn);
                    if (!doesKeyPairExist) {
                        const createResult = await key.create(userId, data.region, roleArn, data.awsAccountId);
                    }
                }

            } catch (e) {
                throw e;
            }

        },
        updateAlb: async function updateAlb(data) {
            var sql = 'CALL sp_updateALB(?, ?, ?, ?)';
            var params = [
                data.appId,
                data.albSubnets,
                data.albListeners,
                data.albSSLArn
            ];
            try {
                const result = await mydb.insertSPPromise(sql, params);
                if (result) {
                    return true;
                } else {
                    return false;
                }
            } catch (e) {
                throw e;
            }
        }
    }
};