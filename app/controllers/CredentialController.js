var schemas = require("../../app/models/");
var mysql = require("../../app/drivers/mysql.js");
var config = require('config-json');
config.load('./app/config/config.json');
const crypto = require('crypto');
var jwt = require('jsonwebtoken');
var mydb= mysql();

module.exports=function(){
    return {
      addUserDataProvider: function(data, cb) {

        var sql = "CALL sp_insertUserDataProvider (?, ?, ?)";

        var params = [data.userCloudProviderId, data.awsAuthMethod, data.authData];

        mydb.insertSP(
            sql, params,
            function(err, result){
                if (err) throw err;

                if(result!=null){
                    cb(null, result);
                }
            }
        );
      },

      updateUserDataProvider: function(data, cb) {

        var sql = "UPDATE user_data_providers SET " +
          "user_cloud_provider_id = ?, " +
          "auth_data = ? " +
          "WHERE id = ?";

        var params = [data.userCloudProviderId, data.authData, data.id];

        mydb.update(
            sql, params,
            function(err, result){
                if (err) throw err;

                if(result!=null){
                    cb(null, result);
                }
            }
        );
      },

      getDataProvidersByUserId: function(userId, cb){
        var sql = "CALL sp_getDataProvidersByUserId(?)";
        var params = [userId];

        //query database with sql statement and retrun results or error through callback function
        mydb.query(
            sql, params,
            function(err, results){
                if (err) throw err;

                if(results!=null) {
                    cb(null, results[0]);
                }
                else {
                    cb(null, []);
                }
            }
        );
      },

      /**
     * get specific Cloud Data Provider by accountid and userId
     * @param {*} accountId 
     * @param {*} userId
     * @param {*} cb 
     */
    getByAccountId: function(userId, accountId, cb){
        var sql="CALL sp_getDataProvidersByAccountId(?,?)";
        var params=[userId, accountId];
        try{
          mydb.query(
            sql, params,
            function(err, results){
                if (err) throw err;
                cb({results:results[0]});
            }
          );
        }catch(e){
          cb({error: "Error getting Cloud Provider"}, null);
        }
      },

      deleteUserDataProvider: function(id, cb){
        var sql = "DELETE FROM user_data_providers WHERE id = ?";
        var params = [id];

        //query database with sql statement and retrun results or error through callback function
        mydb.update(
            sql, params,
            function(err, results){
              if (err) throw err;

              if(results!=null){
                  cb(null, results);
              }
            }
        );
      }
    }
  };
