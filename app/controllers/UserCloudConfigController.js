var mysql = require("../../app/drivers/mysql.js");
var mydb= mysql();

module.exports=function(){
    return {

      getAWSConfigsByUserId: function (authUserId, cb){
          var sql="CALL sp_getAWSConfigsByUserId(?)";
          var params = [authUserId];

          mydb.query(
              sql, params,
              function(err, results){
                  if (err) throw err;

                  if(results!=null){
                      cb({result:results[0]});
                  }else{
                      cb({error:"No rows"});
                  }
              }
          );
      },

      /**
      * @author: Sarah Ruane
      * @description: Add a new cloud provider account to a users profile
      * @usage: request data should include:
          name, userId, userCloudProviderId, vpc, appSubnet,
          appSecurityGroup, appInstanceType, customData, region
      */
      addAWSConfig: function (data, cb){

        console.log(data);

        var sql = "CALL sp_insertAWSConfig (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        var params = [
          data.name,
          data.userId,
          data.userCloudProviderId,
          data.vpc,
          data.appSubnet,
          data.appSecurityGroup,
          data.appInstanceType,
          data.customData,
          data.region
        ];

         try{

             //insert query with sql, parameters and retrun results or error through callback function
             mydb.insertSP(
                 sql, params,
                 function(err, result){
                     if (err) throw err;

                     console.log(result);

                     if(result != null){
                        cb(null, { id : result });
                     }
                 }
             );


         }
         catch(e){
             console.log(e);
             cb({error: "Error adding new aws config"}, null);
         }
         finally{

         }
      },

      /**
      * @author: Sarah Ruane
      * @description: Remove aws config from a users profile
      * @usage: request data should user_aws_config_id and userid
      */
      deleteAWSConfig: function (data, cb){

         var sql = "CALL sp_deleteAWSConfig(?,?)";
         var params = [data.id, data.userId];

         try{

              mydb.update(
                 sql, params,
                 function(err, results){

                     if (err) cb(err, null);

                     if(results!=null){
                         cb(null, results);
                     }
                 }
             );
         }
         catch(e){
             console.log(e);
             cb({error: "Error removing aws config"}, null);
         }
         finally{

         }
      },

      /**
      * @author: Sarah Ruane
      * @description: update aws config for a user
      * @usage: request data should include:
          id, name, userId, userCloudProviderId, vpc, appSubnet,
          appSecurityGroup, appInstanceType, customData, region
      */
      updateAWSConfig: function (data, cb){

         var sql = "CALL sp_updateAWSConfig (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
         var params = [
           data.id,
           data.name,
           data.userId,
           data.userCloudProviderId,
           data.vpc,
           data.appSubnet,
           data.appSecurityGroup,
           data.appInstanceType,
           data.customData,
           data.region
         ];

         try{

              mydb.update(
                 sql, params,
                 function(err, results){
                   if (err) cb(err, null);

                   if(results!=null){
                       cb(null, results);
                   }
                 }
             );
         }
         catch(e){
             console.log(e);
             cb({error: "Error updating cloud provider account"}, null);
         }
         finally{

         }
      }

    };
  }
