var mysql = require("../../app/drivers/mysql.js");
var mydb= mysql();
const DEFAULT_CLOUD_PROVIDER=1; //AWS

module.exports=function(){
  return {
    /**
    * @author: Sarah Ruane
    * @description: Add a new cloud provider account to a users profile
    * @usage: request data should include userid, cloudproviderId, awsAccountId, name, isDefault flag
    */
    addCloudProviderAccount: function (data, cb){

       var sql = "CALL sp_insertUserCloudProvider (?, ?, ?, ?, ?)";
       var params = [
           data.userId,
           data.cloudProviderId,
           data.awsAccountId,
           data.name,
           data.isDefault ? 1 : 0
       ];

       try{
         //insert query with sql, parameters and retrun results or error through callback function
         mydb.insertSP(
             sql, params,
             function(err, result){
                 if (err) throw err;

                 if(result != null){
                    cb(null, { id : result });
                 }
             }
         );
       }
       catch(e){
          cb({error: "Error adding new cloud provider account"}, null);
       }
       finally{

       }
    },

    /**
     * Get All cloudproviders for user
     * TODO
     * @param {long} userid 
     * @param {*} cb 
     */
    getAll: function (userId, cb){

    },

    /**
     * Get account id from authData arn field
     * @param {*} authData  Object that has accountid, aws arn etc..
     */
    getAccountIdFromAuth: function(authData){
      console.log(JSON.parse(authData).arn);
      arn=JSON.parse(authData).arn;
      accountId=this.getAccountIdFromArn(arn);
      return accountId;
    },

    getAccountIdFromArn: function(arn){
      console.log(arn)
      accountId=arn.toString().split("arn:aws:iam::")[1].split(":")[0];
      return accountId;
    },

    /**
     * get specific cloudprovider by accountid and userId
     * @param {*} accountId 
     * @param {*} userId
     * @param {*} cb 
     */
    getByAccountId: function(userId, accountId, cb){
      var sql="SELECT * FROM user_cloud_provider WHERE (userid=? AND aws_account_id=?)";
      var params=[userId, accountId];
      try{
        mydb.query(
          sql, params,
          function(err, results){
              if (err) throw err;
              if(results!=null){
                cb({results:results[0]});
              }else{
                cb({results:null});
              }
              
          }
        );
      }catch(e){
        cb({error: "Error getting Cloud Provider"}, null);
      }
    },

    /**
    * @author: Sarah Ruane
    * @description: Remove cloud provider account from a users profile
    * @usage: request data should user_cloud_provider_id and userid
    */
    deleteCloudProviderAccount: function (data, cb){

      var sql = "CALL sp_deleteUserCloudProvider(?,?)";
       var params = [data.userCloudProviderId, data.userId];

       try{
         mydb.update(
             sql, params,
             function(err, results){

                console.log(results);

                 if (err) cb(err, null);

                 if(results!=null){
                     cb(null, results);
                 }
             }
         );
       }
       catch(e){
         cb({error: "Error removing cloud provider account"}, null);
       }
    },

    /**
    * @author: Sarah Ruane
    * @description: update cloud provider account for a user
    * @usage: request data should provide user_cloud_provider_id and userid
    */
    updateCloudProviderAccount: function (data, cb){

       var sql = "CALL sp_updateUserCloudProvider (?, ?, ?, ?, ?)";
       var params = [data.id, data.userId, data.awsAccountId, data.name, data.isDefault];

       try {
         mydb.update(
           sql, params,
           function(err, results) {

             if (err) cb(err, null);

             if(results!=null){
                 cb(null, results);
             }
           }
         );
       }
       catch(e){
         cb({error: "Error updating cloud provider account"}, null);
       }
    }
  };
}
