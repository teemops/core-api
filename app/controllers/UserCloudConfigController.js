

var config = require('config-json');
config.load('./app/config/config.json');
const CW_EVENTS_TEMPLATE='cw.notify.child.account';
var mysql = require("../../app/drivers/mysql.js");
var cfnDriver=require("../../app/drivers/cfn");
var stsDriver=require("../../app/drivers/sts");
var mydb= mysql();
var cfn=cfnDriver(config);
var sts=stsDriver(config);
var awsAccountId=config.get("AWSAccountId");

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
      addAWSConfig: async function (data){

        var sql='CALL sp_getSTSCredsUserAccount(?, ?)';
        var sqlParams=[data.userId, data.userCloudProviderId];
        try{
            const sqldata=await mydb.getRow(sql, sqlParams);
            
            var stsParams={
                RoleArn: JSON.parse(sqldata.authData).arn
            }
            var creds=await sts.assume(stsParams);
            //set credentials
            cfn.creds(data.region,creds);
            
        }catch(e){
            throw e;
        }

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
            //insert query with sql, parameters and return results or error through callback function
            const result=await mydb.insertSPPromise(sql, params);
            if(result != null){
                //if this is the first time the region has been added we can add the Cloudwatch events
                var params={
                    ParentAWSAccountId: awsAccountId
                }
                const cfnResult=await cfn.create("cloudwatch", CW_EVENTS_TEMPLATE, params, false, true, false);
                //createStack(label, templateName, parameters=null, wait=false, url=false, notify=true)
                if(cfnResult){
                    
                }
                return result;
                
            }
        }catch(e){
            throw e;
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
